"use client";

import { createContext, useContext } from "react";
import type { SessionUser } from "@/types/auth";

export const SessionContext = createContext<SessionUser | null>(null);

export function useSession(): SessionUser | null {
  return useContext(SessionContext);
}
