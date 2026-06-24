import { NextResponse, type NextRequest } from "next/server";
import { HttpError, jsonError } from "@/lib/api";
import { requireFirebaseUser } from "@/lib/auth";
import { getPayPalSubscription } from "@/lib/paypal";
import { writeSubscriptionFromPayPal } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const body = (await request.json()) as { subscriptionId?: string };

    if (!body.subscriptionId) {
      throw new HttpError(400, "Missing PayPal subscription ID.");
    }

    const subscription = await getPayPalSubscription(body.subscriptionId);

    if (subscription.custom_id !== user.uid) {
      throw new HttpError(403, "PayPal subscription does not belong to this Firebase profile.");
    }

    const result = await writeSubscriptionFromPayPal(subscription, "client.sync");

    return NextResponse.json({
      ok: true,
      subscription: result,
    });
  } catch (error) {
    return jsonError(error);
  }
}
