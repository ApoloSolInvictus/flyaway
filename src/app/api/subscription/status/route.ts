import { NextResponse, type NextRequest } from "next/server";
import { jsonError } from "@/lib/api";
import { requireFirebaseUser } from "@/lib/auth";
import { getProfile } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const user = await requireFirebaseUser(request);
    const profile = await getProfile(user.uid);

    return NextResponse.json({
      profile,
      subscriptionStatus: profile?.subscriptionStatus ?? "inactive",
    });
  } catch (error) {
    return jsonError(error);
  }
}
