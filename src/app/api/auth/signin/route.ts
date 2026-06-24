import { NextResponse, type NextRequest } from "next/server";
import { HttpError, jsonError } from "@/lib/api";
import { firebaseSignIn, patchFirestoreDocument } from "@/lib/firebase/rest";
import { getProfile } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      throw new HttpError(400, "Email and password are required.");
    }

    const session = await firebaseSignIn({
      email: body.email,
      password: body.password,
    });

    await patchFirestoreDocument("profiles", session.uid, {
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      session,
      profile: await getProfile(session.uid),
    });
  } catch (error) {
    return jsonError(error);
  }
}
