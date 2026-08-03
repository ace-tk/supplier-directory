"use server";

import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { notifyUsers } from "@/lib/notifications";
import { supplyChainPath } from "@/lib/supply-chain-ui";
import { getAccessForChain } from "@/lib/supply-chain-queries";
import type { ActionResult } from "@/services/supply-chain";
import type { ShareRole } from "@/types/supply-chain";

export interface ShareableUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "BUYER" | "SUPPLIER";
  companyName: string;
}

export async function getShareableUsersAction(): Promise<ShareableUser[]> {
  const users = await db.user.findMany({
    where: { role: { in: ["ADMIN", "BUYER", "SUPPLIER"] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      buyer: { select: { companyName: true } },
      supplier: { select: { companyName: true } },
    },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as ShareableUser["role"],
    companyName: u.buyer?.companyName ?? u.supplier?.companyName ?? (u.role === "ADMIN" ? "SupplyBase Team" : ""),
  }));
}

export async function shareSupplyChainAction(
  chainId: string,
  targetUserId: string,
  role: ShareRole
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await getAccessForChain(chainId, user.id, user.role);
  if (!result) return { success: false, error: "Supply chain not found." };
  if (!result.access.canShare) return { success: false, error: "Only the owner can share this supply chain." };
  if (targetUserId === user.id) return { success: false, error: "You already have access." };

  const [chain, target] = await Promise.all([
    db.supplyChain.findUnique({ where: { id: chainId }, select: { name: true } }),
    db.user.findUnique({ where: { id: targetUserId }, select: { id: true, name: true, role: true } }),
  ]);
  if (!target) return { success: false, error: "User not found." };

  await db.supplyChainShare.upsert({
    where: { supplyChainId_userId: { supplyChainId: chainId, userId: targetUserId } },
    create: { supplyChainId: chainId, userId: targetUserId, role, sharedById: user.id },
    update: { role },
  });

  await notifyUsers(
    [target.id],
    {
      type: "SUPPLY_CHAIN_SHARED",
      title: "Supply Chain Shared With You",
      body: `${user.name} shared "${chain?.name}" with you.`,
      link: supplyChainPath(target.role, chainId),
    },
    user.id
  );

  return { success: true, data: undefined };
}

export async function unshareSupplyChainAction(chainId: string, targetUserId: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { success: false, error: "You must be signed in." };

  const result = await getAccessForChain(chainId, user.id, user.role);
  if (!result) return { success: false, error: "Supply chain not found." };
  if (!result.access.canShare) return { success: false, error: "Only the owner can manage sharing." };

  await db.supplyChainShare
    .delete({ where: { supplyChainId_userId: { supplyChainId: chainId, userId: targetUserId } } })
    .catch(() => null);

  return { success: true, data: undefined };
}
