export type SupplyChainPriority = "Low" | "Medium" | "High" | "Urgent";
export type SupplyChainStatus = "Active" | "Delayed" | "Completed" | "In Progress";

export type MilestoneStatus = "Completed" | "In Progress" | "Upcoming" | "Delayed";
export type BoardColumn = "Planning" | "In Progress" | "Review" | "Completed";
export const BOARD_COLUMNS: BoardColumn[] = ["Planning", "In Progress", "Review", "Completed"];

export interface AssignedUser {
  id: string;
  name: string;
  colorClass: string;
}

export interface Milestone {
  id: string;
  name: string;
  status: MilestoneStatus;
  boardColumn: BoardColumn;
  dueDate: string;
  progress: number;
  assignees: AssignedUser[];
  order: number;
}

export interface SupplyChainRecord {
  id: string;
  name: string;
  orderName: string;
  orderNumber: string;
  buyerName: string;
  supplierName: string;
  expectedDelivery: string;
  priority: SupplyChainPriority;
  description: string;
  status: SupplyChainStatus;
  milestones: Milestone[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplyChainAnalytics {
  activeCount: number;
  delayedCount: number;
  completedCount: number;
  inProgressCount: number;
  upcomingDeadlines: number;
}
