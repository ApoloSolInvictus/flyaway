"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProfileData } from "@/lib/subscription";

type StoredSession = {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
};

type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

type AuthResponse = {
  session: StoredSession;
  profile: ProfileData | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  profile: ProfileData | null;
  loading: boolean;
  error: string | null;
  isFirebaseReady: boolean;
  register: (input: { name: string; email: string; password: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: (forceRefresh?: boolean) => Promise<void>;
};

const storageKey = "flyaway.firebase.session";
const AuthContext = createContext<AuthContextValue | null>(null);
const isFirebaseReady = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);

function readStoredSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function writeStoredSession(session: StoredSession | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

async function parseJsonResponse<T>(response: Response) {
  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveSession = useCallback((nextSession: StoredSession | null) => {
    setSession(nextSession);
    writeStoredSession(nextSession);
  }, []);

  const refreshSession = useCallback(
    async (currentSession: StoredSession) => {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refreshToken: currentSession.refreshToken }),
      });
      const data = await parseJsonResponse<{
        session: Pick<StoredSession, "uid" | "idToken" | "refreshToken" | "expiresAt">;
      }>(response);
      const nextSession: StoredSession = {
        ...currentSession,
        uid: data.session.uid,
        idToken: data.session.idToken,
        refreshToken: data.session.refreshToken,
        expiresAt: data.session.expiresAt,
      };

      saveSession(nextSession);
      return nextSession;
    },
    [saveSession],
  );

  const getIdToken = useCallback(
    async (forceRefresh = false) => {
      if (!session) {
        throw new Error("No active Firebase session.");
      }

      if (!forceRefresh && session.expiresAt > Date.now() + 90_000) {
        return session.idToken;
      }

      const nextSession = await refreshSession(session);
      return nextSession.idToken;
    },
    [refreshSession, session],
  );

  const refreshProfile = useCallback(async (forceRefresh = false) => {
    if (!session) {
      return;
    }

    const token = await getIdToken(forceRefresh);
    const response = await fetch("/api/subscription/status", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await parseJsonResponse<{ profile: ProfileData | null }>(response);
    setProfile(data.profile);
  }, [getIdToken, session]);

  useEffect(() => {
    const stored = readStoredSession();

    if (!stored) {
      setLoading(false);
      return;
    }

    saveSession(stored);
    setLoading(false);
  }, [saveSession]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }

    void refreshProfile().catch((profileError) => {
      setError(profileError instanceof Error ? profileError.message : "Could not load profile.");
    });
  }, [refreshProfile, session]);

  const register = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      setError(null);
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const data = await parseJsonResponse<AuthResponse>(response);
      saveSession(data.session);
      setProfile(data.profile);
    },
    [saveSession],
  );

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      setError(null);
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const data = await parseJsonResponse<AuthResponse>(response);
      saveSession(data.session);
      setProfile(data.profile);
    },
    [saveSession],
  );

  const signOut = useCallback(async () => {
    saveSession(null);
    setProfile(null);
  }, [saveSession]);

  const resetPassword = useCallback(async (email: string) => {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    await parseJsonResponse<{ ok: boolean }>(response);
  }, []);

  const user = useMemo<AuthUser | null>(() => {
    if (!session) {
      return null;
    }

    return {
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      getIdToken,
    };
  }, [getIdToken, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      error,
      isFirebaseReady,
      register,
      signIn,
      signOut,
      resetPassword,
      refreshProfile,
    }),
    [error, loading, profile, refreshProfile, register, resetPassword, signIn, signOut, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
