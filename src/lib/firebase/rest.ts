import { createSign, createVerify } from "crypto";
import { HttpError } from "@/lib/api";

type FirebaseAuthResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email?: string;
  displayName?: string;
};

type FirebaseRefreshResponse = {
  id_token: string;
  refresh_token: string;
  expires_in: string;
  user_id: string;
};

type FirebaseDecodedToken = {
  uid: string;
  email?: string;
  name?: string;
  claims: Record<string, unknown>;
};

type CertCache = {
  certs: Record<string, string>;
  expiresAt: number;
};

type GoogleTokenCache = {
  accessToken: string;
  expiresAt: number;
};

type FirestoreValue =
  | { stringValue: string }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { nullValue: null }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { arrayValue: { values: FirestoreValue[] } };

type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

let certCache: CertCache | null = null;
let googleTokenCache: GoogleTokenCache | null = null;

function normalizePrivateKey(privateKey?: string) {
  return privateKey?.replace(/\\n/g, "\n");
}

function firebaseApiKey() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY;

  if (!apiKey) {
    throw new HttpError(500, "Firebase API key is not configured.");
  }

  return apiKey;
}

function firebaseProjectId() {
  const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new HttpError(500, "Firebase project ID is not configured.");
  }

  return projectId;
}

function serviceAccount() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  if (!clientEmail || !privateKey) {
    throw new HttpError(500, "Firebase service account is not configured.");
  }

  return { clientEmail, privateKey };
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodeBase64Url(input: string) {
  const padded = input.padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function expiresAtFromNow(expiresInSeconds: string | number) {
  return Date.now() + Number(expiresInSeconds) * 1000;
}

function normalizeAuthSession(response: FirebaseAuthResponse) {
  return {
    uid: response.localId,
    email: response.email ?? "",
    displayName: response.displayName ?? "",
    idToken: response.idToken,
    refreshToken: response.refreshToken,
    expiresAt: expiresAtFromNow(response.expiresIn),
  };
}

async function firebaseAuthRequest<T>(method: string, body: Record<string, unknown>) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${method}?key=${firebaseApiKey()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new HttpError(response.status, data.error?.message ?? "Firebase Auth request failed.");
  }

  return data as T;
}

export async function firebaseRegister(input: { name: string; email: string; password: string }) {
  const created = await firebaseAuthRequest<FirebaseAuthResponse>("accounts:signUp", {
    email: input.email,
    password: input.password,
    returnSecureToken: true,
  });
  const updated = await firebaseAuthRequest<FirebaseAuthResponse>("accounts:update", {
    idToken: created.idToken,
    displayName: input.name,
    returnSecureToken: true,
  });

  return normalizeAuthSession({
    ...updated,
    refreshToken: updated.refreshToken || created.refreshToken,
    email: updated.email || input.email,
    displayName: updated.displayName || input.name,
  });
}

export async function firebaseSignIn(input: { email: string; password: string }) {
  const session = await firebaseAuthRequest<FirebaseAuthResponse>("accounts:signInWithPassword", {
    email: input.email,
    password: input.password,
    returnSecureToken: true,
  });

  return normalizeAuthSession(session);
}

export async function firebaseResetPassword(email: string) {
  await firebaseAuthRequest<{ email: string }>("accounts:sendOobCode", {
    requestType: "PASSWORD_RESET",
    email,
  });
}

export async function firebaseRefreshSession(refreshToken: string) {
  const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey()}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const data = (await response.json()) as FirebaseRefreshResponse & { error?: { message?: string } };

  if (!response.ok) {
    throw new HttpError(response.status, data.error?.message ?? "Firebase refresh request failed.");
  }

  return {
    uid: data.user_id,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt: expiresAtFromNow(data.expires_in),
  };
}

