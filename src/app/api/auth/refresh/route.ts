import { NextResponse, type NextRequest } from "next/server";
import { HttpError, jsonError } from "@/lib/api";
import { firebaseRefreshSession } from "@/lib/firebase/rest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { refreshToken?: string };

    if (!body.refreshToken) {
      throw new HttpError(400, "Refresh token is required.");
    }

    return NextResponse.json({
      session: await firebaseRefreshSession(body.refreshToken),
    });
  } catch (error) {
    return jsonError(error);
  }
}
