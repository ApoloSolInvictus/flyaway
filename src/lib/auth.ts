import { HttpError } from "@/lib/api";
import { verifyFirebaseIdToken } from "@/lib/firebase/rest";

export async function requireFirebaseUser(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";

  if (!token) {
    throw new HttpError(401, "Missing Firebase authorization token.");
  }

  try {
    return await verifyFirebaseIdToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired Firebase authorization token.");
  }
}
