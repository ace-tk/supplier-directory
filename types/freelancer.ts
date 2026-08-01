export type PaymentStatus = "Paid" | "Pending" | "Overdue";
export type Availability = "Available" | "Busy" | "Unavailable";
export type FreelancerStatus = "Active" | "Deactivated";

export interface FreelancerRecord {
  id: string;
  name: string;
  email: string;
  skills: string[];
  assignedClients: string[];
  assignedSuppliers: string[];
  activeProjects: number;
  paymentStatus: PaymentStatus;
  performanceScore: number;
  availability: Availability;
  status: FreelancerStatus;
}
