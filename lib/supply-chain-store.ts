// Server-only in-memory "database" for the Supply Chain workspace — same
// shared-across-requests contract as lib/buyer-leads-store.ts. Only import
// this from Server Components / Server Actions (services/supply-chain.ts);
// never from a "use client" module. Swap the array + functions below for
// real `db.supplyChain.*` Prisma calls later — callers only depend on these
// function signatures.

import type {
  SupplyChainRecord,
  SupplyChainAnalytics,
  SupplyChainPriority,
  Milestone,
  MilestoneStatus,
  BoardColumn,
  AssignedUser,
} from "@/types/supply-chain";

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function dateFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const PEOPLE: AssignedUser[] = [
  { id: "u1", name: "Aditi Sharma", colorClass: "bg-violet-500" },
  { id: "u2", name: "Rahul Verma", colorClass: "bg-blue-500" },
  { id: "u3", name: "Wei Chen", colorClass: "bg-emerald-500" },
  { id: "u4", name: "Fatima Noor", colorClass: "bg-amber-500" },
  { id: "u5", name: "Carlos Mendes", colorClass: "bg-rose-500" },
];

export const DEFAULT_MILESTONE_NAMES = [
  "Order Confirmed",
  "Raw Material",
  "Manufacturing",
  "Quality Check",
  "Packaging",
  "Dispatch",
  "Delivered",
];

function columnForStatus(status: MilestoneStatus): BoardColumn {
  if (status === "Completed") return "Completed";
  if (status === "In Progress" || status === "Delayed") return "In Progress";
  return "Planning";
}

function createDefaultMilestones(seedKey: string, currentIndex: number, delayedIndex?: number): Milestone[] {
  return DEFAULT_MILESTONE_NAMES.map((name, i) => {
    let status: MilestoneStatus;
    if (i === delayedIndex) status = "Delayed";
    else if (i < currentIndex) status = "Completed";
    else if (i === currentIndex) status = "In Progress";
    else status = "Upcoming";

    const progress = status === "Completed" ? 100 : status === "In Progress" || status === "Delayed" ? 35 + (hashString(`${seedKey}-${name}`) % 45) : 0;
    const assigneeCount = 1 + (hashString(`${seedKey}-${name}-count`) % 2);
    const assignees = Array.from({ length: assigneeCount }, (_, j) => PEOPLE[hashString(`${seedKey}-${name}-${j}`) % PEOPLE.length]);

    return {
      id: makeId(`ms-${seedKey}-${i}`),
      name,
      status,
      boardColumn: columnForStatus(status),
      dueDate: dateFromNow((i - currentIndex) * 6),
      progress,
      assignees,
      order: i,
    };
  });
}

let chains: SupplyChainRecord[] = [
  {
    id: "sc-1",
    name: "Winter Hoodie Program",
    orderName: "Cotton Fleece Hoodies — Batch 4",
    orderNumber: "PO-88214",
    buyerName: "Urban Threads Retail",
    supplierName: "Rajasthan Textile Mills",
    expectedDelivery: dateFromNow(18),
    priority: "High",
    description: "Recurring winter program — 5,000 units across 4 colorways, export-ready packaging required.",
    status: "In Progress",
    milestones: createDefaultMilestones("sc-1", 2),
    createdAt: dateFromNow(-14),
    updatedAt: dateFromNow(-1),
  },
  {
    id: "sc-2",
    name: "Trial Sneaker Order",
    orderName: "Court Classic Sneakers — Trial",
    orderNumber: "PO-88301",
    buyerName: "Pacific Footwear Co.",
    supplierName: "Shenzhen TechCore Electronics",
    expectedDelivery: dateFromNow(4),
    priority: "Urgent",
    description: "First trial order ahead of a larger commitment — quality check is the critical path.",
    status: "Delayed",
    milestones: createDefaultMilestones("sc-2", 3, 3),
    createdAt: dateFromNow(-22),
    updatedAt: dateFromNow(0),
  },
  {
    id: "sc-3",
    name: "Export Handbag Collection",
    orderName: "Leather Handbags — Export Line",
    orderNumber: "PO-87990",
    buyerName: "Seoul Leather Imports",
    supplierName: "GlobalPack Solutions",
    expectedDelivery: dateFromNow(-2),
    priority: "Medium",
    description: "Completed and delivered — kept for reference and reorder.",
    status: "Completed",
    milestones: createDefaultMilestones("sc-3", 7),
    createdAt: dateFromNow(-40),
    updatedAt: dateFromNow(-2),
  },
];

