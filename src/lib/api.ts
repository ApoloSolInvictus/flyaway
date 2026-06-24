import { NextResponse } from "next/server";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function jsonError(error: unknown, fallback = "Unexpected server error") {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : fallback;

  if (status >= 500) {
    console.error(error);
  }

  return NextResponse.json({ error: message }, { status });
}
