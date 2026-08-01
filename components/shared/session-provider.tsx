"use client";

import { useTransition } from "react";
import { SessionContext } from "@/hooks/use-session";
import { logoutAction } from "@/services/auth";
import { SOURCING_REQUEST_DRAFT_KEY, SUPPLIER_PORTAL_DRAFT_KEY } from "@/lib/storage-keys";
import type { SessionUser } from "@/types/auth";

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const [isLoggingOut, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      // Clear any in-progress drafts so the next session on this browser
      // (a different role, a different account) never inherits them.
      localStorage.removeItem(SOURCING_REQUEST_DRAFT_KEY);
      localStorage.removeItem(SUPPLIER_PORTAL_DRAFT_KEY);
      await logoutAction();
    });
  }

  return (
    <SessionContext.Provider value={{ user, logout, isLoggingOut }}>{children}</SessionContext.Provider>
  );
}
