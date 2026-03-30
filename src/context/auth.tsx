"use client";
import { createContext, useContext, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

type AuthContextValue = {
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  const logout = useCallback(async () => {
    const csrfToken = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrf_token="))
      ?.split("=")[1];

    await fetch("/api/auth/logout", {
      method: "POST",
      headers: csrfToken ? { "X-CSRF-Token": csrfToken } : {},
    });

    router.push("/login");
  }, [router]);

  return <AuthContext.Provider value={{ logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
