import { HttpError } from "@/lib/api";

type PayPalAccessToken = {
  accessToken: string;
  expiresAt: number;
};

export type PayPalSubscription = {
  id: string;
  status: string;
  plan_id?: string;
  custom_id?: string;
  start_time?: string;
  subscriber?: {
    email_address?: string;
    name?: {
      given_name?: string;
      surname?: string;
    };
  };
  billing_info?: {
    next_billing_time?: string;
    last_payment?: {
      time?: string;
      amount?: {
        currency_code?: string;
        value?: string;
      };
    };
  };
};

let tokenCache: PayPalAccessToken | null = null;

function getPayPalBaseUrl() {
  return process.env.PAYPAL_ENV === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

function requirePayPalConfig() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new HttpError(500, "PayPal API credentials are not configured.");
  }

  return { clientId, clientSecret };
}

async function getPayPalAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret } = requirePayPalConfig();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new HttpError(502, "PayPal rejected the API credential request.");
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

async function paypalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getPayPalAccessToken();
  const response = await fetch(`${getPayPalBaseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HttpError(response.status >= 500 ? 502 : response.status, `PayPal API error: ${body}`);
  }

  return (await response.json()) as T;
}

export async function createPayPalSubscription(input: {
  uid: string;
  email?: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const planId = process.env.PAYPAL_PLAN_ID;

  if (!planId) {
    throw new HttpError(500, "PAYPAL_PLAN_ID is not configured.");
  }

  return paypalFetch<PayPalSubscription>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      custom_id: input.uid,
      subscriber: input.email
        ? {
            email_address: input.email,
          }
        : undefined,
      application_context: {
        brand_name: "FlyAway",
        locale: "es-US",
        shipping_preference: "NO_SHIPPING",
        user_action: "SUBSCRIBE_NOW",
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  });
}

export async function getPayPalSubscription(subscriptionId: string) {
  return paypalFetch<PayPalSubscription>(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export async function verifyPayPalWebhook(headers: Headers, event: unknown) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    throw new HttpError(500, "PAYPAL_WEBHOOK_ID is not configured.");
  }

  const verification = await paypalFetch<{ verification_status: string }>("/v1/notifications/verify-webhook-signature", {
    method: "POST",
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });

  if (verification.verification_status !== "SUCCESS") {
    throw new HttpError(401, "PayPal webhook signature verification failed.");
  }
}
