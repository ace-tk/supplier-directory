"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

export interface TaskRecord {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
}

/**
 * Real CRM Task creation — reused by both the Dashboard's "Add task" dialog
 * (no conversationId, a genuine global admin task) and CRM's own
 * per-conversation "Add Task" button (conversationId supplied). Same model,
 * same action, no duplicated write path.
 */
export async function createTaskAction(input: {
  title: string;
  dueDate?: string;
  conversationId?: string;
}): Promise<ActionResult<TaskRecord>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const title = input.title.trim();
  if (!title) return { success: false, error: "Task title is required." };

  const created = await db.task.create({
    data: {
      title,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      conversationId: input.conversationId || null,
    },
    select: { id: true, title: true, completed: true, dueDate: true },
  });

  return { success: true, data: { ...created, dueDate: created.dueDate?.toISOString() ?? null } };
}

export async function toggleTaskAction(taskId: string): Promise<ActionResult<{ completed: boolean }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const task = await db.task.findUnique({ where: { id: taskId }, select: { completed: true } });
  if (!task) return { success: false, error: "Task not found." };

  const updated = await db.task.update({ where: { id: taskId }, data: { completed: !task.completed }, select: { completed: true } });
  return { success: true, data: updated };
}
