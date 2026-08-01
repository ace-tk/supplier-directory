import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/session";
import { roleHome } from "@/lib/roles";

export default async function UnauthorizedPage() {
  const user = await getUser();
  const homeHref = user ? roleHome(user.role) : "/login";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center rounded-2xl border border-border bg-card shadow-card p-8">
        <div className="flex justify-center mb-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-destructive/10">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
        </div>
        <h1 className="text-lg font-semibold text-foreground">You don&apos;t have access</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Your account doesn&apos;t have permission to view this page.
        </p>
        <Link href={homeHref}>
          <Button className="mt-6 w-full">{user ? "Back to my portal" : "Go to sign in"}</Button>
        </Link>
      </div>
    </div>
  );
}
