"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { logMilestoneActivity } from "@/lib/milestone-activity";
import { notifyUsers } from "@/lib/notifications";
import { getAccessForMilestone } from "@/lib/supply-chain-queries";
import type { ActionResult } from "@/services/supply-chain";

async function upsertParticipant(milestoneId: string, userId: string, kind: "ASSIGNEE" | "TAG") {
  return db.milestoneParticipant.upsert({
    where: { milestoneId_userId_kind: { milestoneId, userId, kind } },
    create: { milestoneId, userId, kind },
    update: {},
  });
}

export async function assignUserToMilestoneAction(milestoneId: string, userId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!access.access.canEditChain) return { success: false, error: "You don't have permission to assign team members." };

  await upsertParticipant(milestoneId, userId, "ASSIGNEE");

  const [milestone, assignee] = await Promise.all([
    db.milestone.findUnique({ where: { id: milestoneId }, select: { name: true } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  await logMilestoneActivity(milestoneId, "Assignment", `${assignee?.name} was assigned to "${milestone?.name}".`, user.id);

  await notifyUsers(
    [userId],
    {
      type: "ASSIGNMENT",
      title: "You were assigned",
      body: `${user.name} assigned you to "${milestone?.name}".`,
    },
    user.id
  );

  return { success: true, data: undefined };
}

export async function unassignUserFromMilestoneAction(milestoneId: string, userId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!access.access.canEditChain) return { success: false, error: "You don't have permission to unassign team members." };

  await db.milestoneParticipant
    .delete({ where: { milestoneId_userId_kind: { milestoneId, userId, kind: "ASSIGNEE" } } })
    .catch(() => null);

  return { success: true, data: undefined };
}

export async function tagUserOnMilestoneAction(milestoneId: string, userId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!access.access.canComment) return { success: false, error: "You don't have permission to tag people here." };

  await upsertParticipant(milestoneId, userId, "TAG");

  const [milestone, tagged] = await Promise.all([
    db.milestone.findUnique({ where: { id: milestoneId }, select: { name: true } }),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);
  await logMilestoneActivity(milestoneId, "Tagged", `${user.name} tagged ${tagged?.name} on "${milestone?.name}".`, user.id);

  return { success: true, data: undefined };
}

export async function untagUserFromMilestoneAction(milestoneId: string, userId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!access.access.canComment) return { success: false, error: "You don't have permission to untag people here." };

  await db.milestoneParticipant
    .delete({ where: { milestoneId_userId_kind: { milestoneId, userId, kind: "TAG" } } })
    .catch(() => null);

  return { success: true, data: undefined };
}
