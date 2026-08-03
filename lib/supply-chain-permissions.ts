// Central permission resolver for the Supply Chain workspace. Every server
// action and query funnels through this so the access rules live in one
// place: Owner > Admin > Shared Team Member > Shared Buyer > Shared Supplier.

import type { ShareRole } from "@/lib/generated/prisma/enums";

export type MilestoneEditScope = "ALL" | "ASSIGNED" | "NONE";

export interface SupplyChainAccess {
  canView: boolean;
  isOwner: boolean;
  canEditChain: boolean;
  canComment: boolean;
  canShare: boolean;
  milestoneEditScope: MilestoneEditScope;
}

const NO_ACCESS: SupplyChainAccess = {
  canView: false,
  isOwner: false,
  canEditChain: false,
  canComment: false,
  canShare: false,
  milestoneEditScope: "NONE",
};

export function resolveSupplyChainAccess(input: {
  userId: string;
  userRole: "ADMIN" | "BUYER" | "SUPPLIER";
  chain: { ownerId: string };
  shareRole: ShareRole | null;
}): SupplyChainAccess {
  const { userId, userRole, chain, shareRole } = input;
  const isOwner = userId === chain.ownerId;
  const isAdmin = userRole === "ADMIN";

  if (isOwner || isAdmin) {
    return { canView: true, isOwner, canEditChain: true, canComment: true, canShare: true, milestoneEditScope: "ALL" };
  }

  switch (shareRole) {
    case "TEAM_EDIT":
      return { canView: true, isOwner: false, canEditChain: true, canComment: true, canShare: false, milestoneEditScope: "ALL" };
    case "TEAM_VIEW":
      return { canView: true, isOwner: false, canEditChain: false, canComment: false, canShare: false, milestoneEditScope: "NONE" };
    case "BUYER_COMMENT":
      return { canView: true, isOwner: false, canEditChain: false, canComment: true, canShare: false, milestoneEditScope: "NONE" };
    case "BUYER_VIEW":
      return { canView: true, isOwner: false, canEditChain: false, canComment: false, canShare: false, milestoneEditScope: "NONE" };
    case "SUPPLIER_UPDATE":
      return { canView: true, isOwner: false, canEditChain: false, canComment: true, canShare: false, milestoneEditScope: "ASSIGNED" };
    case "SUPPLIER_VIEW":
      return { canView: true, isOwner: false, canEditChain: false, canComment: false, canShare: false, milestoneEditScope: "NONE" };
    default:
      return NO_ACCESS;
  }
}

export function canEditMilestone(access: SupplyChainAccess, isAssignee: boolean): boolean {
  if (access.milestoneEditScope === "ALL") return true;
  if (access.milestoneEditScope === "ASSIGNED") return isAssignee;
  return false;
}

/** Default share role auto-granted to the buyer/supplier picked when a chain is created. */
export const DEFAULT_BUYER_SHARE_ROLE: ShareRole = "BUYER_COMMENT";
export const DEFAULT_SUPPLIER_SHARE_ROLE: ShareRole = "SUPPLIER_UPDATE";

export const SHARE_ROLE_LABELS: Record<ShareRole, string> = {
  TEAM_EDIT: "Team — Can edit",
  TEAM_VIEW: "Team — View only",
  BUYER_VIEW: "Buyer — View only",
  BUYER_COMMENT: "Buyer — Can comment",
  SUPPLIER_VIEW: "Supplier — View only",
  SUPPLIER_UPDATE: "Supplier — Can update assigned milestones",
};
