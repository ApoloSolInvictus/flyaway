import { NextResponse, type NextRequest } from "next/server";
import { HttpError, jsonError } from "@/lib/api";
import { firebaseRegister, patchFirestoreDocument } from "@/lib/firebase/rest";
import { getProfile } from "@/lib/subscription";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; email?: string; password?: string };

    if (!body.name || !body.email || !body.password) {
      throw new HttpError(400, "Name, email, and password are required.");
    }

    const session = await firebaseRegister({
      name: body.name,
      email: body.email,
      password: body.password,
    });
    const now = new Date().toISOString();

    await patchFirestoreDocument("profiles", session.uid, {
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({
      session,
      profile: await getProfile(session.uid),
    });
  } catch (error) {
    return jsonError(error);
  }
}
