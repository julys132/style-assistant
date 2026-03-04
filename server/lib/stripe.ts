const STRIPE_API_BASE = "https://api.stripe.com/v1";

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return key;
}

async function stripeRequest<T>({
  method,
  path,
  body,
}: {
  method: "GET" | "POST";
  path: string;
  body?: URLSearchParams;
}): Promise<T> {
  const secretKey = getStripeSecretKey();
  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? body.toString() : undefined,
  });

  const data = (await response.json()) as any;
  if (!response.ok) {
    const message = data?.error?.message || "Stripe request failed";
    throw new Error(message);
  }

  return data as T;
}

export type StripeCheckoutMode = "payment" | "subscription";

export async function createStripeCheckoutSession(params: {
  mode: StripeCheckoutMode;
  customerEmail: string;
  customerName: string;
  productName: string;
  unitAmountCents: number;
  successUrl: string;
  cancelUrl: string;
  clientReferenceId: string;
  metadata: Record<string, string>;
}): Promise<{ id: string; url: string | null }> {
  const form = new URLSearchParams();
  form.set("mode", params.mode);
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);
  form.set("customer_email", params.customerEmail);
  form.set("client_reference_id", params.clientReferenceId);
  form.set("payment_method_types[0]", "card");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "usd");
  form.set(
    "line_items[0][price_data][product_data][name]",
    params.productName,
  );
  form.set(
    "line_items[0][price_data][product_data][description]",
    "Credits for The Stylist",
  );
  form.set(
    "line_items[0][price_data][unit_amount]",
    String(params.unitAmountCents),
  );
  if (params.mode === "subscription") {
    form.set("line_items[0][price_data][recurring][interval]", "month");
  }

  for (const [key, value] of Object.entries(params.metadata)) {
    form.set(`metadata[${key}]`, value);
    if (params.mode === "payment") {
      form.set(`payment_intent_data[metadata][${key}]`, value);
    } else {
      form.set(`subscription_data[metadata][${key}]`, value);
    }
  }

  const result = await stripeRequest<{ id: string; url: string | null }>({
    method: "POST",
    path: "/checkout/sessions",
    body: form,
  });

  return result;
}

export async function retrieveStripeCheckoutSession(sessionId: string): Promise<{
  id: string;
  payment_status: string;
  payment_intent: string | null;
  metadata?: Record<string, string>;
  status?: string;
}> {
  const encoded = encodeURIComponent(sessionId);
  return stripeRequest({
    method: "GET",
    path: `/checkout/sessions/${encoded}`,
  });
}
