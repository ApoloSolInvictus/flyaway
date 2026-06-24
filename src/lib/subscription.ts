import { getFirestoreDocument, patchFirestoreDocument } from "@/lib/firebase/rest";
import type { PayPalSubscription } from "@/lib/paypal";

export type SubscriptionStatus = "inactive" | "pending" | "active" | "suspended" | "cancelled" | "expired";

export type ProfileData = {
  uid: string;
  email?: string;
  displayName?: string;
  subscriptionStatus?: SubscriptionStatus;
  paypalSubscriptionId?: string;
  paypalStatus?: string;
  paypalPlanId?: string;
  subscribedAt?: unknown;
  subscriptionUpdatedAt?: unknown;
  lastPayPalEvent?: string;
};

const activePayPalStatuses = new Set(["ACTIVE"]);

export function mapPayPalStatus(status?: string): SubscriptionStatus {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "APPROVAL_PENDING":
    case "APPROVED":
      return "pending";
    case "SUSPENDED":
      return "suspended";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    default:
      return "inactive";
  }
}

export function serializeProfile(data: Record<string, unknown> | null): ProfileData | null {
  if (!data) {
    return null;
  }

  return data as ProfileData;
}

export async function getProfile(uid: string) {
  return serializeProfile(await getFirestoreDocument("profiles", uid));
}

export async function writeSubscriptionFromPayPal(subscription: PayPalSubscription, eventType = "manual.sync") {
  const uid = subscription.custom_id;

  if (!uid) {
    return null;
  }

  const status = mapPayPalStatus(subscription.status);
  const isActive = activePayPalStatuses.has(subscription.status);
  const timestamp = new Date().toISOString();
  const subscriptionPayload: Record<string, unknown> = {
    uid,
    paypalSubscriptionId: subscription.id,
    paypalPlanId: subscription.plan_id ?? process.env.PAYPAL_PLAN_ID ?? null,
    paypalStatus: subscription.status,
    subscriptionStatus: status,
    subscriptionUpdatedAt: timestamp,
    lastPayPalEvent: eventType,
    subscriberEmail: subscription.subscriber?.email_address ?? null,
    nextBillingTime: subscription.billing_info?.next_billing_time ?? null,
    lastPaymentTime: subscription.billing_info?.last_payment?.time ?? null,
    lastPaymentAmount: subscription.billing_info?.last_payment?.amount ?? null,
  };

  if (isActive) {
    subscriptionPayload.subscribedAt = timestamp;
  }

  await Promise.all([
    patchFirestoreDocument("profiles", uid, subscriptionPayload),
    patchFirestoreDocument("paypalSubscriptions", subscription.id, subscriptionPayload),
  ]);

  return {
    uid,
    subscriptionStatus: status,
    paypalSubscriptionId: subscription.id,
    paypalStatus: subscription.status,
  };
}
