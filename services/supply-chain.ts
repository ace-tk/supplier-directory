"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { logMilestoneActivity } from "@/lib/milestone-activity";
import { notifyUsers } from "@/lib/notifications";
import { supplyChainPath } from "@/lib/supply-chain-ui";
import {
  getAccessForChain,
  getAccessForMilestone,
  getChainStakeholderIds,
  getMilestoneDetail,
  getMilestoneActivities,
} from "@/lib/supply-chain-queries";
import { DEFAULT_BUYER_SHARE_ROLE, DEFAULT_SUPPLIER_SHARE_ROLE, canEditMilestone } from "@/lib/supply-chain-permissions";
import {
  DEFAULT_MILESTONE_NAMES,
  type SupplyChainPriority,
  type BoardColumn,
  type MilestoneStatus,
  type MilestoneDetail,
  type MilestoneActivityEntry,
} from "@/types/supply-chain";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

export async function getMilestoneDetailAction(
  milestoneId: string
): Promise<ActionResult<{ milestone: MilestoneDetail; canEdit: boolean; canComment: boolean; canManageAssignees: boolean }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await getMilestoneDetail(milestoneId, user.id, user.role);
  if (!result) return { success: false, error: "You don't have access to this milestone." };

  return {
    success: true,
    data: {
      milestone: result.milestone,
      canEdit: canEditMilestone(result.access, result.isAssignee),
      canComment: result.access.canComment,
      canManageAssignees: result.access.canEditChain,
    },
  };
}

export async function getMilestoneActivityAction(milestoneId: string): Promise<ActionResult<MilestoneActivityEntry[]>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const activities = await getMilestoneActivities(milestoneId, user.id, user.role);
  if (!activities) return { success: false, error: "You don't have access to this milestone." };

  return { success: true, data: activities };
}

export interface SupplyChainSummary {
  id: string;
  name: string;
  orderNumber: string;
  status: string;
}

/** Admin-only picker list for "Share Supply Chain" inside the CRM Inbox. */
export async function listSupplyChainsForShareAction(): Promise<SupplyChainSummary[]> {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return [];

  const chains = await db.supplyChain.findMany({
    select: { id: true, name: true, orderNumber: true, status: true },
    orderBy: { updatedAt: "desc" },
  });

  return chains;
}

export interface DirectoryOption {
  id: string;
  name: string;
  companyName: string;
}

export async function getBuyerOptions(): Promise<DirectoryOption[]> {
  const buyers = await db.user.findMany({
    where: { role: "BUYER" },
    select: { id: true, name: true, buyer: { select: { companyName: true } } },
    orderBy: { name: "asc" },
  });
  return buyers.map((b) => ({ id: b.id, name: b.name, companyName: b.buyer?.companyName ?? "" }));
}

export async function getSupplierOptions(): Promise<DirectoryOption[]> {
  const suppliers = await db.user.findMany({
    where: { role: "SUPPLIER" },
    select: { id: true, name: true, supplier: { select: { companyName: true } } },
    orderBy: { name: "asc" },
  });
  return suppliers.map((s) => ({ id: s.id, name: s.name, companyName: s.supplier?.companyName ?? "" }));
}

