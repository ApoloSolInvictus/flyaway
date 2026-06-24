import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { requireFirebaseUser } from "@/lib/auth";
import { createPayPalSubscription } from "@/lib/paypal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
    const origin = configuredOrigin || request.headers.get("origin") || new URL(request.url).origin;
    const subscription = await createPayPalSubscription({
      uid: user.uid,
      email: typeof user.email === "string" ? user.email : undefined,
      returnUrl: `${origin}/?subscription=approved`,
      cancelUrl: `${origin}/?subscription=cancelled`,
    });

    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error) {
    return jsonError(error);
  }
}
