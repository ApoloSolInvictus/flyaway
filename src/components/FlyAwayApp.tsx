"use client";

import { AuthProvider } from "@/context/AuthContext";
import { Dashboard } from "@/components/Dashboard";

export function FlyAwayApp() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}
