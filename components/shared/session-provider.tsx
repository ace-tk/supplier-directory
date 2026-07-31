"use client";

import { SessionContext } from "@/hooks/use-session";
import type { SessionUser } from "@/types/auth";

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}