export async function getTeamOptions(): Promise<DirectoryOption[]> {
  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return admins.map((a) => ({ id: a.id, name: a.name, companyName: "SupplyBase Team" }));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function createSupplyChainAction(input: {
  name: string;
  orderName: string;
  orderNumber: string;
  buyerUserId: string;
  supplierUserId: string;
  expectedDelivery: string;
  priority: SupplyChainPriority;
  description: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!input.name.trim() || !input.orderName.trim() || !input.orderNumber.trim()) {
    return { success: false, error: "Please fill in all required fields." };
  }
  if (!input.expectedDelivery) return { success: false, error: "Pick an expected delivery date." };

  const [buyer, supplier] = await Promise.all([
    db.user.findUnique({ where: { id: input.buyerUserId }, select: { id: true, name: true, role: true } }),
    db.user.findUnique({ where: { id: input.supplierUserId }, select: { id: true, name: true, role: true } }),
  ]);
  if (!buyer || buyer.role !== "BUYER") return { success: false, error: "Select a valid buyer." };
  if (!supplier || supplier.role !== "SUPPLIER") return { success: false, error: "Select a valid supplier." };

  const deliveryDate = new Date(input.expectedDelivery);

  const chain = await db.supplyChain.create({
    data: {
      name: input.name.trim(),
      orderName: input.orderName.trim(),
      orderNumber: input.orderNumber.trim(),
      description: input.description?.trim() || null,
      priority: input.priority,
      status: "ACTIVE",
      expectedDelivery: deliveryDate,
      ownerId: user.id,
      buyerUserId: buyer.id,
      buyerName: buyer.name,
      supplierUserId: supplier.id,
      supplierName: supplier.name,
      milestones: {
        create: DEFAULT_MILESTONE_NAMES.map((name, i) => ({
          name,
          status: (i === 0 ? "COMPLETED" : "NOT_STARTED") as MilestoneStatus,
          boardColumn: (i === 0 ? "COMPLETED" : "PLANNING") as BoardColumn,
          progress: i === 0 ? 100 : 0,
          dueDate: addDays(deliveryDate, (i - (DEFAULT_MILESTONE_NAMES.length - 1)) * 3),
          order: i,
        })),
      },
      shares: {
        create: [
          { userId: buyer.id, role: DEFAULT_BUYER_SHARE_ROLE, sharedById: user.id },
          { userId: supplier.id, role: DEFAULT_SUPPLIER_SHARE_ROLE, sharedById: user.id },
        ],
      },
    },
    include: { milestones: true },
  });

  await Promise.all(
    chain.milestones.map((m) =>
      logMilestoneActivity(m.id, "Milestone Created", `"${m.name}" was added to the timeline.`, user.id)
    )
  );

  await Promise.all(
    [buyer, supplier].map((recipient) =>
      notifyUsers(
        [recipient.id],
        {
          type: "SUPPLY_CHAIN_SHARED",
          title: "New Supply Chain",
          body: `${user.name} created "${chain.name}" and added you to it.`,
          link: supplyChainPath(recipient.role, chain.id),
        },
        user.id
      )
    )
  );

  return { success: true, data: { id: chain.id } };
}

export async function reorderMilestonesAction(chainId: string, orderedMilestoneIds: string[]): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await getAccessForChain(chainId, user.id, user.role);
  if (!result) return { success: false, error: "Supply chain not found." };
  if (!result.access.canEditChain) return { success: false, error: "You don't have permission to reorder milestones." };

  await db.$transaction(
    orderedMilestoneIds.map((id, i) => db.milestone.update({ where: { id }, data: { order: i } }))
  );

  return { success: true, data: undefined };
}

export async function updateMilestoneColumnAction(
  chainId: string,
  milestoneId: string,
  column: BoardColumn
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!canEditMilestone(access.access, access.isAssignee)) {
    return { success: false, error: "You don't have permission to move this milestone." };
  }

  await db.milestone.update({ where: { id: milestoneId }, data: { boardColumn: column } });
  await logMilestoneActivity(milestoneId, "Board Updated", `Moved to "${column.replace("_", " ")}".`, user.id);

  return { success: true, data: undefined };
}

