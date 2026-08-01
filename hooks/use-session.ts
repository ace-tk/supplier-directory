"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/types/auth";

export interface AuthContextValue {
  user: SessionUser | null;
  logout: () => void;
  isLoggingOut: boolean;
}

export const SessionContext = createContext<AuthContextValue>({
  user: null,
  logout: () => {},
  isLoggingOut: false,
});

/** Just the current session user — most components only need this. */
export function useSession(): SessionUser | null {
  return useContext(SessionContext).user;
}

/**
 * Full auth context, including the single reusable `logout()` used by
 * every portal (Buyer, Supplier, Admin). Swapping the session backend
 * later (e.g. a real auth provider) only touches SessionProvider —
 * every `useAuth()` call site stays the same.
 */
export function useAuth(): AuthContextValue {
  return useContext(SessionContext);
}