async function getFirebaseCerts() {
  if (certCache && certCache.expiresAt > Date.now() + 60_000) {
    return certCache.certs;
  }

  const response = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");

  if (!response.ok) {
    throw new HttpError(502, "Could not fetch Firebase token certificates.");
  }

  const cacheControl = response.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;
  certCache = {
    certs: (await response.json()) as Record<string, string>,
    expiresAt: Date.now() + maxAge * 1000,
  };

  return certCache.certs;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseDecodedToken> {
  const [encodedHeader, encodedPayload, encodedSignature] = idToken.split(".");

  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new HttpError(401, "Invalid Firebase token format.");
  }

  const header = JSON.parse(decodeBase64Url(encodedHeader).toString("utf8")) as { alg?: string; kid?: string };
  const payload = JSON.parse(decodeBase64Url(encodedPayload).toString("utf8")) as Record<string, unknown>;

  if (header.alg !== "RS256" || !header.kid) {
    throw new HttpError(401, "Invalid Firebase token header.");
  }

  const certs = await getFirebaseCerts();
  const cert = certs[header.kid];

  if (!cert) {
    throw new HttpError(401, "Unknown Firebase token certificate.");
  }

  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${encodedHeader}.${encodedPayload}`);
  verifier.end();

  if (!verifier.verify(cert, decodeBase64Url(encodedSignature))) {
    throw new HttpError(401, "Firebase token signature verification failed.");
  }

  const projectId = firebaseProjectId();
  const now = Math.floor(Date.now() / 1000);
  const exp = Number(payload.exp);
  const iat = Number(payload.iat);

  if (payload.aud !== projectId || payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new HttpError(401, "Firebase token project mismatch.");
  }

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new HttpError(401, "Firebase token is missing a subject.");
  }

  if (!Number.isFinite(exp) || exp < now) {
    throw new HttpError(401, "Firebase token has expired.");
  }

  if (!Number.isFinite(iat) || iat > now + 60) {
    throw new HttpError(401, "Firebase token issue time is invalid.");
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
    claims: payload,
  };
}

async function getGoogleAccessToken() {
  if (googleTokenCache && googleTokenCache.expiresAt > Date.now() + 60_000) {
    return googleTokenCache.accessToken;
  }

  const { clientEmail, privateKey } = serviceAccount();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );
  const signatureInput = `${header}.${claim}`;
  const signature = createSign("RSA-SHA256").update(signatureInput).end().sign(privateKey);
  const assertion = `${signatureInput}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = (await response.json()) as { access_token?: string; expires_in?: number; error_description?: string };

  if (!response.ok || !data.access_token || !data.expires_in) {
    throw new HttpError(response.status || 502, data.error_description ?? "Could not get Google access token.");
  }

  googleTokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

function firestoreDocumentUrl(collection: string, documentId: string) {
  const projectId = firebaseProjectId();
  const encodedCollection = encodeURIComponent(collection);
  const encodedDocumentId = encodeURIComponent(documentId);
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${encodedCollection}/${encodedDocumentId}`;
}

function toFirestoreValue(value: unknown): FirestoreValue {
  if (value === null) {
    return { nullValue: null };
  }

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return { timestampValue: value };
    }

    return { stringValue: value };
  }

  if (typeof value === "boolean") {
    return { booleanValue: value };
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }

  if (typeof value === "object") {
    return {
      mapValue: {
        fields: toFirestoreFields(value as Record<string, unknown>),
      },
    };
  }

  return { nullValue: null };
}

function toFirestoreFields(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toFirestoreValue(value)]),
  );
}

function fromFirestoreValue(value: FirestoreValue): unknown {
  if ("stringValue" in value) {
    return value.stringValue;
  }

  if ("booleanValue" in value) {
    return value.booleanValue;
  }

  if ("integerValue" in value) {
    return Number(value.integerValue);
  }

  if ("doubleValue" in value) {
    return value.doubleValue;
  }

  if ("timestampValue" in value) {
    return value.timestampValue;
  }

  if ("mapValue" in value) {
    return fromFirestoreFields(value.mapValue.fields ?? {});
  }

  if ("arrayValue" in value) {
    return (value.arrayValue.values ?? []).map(fromFirestoreValue);
  }

  return null;
}

function fromFirestoreFields(fields: Record<string, FirestoreValue>) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, fromFirestoreValue(value)]));
}

async function firestoreFetch(url: string, init?: RequestInit) {
  const accessToken = await getGoogleAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export async function getFirestoreDocument(collection: string, documentId: string) {
  const response = await firestoreFetch(firestoreDocumentUrl(collection, documentId));

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new HttpError(response.status >= 500 ? 502 : response.status, await response.text());
  }

  const document = (await response.json()) as FirestoreDocument;
  return document.fields ? fromFirestoreFields(document.fields) : {};
}

export async function patchFirestoreDocument(collection: string, documentId: string, data: Record<string, unknown>) {
  const fields = toFirestoreFields(data);
  const mask = Object.keys(fields)
    .map((fieldPath) => `updateMask.fieldPaths=${encodeURIComponent(fieldPath)}`)
    .join("&");
  const response = await firestoreFetch(`${firestoreDocumentUrl(collection, documentId)}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields }),
  });

  if (!response.ok) {
    throw new HttpError(response.status >= 500 ? 502 : response.status, await response.text());
  }

  const document = (await response.json()) as FirestoreDocument;
  return document.fields ? fromFirestoreFields(document.fields) : {};
}
