import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    app: "FlyAway",
    timestamp: new Date().toISOString(),
  });
}
