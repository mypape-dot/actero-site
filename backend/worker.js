const SHOPIFY_API_VERSION = "2026-10";

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map(x => x.trim())
    .filter(Boolean);
  if (!origin) return "";
  return allowed.includes(origin) ? origin : "";
}

function corsHeaders(request, env) {
  const origin = allowedOrigin(request, env);
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra }
  });
}

function validCaseId(value) {
  return typeof value === "string" &&
    value.startsWith("AR-") &&
    value.length >= 12 &&
    value.length <= 120 &&
    /^[A-Za-z0-9-]+$/.test(value);
}

function compactText(value, max = 120) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function variantNumericId(gid) {
  const m = String(gid || "").match(/ProductVariant\/(\d+)$/);
  return m ? m[1] : "";
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyShopifyHmac(rawBody, request, env) {
  const provided = request.headers.get("X-Shopify-Hmac-Sha256");
  if (!provided || !env.SHOPIFY_WEBHOOK_SECRET) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.SHOPIFY_WEBHOOK_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      base64ToBytes(provided),
      new TextEncoder().encode(rawBody)
    );
  } catch {
    return false;
  }
}

function readAttribute(list, key) {
  if (!Array.isArray(list)) return "";
  const found = list.find(x =>
    x && (x.name === key || x.key === key) && typeof x.value !== "undefined"
  );
  return found ? String(found.value || "") : "";
}

function caseIdFromOrder(order, expectedVariant) {
  const lines = Array.isArray(order?.line_items) ? order.line_items : [];
  const matchingLines = expectedVariant
    ? lines.filter(x => String(x?.variant_id || "") === expectedVariant)
    : lines;

  for (const line of matchingLines) {
    const fromLine =
      readAttribute(line?.properties, "_actero_case_id") ||
      readAttribute(line?.properties, "actero_case_id");
    if (validCaseId(fromLine)) return fromLine;
  }

  const fromOrder =
    readAttribute(order?.note_attributes, "actero_case_id") ||
    readAttribute(order?.custom_attributes, "actero_case_id");

  return validCaseId(fromOrder) ? fromOrder : "";
}

async function createCheckout(request, env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ ok: false, error: "origin_not_allowed" }, 403, corsHeaders(request, env));

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400, corsHeaders(request, env));
  }

  const caseId = body?.case_id;
  if (!validCaseId(caseId)) {
    return json({ ok: false, error: "invalid_case_id" }, 400, corsHeaders(request, env));
  }

  if (!env.SHOPIFY_STORE_DOMAIN || !env.SHOPIFY_STOREFRONT_TOKEN || !env.SHOPIFY_VARIANT_GID) {
    return json({ ok: false, error: "payment_backend_not_configured" }, 503, corsHeaders(request, env));
  }

  const route = compactText(body?.route, 80);
  const country = compactText(body?.country, 10);
  const returnUrl = compactText(body?.return_url, 500);

  const query = `
    mutation CreateActeROCart($input: CartInput!) {
      cartCreate(input: $input) {
        cart { id checkoutUrl }
        userErrors { field message code }
        warnings { message code }
      }
    }
  `;

  const attributes = [
    { key: "actero_case_id", value: caseId },
    { key: "actero_source", value: "actero-web" }
  ];
  if (route) attributes.push({ key: "actero_route", value: route });
  if (country) attributes.push({ key: "actero_country", value: country });
  if (returnUrl) attributes.push({ key: "actero_return_url", value: returnUrl });

  const variables = {
    input: {
      attributes,
      lines: [{
        quantity: 1,
        merchandiseId: env.SHOPIFY_VARIANT_GID,
        attributes: [
          { key: "_actero_case_id", value: caseId },
          { key: "_actero_route", value: route || "unknown" }
        ]
      }]
    }
  };

  const response = await fetch(
    `https://${env.SHOPIFY_STORE_DOMAIN}/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": env.SHOPIFY_STOREFRONT_TOKEN
      },
      body: JSON.stringify({ query, variables })
    }
  );

  let payload = null;
  try { payload = await response.json(); } catch {}

  const result = payload?.data?.cartCreate;
  const checkoutUrl = result?.cart?.checkoutUrl;
  if (!response.ok || !checkoutUrl || result?.userErrors?.length) {
    console.error("Shopify cartCreate failed", {
      status: response.status,
      userErrors: result?.userErrors || [],
      errors: payload?.errors || []
    });
    return json({ ok: false, error: "checkout_creation_failed" }, 502, corsHeaders(request, env));
  }

  return json({ ok: true, checkoutUrl }, 200, corsHeaders(request, env));
}

async function paidAccess(request, env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ ok: false, error: "origin_not_allowed" }, 403, corsHeaders(request, env));

  const url = new URL(request.url);
  const caseId = url.searchParams.get("case_id") || "";
  if (!validCaseId(caseId)) {
    return json({ ok: false, paid: false, error: "invalid_case_id" }, 400, corsHeaders(request, env));
  }

  const record = await env.ACTERO_ACCESS.get(`case:${caseId}`, { type: "json" });
  return json({
    ok: true,
    paid: !!record?.paid,
    paid_at: record?.paid_at || null
  }, 200, corsHeaders(request, env));
}

async function ordersPaidWebhook(request, env) {
  const rawBody = await request.text();
  const authentic = await verifyShopifyHmac(rawBody, request, env);
  if (!authentic) return new Response("invalid hmac", { status: 401 });

  let order;
  try { order = JSON.parse(rawBody); }
  catch { return new Response("invalid json", { status: 400 }); }

  const expectedVariant = variantNumericId(env.SHOPIFY_VARIANT_GID);
  const matchingLine = Array.isArray(order?.line_items) &&
    order.line_items.some(x => String(x?.variant_id || "") === expectedVariant);

  if (!matchingLine) return new Response("ignored", { status: 200 });

  const caseId = caseIdFromOrder(order, expectedVariant);
  if (!caseId) return new Response("missing case id", { status: 200 });

  const financialStatus = String(order?.financial_status || "").toLowerCase();
  if (financialStatus && financialStatus !== "paid") {
    return new Response("not paid", { status: 200 });
  }

  const orderId = String(order?.id || "");
  const paidAt = order?.processed_at || order?.updated_at || new Date().toISOString();

  await env.ACTERO_ACCESS.put(
    `case:${caseId}`,
    JSON.stringify({
      paid: true,
      paid_at: paidAt,
      order_id: orderId,
      variant_id: expectedVariant
    })
  );

  if (orderId) {
    await env.ACTERO_ACCESS.put(
      `order:${orderId}`,
      JSON.stringify({ case_id: caseId, paid: true, paid_at: paidAt })
    );
  }

  return new Response("ok", { status: 200 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "actero-payments" });
    }

    if (request.method === "POST" && url.pathname === "/checkout") {
      return createCheckout(request, env);
    }

    if (request.method === "GET" && url.pathname === "/access") {
      return paidAccess(request, env);
    }

    if (request.method === "POST" && url.pathname === "/webhooks/orders-paid") {
      return ordersPaidWebhook(request, env);
    }

    return new Response("Not found", { status: 404 });
  }
};
