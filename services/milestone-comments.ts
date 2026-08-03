"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { logMilestoneActivity } from "@/lib/milestone-activity";
import { notifyUsers } from "@/lib/notifications";
import { getAccessForMilestone, getChainStakeholderIds } from "@/lib/supply-chain-queries";
import type { ActionResult } from "@/services/supply-chain";

export async function addCommentAction(
  milestoneId: string,
  content: string,
  parentCommentId?: string
): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!content.trim()) return { success: false, error: "Comment can't be empty." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!access.access.canComment) return { success: false, error: "You don't have permission to comment here." };

  const comment = await db.milestoneComment.create({
    data: { milestoneId, authorId: user.id, content: content.trim(), parentCommentId },
  });

  const milestone = await db.milestone.findUnique({ where: { id: milestoneId }, select: { name: true } });
  await logMilestoneActivity(milestoneId, "Comment Added", `${user.name} commented on "${milestone?.name}".`, user.id);

  const stakeholders = await getChainStakeholderIds(access.chainId);
  await notifyUsers(
    stakeholders,
    {
      type: "COMMENT_ADDED",
      title: "New Comment",
      body: `${user.name} commented on "${milestone?.name}".`,
    },
    user.id
  );

  return { success: true, data: { id: comment.id } };
}

export async function editCommentAction(commentId: string, content: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!content.trim()) return { success: false, error: "Comment can't be empty." };

  const comment = await db.milestoneComment.findUnique({ where: { id: commentId } });
  if (!comment) return { success: false, error: "Comment not found." };
  if (comment.authorId !== user.id) return { success: false, error: "You can only edit your own comments." };

  await db.milestoneComment.update({ where: { id: commentId }, data: { content: content.trim(), edited: true } });
  return { success: true, data: undefined };
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const comment = await db.milestoneComment.findUnique({ where: { id: commentId } });
  if (!comment) return { success: false, error: "Comment not found." };
  if (comment.authorId !== user.id) return { success: false, error: "You can only delete your own comments." };

  await db.milestoneComment.delete({ where: { id: commentId } });
  return { success: true, data: undefined };
}
