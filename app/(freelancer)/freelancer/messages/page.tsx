import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyStateStatic } from "@/components/shared/empty-state-static";
import { db } from "@/lib/db";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function FreelancerMessagesPage() {
  const user = await getUser();
  if (!user) redirect("/login?from=/freelancer/messages");
  const messages = await db.notification.findMany({
    where: { userId: user.id, type: "ADMIN_MESSAGE" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Direct messages from the SupplyBase admin team." />

      {messages.length === 0 ? (
        <EmptyStateStatic icon={MessageSquare} title="No messages yet" description="Messages from admin will appear here." />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {messages.map((m) => (
            <div key={m.id} className="px-4 py-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Admin</p>
                <p className="text-[11px] text-muted-foreground/70">{timeAgo(m.createdAt.toISOString())}</p>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{m.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