export function getAllSupplyChains(): SupplyChainRecord[] {
  return [...chains].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getSupplyChainById(id: string): SupplyChainRecord | null {
  return chains.find((c) => c.id === id) ?? null;
}

function touch(chain: SupplyChainRecord): SupplyChainRecord {
  chain.updatedAt = new Date().toISOString();
  return chain;
}

export function createSupplyChain(input: {
  name: string;
  orderName: string;
  orderNumber: string;
  buyerName: string;
  supplierName: string;
  expectedDelivery: string;
  priority: SupplyChainPriority;
  description: string;
}): SupplyChainRecord {
  const id = makeId("sc");
  const now = new Date().toISOString();
  const chain: SupplyChainRecord = {
    id,
    ...input,
    status: "Active",
    milestones: createDefaultMilestones(id, 0),
    createdAt: now,
    updatedAt: now,
  };
  chains = [chain, ...chains];
  return chain;
}

export function reorderMilestones(chainId: string, orderedMilestoneIds: string[]): SupplyChainRecord | null {
  const chain = getSupplyChainById(chainId);
  if (!chain) return null;
  const byId = new Map(chain.milestones.map((m) => [m.id, m]));
  chain.milestones = orderedMilestoneIds
    .map((id, i) => {
      const m = byId.get(id);
      return m ? { ...m, order: i } : null;
    })
    .filter((m): m is Milestone => m !== null);
  return touch(chain);
}

export function updateMilestoneColumn(chainId: string, milestoneId: string, column: BoardColumn): SupplyChainRecord | null {
  const chain = getSupplyChainById(chainId);
  if (!chain) return null;
  const milestone = chain.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return null;
  milestone.boardColumn = column;
  return touch(chain);
}

export function addMilestone(
  chainId: string,
  input: { name: string; afterMilestoneId?: string; beforeMilestoneId?: string }
): SupplyChainRecord | null {
  const chain = getSupplyChainById(chainId);
  if (!chain) return null;

  const newMilestone: Milestone = {
    id: makeId(`ms-${chainId}`),
    name: input.name,
    status: "Upcoming",
    boardColumn: "Planning",
    dueDate: dateFromNow(7),
    progress: 0,
    assignees: [],
    order: 0,
  };

  const sorted = [...chain.milestones].sort((a, b) => a.order - b.order);
  let insertAt = sorted.length;
  if (input.beforeMilestoneId) {
    const idx = sorted.findIndex((m) => m.id === input.beforeMilestoneId);
    if (idx !== -1) insertAt = idx;
  } else if (input.afterMilestoneId) {
    const idx = sorted.findIndex((m) => m.id === input.afterMilestoneId);
    if (idx !== -1) insertAt = idx + 1;
  }
  sorted.splice(insertAt, 0, newMilestone);

  chain.milestones = sorted.map((m, i) => ({ ...m, order: i }));
  return touch(chain);
}

export function updateMilestone(
  chainId: string,
  milestoneId: string,
  patch: Partial<Pick<Milestone, "status" | "progress" | "dueDate">>
): SupplyChainRecord | null {
  const chain = getSupplyChainById(chainId);
  if (!chain) return null;
  const milestone = chain.milestones.find((m) => m.id === milestoneId);
  if (!milestone) return null;
  Object.assign(milestone, patch);
  return touch(chain);
}

export function getSupplyChainAnalytics(): SupplyChainAnalytics {
  const all = getAllSupplyChains();
  const soon = Date.now() + 7 * 24 * 60 * 60 * 1000;

  return {
    activeCount: all.filter((c) => c.status === "Active").length,
    delayedCount: all.filter((c) => c.status === "Delayed").length,
    completedCount: all.filter((c) => c.status === "Completed").length,
    inProgressCount: all.filter((c) => c.status === "In Progress").length,
    upcomingDeadlines: all.reduce(
      (sum, c) =>
        sum +
        c.milestones.filter(
          (m) => m.status !== "Completed" && new Date(m.dueDate).getTime() <= soon && new Date(m.dueDate).getTime() >= Date.now()
        ).length,
      0
    ),
  };
}
