"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptExistingInviteAction } from "@/services/team-management";

function InviteContent() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  function accept() { startTransition(async () => { const result = await acceptExistingInviteAction(token); if (!result.success) return setError(result.error); setAccepted(true); }); }
  return <div className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-lg"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">{accepted ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <Users className="h-6 w-6 text-primary" />}</div><h1 className="mt-5 text-xl font-semibold">{accepted ? "Workspace access activated" : "Join the SupplyBase workspace"}</h1><p className="mt-2 text-sm text-muted-foreground">{accepted ? "Your existing account is now connected to the company workspace." : "Sign in using the exact email address that received this invitation, then confirm access here."}</p>{error && <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}<div className="mt-6 flex gap-2">{accepted ? <Button className="w-full" onClick={() => router.push("/dashboard")}>Open workspace</Button> : <><Button variant="outline" className="flex-1" render={<Link href="/login" />}>Sign in first</Button><Button className="flex-1" disabled={pending || !token} onClick={accept}>{pending && <Loader2 className="h-4 w-4 animate-spin" />}Accept invite</Button></>}</div></div>;
}

export default function AcceptTeamInvitePage() { return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-5"><Suspense fallback={<Loader2 className="h-6 w-6 animate-spin" />}><InviteContent /></Suspense></main>; }
