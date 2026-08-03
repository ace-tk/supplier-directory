// Real, DB-backed read layer for the Supply Chain workspace (replaces the
// Phase 1 in-memory store). Every read here is permission-scoped — callers
// never see a chain/milestone the current user isn't allowed to view.

import { db } from "@/lib/db";
import { resolveSupplyChainAccess, type SupplyChainAccess } from "@/lib/supply-chain-permissions";
import type {
  SupplyChainRecord,
  SupplyChainAnalytics,
  MilestoneRecord,
  MilestoneDetail,
  ParticipantUser,
} from "@/types/supply-chain";

type UserWithProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  buyer: { companyName: string } | null;
  supplier: { companyName: string } | null;
};

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  buyer: { select: { companyName: true } },
  supplier: { select: { companyName: true } },
} as const;

function mapUser(user: UserWithProfile): ParticipantUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as ParticipantUser["role"],
    avatar: user.avatar,
    companyName: user.buyer?.companyName ?? user.supplier?.companyName ?? null,
  };
}

const milestoneListInclude = {
  participants: { include: { user: { select: userSelect } } },
  _count: { select: { media: true, attachments: true, comments: true } },
} as const;

const chainInclude = {
  milestones: { orderBy: { order: "asc" as const }, include: milestoneListInclude },
  shares: {
    include: {
      user: { select: userSelect },
      sharedBy: { select: userSelect },
    },
  },
};

type ChainWithRelations = NonNullable<Awaited<ReturnType<typeof fetchChainRaw>>>;

function fetchChainRaw(id: string) {
  return db.supplyChain.findUnique({ where: { id }, include: chainInclude });
}

function mapMilestone(m: ChainWithRelations["milestones"][number]): MilestoneRecord {
  return {
    id: m.id,
    supplyChainId: m.supplyChainId,
    name: m.name,
    description: m.description,
    status: m.status,
    boardColumn: m.boardColumn,
    priority: m.priority,
    dueDate: m.dueDate.toISOString(),
    progress: m.progress,
    notes: m.notes,
    order: m.order,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    assignees: m.participants
      .filter((p) => p.kind === "ASSIGNEE")
      .map((p) => ({ id: p.id, kind: p.kind, user: mapUser(p.user) })),
    tags: m.participants
      .filter((p) => p.kind === "TAG")
      .map((p) => ({ id: p.id, kind: p.kind, user: mapUser(p.user) })),
    mediaCount: m._count.media,
    attachmentCount: m._count.attachments,
    commentCount: m._count.comments,
  };
}

