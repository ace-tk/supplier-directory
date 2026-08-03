"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    const result = await getNotificationsAction();
    setNotifications(result.notifications);
    setUnreadCount(result.unreadCount);
  }, []);

  useEffect(() => {
    getNotificationsAction().then((result) => {
      setNotifications(result.notifications);
      setUnreadCount(result.unreadCount);
    });
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleOpenChange(open: boolean) {
    if (open) await refresh();
  }

  async function handleNotificationClick(notification: NotificationEntry) {
    if (!notification.read) {
      await markNotificationReadAction(notification.id);
      refresh();
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsReadAction();
    refresh();
  }

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications" />}>
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 text-[9px] flex items-center justify-center bg-primary text-primary-foreground border-2 border-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {notifications.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">No notifications yet.</p>
          ) : (
            notifications.map((n) => {
              const content = (
                <div
                  className={cn(
                    "flex flex-col gap-0.5 px-3 py-2.5 border-b border-border/50 last:border-0 hover:bg-muted/50 transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
                </div>
              );

              return n.link ? (
                <Link key={n.id} href={n.link} onClick={() => handleNotificationClick(n)}>
                  {content}
                </Link>
              ) : (
                <button key={n.id} type="button" onClick={() => handleNotificationClick(n)} className="w-full text-left">
                  {content}
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
