"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getNotificationsAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
  type NotificationEntry,
} from "@/services/notifications";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function FreelancerNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNotificationsAction().then((result) => {
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
      setLoading(false);
    });
  }, []);

  async function refresh() {
    const result = await getNotificationsAction();
    setNotifications(result.notifications);
    setUnreadCount(result.unreadCount);
  }

  async function handleClick(n: NotificationEntry) {
    if (!n.read) {
      await markNotificationReadAction(n.id);
      refresh();
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsReadAction();
    refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Proposals, project assignments, and messages from admin."
        actions={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleMarkAllRead}>
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </Button>
          )
        }
      />

      {!loading && notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="You'll see updates here as they happen." />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleClick(n)}
              className={cn(
                "w-full text-left px-4 py-3.5 hover:bg-muted/50 transition-colors",
                !n.read && "bg-primary/5"
              )}
            >
              <div className="flex items-center gap-2">
                {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                <p className="text-sm font-medium text-foreground">{n.title}</p>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">{timeAgo(n.createdAt)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