export async function addMilestoneAction(
  chainId: string,
  input: { name: string; afterMilestoneId?: string; beforeMilestoneId?: string }
): Promise<ActionResult<{ id: string }>> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };
  if (!input.name.trim()) return { success: false, error: "Milestone name is required." };

  const result = await getAccessForChain(chainId, user.id, user.role);
  if (!result) return { success: false, error: "Supply chain not found." };
  if (!result.access.canEditChain) return { success: false, error: "You don't have permission to add milestones." };

  const existing = await db.milestone.findMany({ where: { supplyChainId: chainId }, orderBy: { order: "asc" } });

  let insertAt = existing.length;
  if (input.beforeMilestoneId) {
    const idx = existing.findIndex((m) => m.id === input.beforeMilestoneId);
    if (idx !== -1) insertAt = idx;
  } else if (input.afterMilestoneId) {
    const idx = existing.findIndex((m) => m.id === input.afterMilestoneId);
    if (idx !== -1) insertAt = idx + 1;
  }

  const dueDate = addDays(new Date(), 7);

  const created = await db.$transaction(async (tx) => {
    const newMilestone = await tx.milestone.create({
      data: { supplyChainId: chainId, name: input.name.trim(), dueDate, order: insertAt },
    });

    const reordered = [...existing];
    reordered.splice(insertAt, 0, newMilestone);
    await Promise.all(
      reordered.map((m, i) => (m.order === i ? Promise.resolve() : tx.milestone.update({ where: { id: m.id }, data: { order: i } })))
    );

    return newMilestone;
  });

  await logMilestoneActivity(created.id, "Milestone Created", `"${created.name}" was added to the timeline.`, user.id);

  const stakeholders = await getChainStakeholderIds(chainId);
  await notifyUsers(
    stakeholders,
    {
      type: "MILESTONE_CREATED",
      title: "New Milestone",
      body: `${user.name} added "${created.name}" to the timeline.`,
      link: undefined,
    },
    user.id
  );

  return { success: true, data: { id: created.id } };
}

export async function updateMilestoneAction(
  milestoneId: string,
  patch: {
    name?: string;
    description?: string;
    status?: MilestoneStatus;
    dueDate?: string;
    priority?: SupplyChainPriority;
    progress?: number;
    notes?: string;
  }
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const access = await getAccessForMilestone(milestoneId, user.id, user.role);
  if (!access) return { success: false, error: "Milestone not found." };
  if (!canEditMilestone(access.access, access.isAssignee)) {
    return { success: false, error: "You don't have permission to edit this milestone." };
  }

  const before = await db.milestone.findUnique({ where: { id: milestoneId } });
  if (!before) return { success: false, error: "Milestone not found." };

  const data: Record<string, unknown> = {};
  const activityLines: string[] = [];

  if (patch.name !== undefined && patch.name.trim() && patch.name !== before.name) {
    data.name = patch.name.trim();
    activityLines.push(`Title changed to "${patch.name.trim()}".`);
  }
  if (patch.description !== undefined && patch.description !== before.description) {
    data.description = patch.description || null;
    activityLines.push("Description updated.");
  }
  if (patch.status !== undefined && patch.status !== before.status) {
    data.status = patch.status;
    if (patch.status === "COMPLETED") data.progress = 100;
    activityLines.push(`Status changed to "${patch.status.replace("_", " ")}".`);
  }
  if (patch.dueDate !== undefined) {
    const nextDue = new Date(patch.dueDate);
    if (nextDue.getTime() !== before.dueDate.getTime()) {
      data.dueDate = nextDue;
      activityLines.push("Due date updated.");
    }
  }
  if (patch.priority !== undefined && patch.priority !== before.priority) {
    data.priority = patch.priority;
    activityLines.push(`Priority changed to "${patch.priority}".`);
  }
  if (patch.progress !== undefined && patch.progress !== before.progress) {
    data.progress = Math.max(0, Math.min(100, patch.progress));
    activityLines.push(`Progress updated to ${data.progress}%.`);
  }
  if (patch.notes !== undefined && patch.notes !== before.notes) {
    data.notes = patch.notes || null;
    activityLines.push("Internal notes updated.");
  }

  if (Object.keys(data).length === 0) return { success: true, data: undefined };

  const updated = await db.milestone.update({ where: { id: milestoneId }, data });

  await Promise.all(activityLines.map((line) => logMilestoneActivity(milestoneId, "Updated", line, user.id)));

  if (patch.status === "COMPLETED" && before.status !== "COMPLETED") {
    const stakeholders = await getChainStakeholderIds(access.chainId);
    await notifyUsers(
      stakeholders,
      {
        type: "MILESTONE_COMPLETED",
        title: "Milestone Completed",
        body: `${user.name} marked "${updated.name}" as completed.`,
      },
      user.id
    );
  }

  return { success: true, data: undefined };
}
