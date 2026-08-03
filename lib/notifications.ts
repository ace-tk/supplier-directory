// Minimal real notification system — there was none in the codebase before
// this feature, so this is intentionally small: one table, a create helper,
// and the read/mark-read queries in services/notifications.ts. Any future
// module (Buyer Leads, Orders, etc.) can call `notifyUsers` too instead of
// building its own notification path.

import { db } from "@/lib/db";
import type { NotificationType } from "@/lib/generated/prisma/enums";

interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export async function notifyUsers(userIds: string[], input: NotifyInput, excludeUserId?: string): Promise<void> {
  const unique = [...new Set(userIds)].filter((id) => id !== excludeUserId);
  if (unique.length === 0) return;

  await db.notification.createMany({
    data: unique.map((userId) => ({
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    })),
  });
}