function mapChain(chain: ChainWithRelations): SupplyChainRecord {
  return {
    id: chain.id,
    name: chain.name,
    orderName: chain.orderName,
    orderNumber: chain.orderNumber,
    description: chain.description,
    priority: chain.priority,
    status: chain.status,
    expectedDelivery: chain.expectedDelivery.toISOString(),
    ownerId: chain.ownerId,
    buyerUserId: chain.buyerUserId,
    buyerName: chain.buyerName,
    supplierUserId: chain.supplierUserId,
    supplierName: chain.supplierName,
    createdAt: chain.createdAt.toISOString(),
    updatedAt: chain.updatedAt.toISOString(),
    milestones: chain.milestones.map(mapMilestone),
    shares: chain.shares.map((s) => ({
      id: s.id,
      role: s.role,
      user: mapUser(s.user),
      sharedBy: mapUser(s.sharedBy),
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

async function getShareRole(chainId: string, userId: string) {
  const share = await db.supplyChainShare.findUnique({
    where: { supplyChainId_userId: { supplyChainId: chainId, userId } },
  });
  return share?.role ?? null;
}

export async function getAccessibleSupplyChains(userId: string, role: string): Promise<SupplyChainRecord[]> {
  const chains =
    role === "ADMIN"
      ? await db.supplyChain.findMany({ include: chainInclude, orderBy: { updatedAt: "desc" } })
      : await db.supplyChain.findMany({
          where: {
            OR: [
              { ownerId: userId },
              { buyerUserId: userId },
              { supplierUserId: userId },
              { shares: { some: { userId } } },
            ],
          },
          include: chainInclude,
          orderBy: { updatedAt: "desc" },
        });

  return chains.map(mapChain);
}

export async function getSupplyChainWithAccess(
  id: string,
  userId: string,
  role: "ADMIN" | "BUYER" | "SUPPLIER"
): Promise<{ chain: SupplyChainRecord; access: SupplyChainAccess } | null> {
  const raw = await fetchChainRaw(id);
  if (!raw) return null;

  const shareRole = await getShareRole(id, userId);
  const access = resolveSupplyChainAccess({ userId, userRole: role, chain: { ownerId: raw.ownerId }, shareRole });
  if (!access.canView) return null;

  return { chain: mapChain(raw), access };
}

export async function getMilestoneDetail(
  milestoneId: string,
  userId: string,
  role: "ADMIN" | "BUYER" | "SUPPLIER"
): Promise<{ milestone: MilestoneDetail; access: SupplyChainAccess; isAssignee: boolean } | null> {
  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      ...milestoneListInclude,
      media: { include: { uploadedBy: { select: userSelect } }, orderBy: { createdAt: "desc" } },
      attachments: { include: { uploadedBy: { select: userSelect } }, orderBy: { createdAt: "desc" } },
      comments: { include: { author: { select: userSelect } }, orderBy: { createdAt: "desc" } },
      activities: { include: { actor: { select: userSelect } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!milestone) return null;

  const chain = await db.supplyChain.findUnique({ where: { id: milestone.supplyChainId } });
  if (!chain) return null;

  const shareRole = await getShareRole(chain.id, userId);
  const access = resolveSupplyChainAccess({ userId, userRole: role, chain: { ownerId: chain.ownerId }, shareRole });
  if (!access.canView) return null;

  const base = mapMilestone(milestone);
  const isAssignee = base.assignees.some((a) => a.user.id === userId);

  return {
    milestone: {
      ...base,
      media: milestone.media.map((m) => ({
        id: m.id,
        kind: m.kind,
        fileName: m.fileName,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
        dataUrl: m.dataUrl,
        uploadedBy: mapUser(m.uploadedBy),
        createdAt: m.createdAt.toISOString(),
      })),
      attachments: milestone.attachments.map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mimeType: a.mimeType,
        sizeBytes: a.sizeBytes,
        dataUrl: a.dataUrl,
        uploadedBy: mapUser(a.uploadedBy),
        createdAt: a.createdAt.toISOString(),
      })),
      comments: milestone.comments.map((c) => ({
        id: c.id,
        content: c.content,
        author: mapUser(c.author),
        parentCommentId: c.parentCommentId,
        edited: c.edited,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      activities: milestone.activities.map((a) => ({
        id: a.id,
        type: a.type,
        description: a.description,
        actor: a.actor ? mapUser(a.actor) : null,
        createdAt: a.createdAt.toISOString(),
      })),
    },
    access,
    isAssignee,
  };
}

/** Lightweight — activity only, skips media/attachments dataUrls. Used to refresh the drawer's Activity tab after a mutation elsewhere in the drawer without re-pulling large base64 payloads. */
export async function getMilestoneActivities(
  milestoneId: string,
  userId: string,
  role: "ADMIN" | "BUYER" | "SUPPLIER"
) {
  const milestone = await db.milestone.findUnique({ where: { id: milestoneId }, select: { supplyChainId: true } });
  if (!milestone) return null;

  const result = await getAccessForChain(milestone.supplyChainId, userId, role);
  if (!result || !result.access.canView) return null;

  const activities = await db.milestoneActivity.findMany({
    where: { milestoneId },
    include: { actor: { select: userSelect } },
    orderBy: { createdAt: "desc" },
  });

  return activities.map((a) => ({
    id: a.id,
    type: a.type,
    description: a.description,
    actor: a.actor ? mapUser(a.actor) : null,
    createdAt: a.createdAt.toISOString(),
  }));
}

export async function getSupplyChainAnalyticsForUser(userId: string, role: string): Promise<SupplyChainAnalytics> {
  const chains = await getAccessibleSupplyChains(userId, role);
  const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;

  return {
    activeCount: chains.filter((c) => c.status === "ACTIVE").length,
    delayedCount: chains.filter((c) => c.status === "DELAYED").length,
    completedCount: chains.filter((c) => c.status === "COMPLETED").length,
    inProgressCount: chains.filter((c) => c.status === "IN_PROGRESS").length,
    upcomingDeadlines: chains.reduce(
      (sum, c) =>
        sum +
        c.milestones.filter(
          (m) => m.status !== "COMPLETED" && new Date(m.dueDate).getTime() <= soon && new Date(m.dueDate).getTime() >= Date.now()
        ).length,
      0
    ),
  };
}

/** Lightweight access check for a chain, without hydrating the full record — used by mutation actions. */
export async function getAccessForChain(
  chainId: string,
  userId: string,
  role: "ADMIN" | "BUYER" | "SUPPLIER"
): Promise<{ access: SupplyChainAccess; ownerId: string } | null> {
  const chain = await db.supplyChain.findUnique({ where: { id: chainId }, select: { ownerId: true } });
  if (!chain) return null;
  const shareRole = await getShareRole(chainId, userId);
  const access = resolveSupplyChainAccess({ userId, userRole: role, chain: { ownerId: chain.ownerId }, shareRole });
  return { access, ownerId: chain.ownerId };
}

/** Same, but resolved from a milestoneId — used by comments/media/attachments/participants actions. */
export async function getAccessForMilestone(
  milestoneId: string,
  userId: string,
  role: "ADMIN" | "BUYER" | "SUPPLIER"
): Promise<{ access: SupplyChainAccess; chainId: string; isAssignee: boolean } | null> {
  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
    select: { supplyChainId: true, participants: { where: { userId, kind: "ASSIGNEE" } } },
  });
  if (!milestone) return null;

  const result = await getAccessForChain(milestone.supplyChainId, userId, role);
  if (!result) return null;

  return { access: result.access, chainId: milestone.supplyChainId, isAssignee: milestone.participants.length > 0 };
}

/** All userIds worth notifying about activity on a chain: owner, buyer, supplier, and every shared user. */
export async function getChainStakeholderIds(chainId: string): Promise<string[]> {
  const chain = await db.supplyChain.findUnique({
    where: { id: chainId },
    select: { ownerId: true, buyerUserId: true, supplierUserId: true, shares: { select: { userId: true } } },
  });
  if (!chain) return [];
  return [chain.ownerId, chain.buyerUserId, chain.supplierUserId, ...chain.shares.map((s) => s.userId)].filter(
    (id): id is string => !!id
  );
}

export { mapUser, userSelect };
