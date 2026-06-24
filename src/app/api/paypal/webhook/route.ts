import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { getPayPalSubscription, type PayPalSubscription, verifyPayPalWebhook } from "@/lib/paypal";
import { writeSubscriptionFromPayPal } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  resource?: PayPalSubscription & {
    billing_agreement_id?: string;
  };
};

const subscriptionEvents = new Set([
  "BILLING.SUBSCRIPTION.ACTIVATED",
  "BILLING.SUBSCRIPTION.UPDATED",
  "BILLING.SUBSCRIPTION.SUSPENDED",
  "BILLING.SUBSCRIPTION.CANCELLED",
  "BILLING.SUBSCRIPTION.EXPIRED",
]);

export async function POST(request: NextRequest) {
  try {
    const event = (await request.json()) as PayPalWebhookEvent;
    await verifyPayPalWebhook(request.headers, event);

    if (event.event_type && subscriptionEvents.has(event.event_type) && event.resource?.id) {
      await writeSubscriptionFromPayPal(event.resource, event.event_type);
    }

    if (event.event_type === "PAYMENT.SALE.COMPLETED" && event.resource?.billing_agreement_id) {
      const subscription = await getPayPalSubscription(event.resource.billing_agreement_id);
      await writeSubscriptionFromPayPal(subscription, event.event_type);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
