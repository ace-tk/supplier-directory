"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";

export interface NotificationEntry {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export async function getNotificationsAction(): Promise<{ notifications: NotificationEntry[]; unreadCount: number }> {
  const user = await getUser();
  if (!user) return { notifications: [], unreadCount: 0 };

  const [rows, unreadCount] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.notification.count({ where: { userId: user.id, read: false } }),
  ]);

  return {
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
}

export async function markNotificationReadAction(id: string): Promise<{ success: true }> {
  const user = await getUser();
  if (!user) return { success: true };
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { read: true } });
  return { success: true };
}

export async function markAllNotificationsReadAction(): Promise<{ success: true }> {
  const user = await getUser();
  if (!user) return { success: true };
  await db.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
  return { success: true };
}
