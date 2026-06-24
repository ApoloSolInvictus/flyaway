import { NextResponse, type NextRequest } from "next/server";
import { HttpError, jsonError } from "@/lib/api";
import { firebaseResetPassword } from "@/lib/firebase/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string };

    if (!body.email) {
      throw new HttpError(400, "Email is required.");
    }

    await firebaseResetPassword(body.email);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
