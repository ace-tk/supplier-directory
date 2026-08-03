"use server";

import * as store from "@/lib/supply-chain-store";
import type { SupplyChainRecord, SupplyChainPriority, BoardColumn } from "@/types/supply-chain";

export type SupplyChainActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createSupplyChainAction(input: {
  name: string;
  orderName: string;
  orderNumber: string;
  buyerName: string;
  supplierName: string;
  expectedDelivery: string;
  priority: SupplyChainPriority;
  description: string;
}): Promise<SupplyChainActionResult<SupplyChainRecord>> {
  if (!input.name.trim() || !input.orderName.trim() || !input.buyerName.trim() || !input.supplierName.trim()) {
    return { success: false, error: "Please fill in all required fields." };
  }
  const chain = store.createSupplyChain(input);
  return { success: true, data: chain };
}

export async function reorderMilestonesAction(
  chainId: string,
  orderedMilestoneIds: string[]
): Promise<SupplyChainActionResult<SupplyChainRecord>> {
  const chain = store.reorderMilestones(chainId, orderedMilestoneIds);
  if (!chain) return { success: false, error: "Supply chain not found." };
  return { success: true, data: chain };
}

export async function updateMilestoneColumnAction(
  chainId: string,
  milestoneId: string,
  column: BoardColumn
): Promise<SupplyChainActionResult<SupplyChainRecord>> {
  const chain = store.updateMilestoneColumn(chainId, milestoneId, column);
  if (!chain) return { success: false, error: "Milestone not found." };
  return { success: true, data: chain };
}

export async function addMilestoneAction(
  chainId: string,
  input: { name: string; afterMilestoneId?: string; beforeMilestoneId?: string }
): Promise<SupplyChainActionResult<SupplyChainRecord>> {
  if (!input.name.trim()) return { success: false, error: "Milestone name is required." };
  const chain = store.addMilestone(chainId, input);
  if (!chain) return { success: false, error: "Supply chain not found." };
  return { success: true, data: chain };
}
