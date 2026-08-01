// Mock freelancer service — same swap-later contract as inventory-service.ts.

import { SUPPLIERS } from "@/data/suppliers";
import { hashString, pick } from "@/lib/mock-data";
import type { FreelancerRecord, PaymentStatus, Availability } from "@/types/freelancer";

function mockLatency(ms = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const NAMES = [
  "Arjun Mehta", "Isabella Cruz", "Kenji Watanabe", "Layla Hassan", "Ola Adeyemi",
  "Sofia Rossi", "Ivan Petrov", "Meera Iyer", "Noah Fischer", "Chidi Okafor",
  "Hana Kobayashi", "Diego Fernandez",
];
const SKILL_POOL = [
  "Product Photography", "Copywriting", "Video Editing", "Graphic Design", "SEO",
  "Supplier Verification", "Quality Inspection", "Translation", "Logistics Coordination",
  "Social Media Marketing", "Data Entry", "Customer Support",
];
const BUYER_NAMES = ["Ananya Rao", "Marcus Lee", "Fatima Al-Sayed", "David Kim", "Priya Nair"];
const PAYMENT_STATUSES: PaymentStatus[] = ["Paid", "Paid", "Pending", "Overdue"];
const AVAILABILITY: Availability[] = ["Available", "Available", "Busy", "Unavailable"];

let freelancersCache: FreelancerRecord[] | null = null;

export function getFreelancers(): FreelancerRecord[] {
  if (freelancersCache) return freelancersCache;

  freelancersCache = NAMES.map((name, i) => {
    const key = `freelancer-${i}-${name}`;
    const skillCount = 2 + (hashString(`${key}-skillcount`) % 3);
    const skills = [...SKILL_POOL]
      .sort((a, b) => hashString(`${key}-${a}`) - hashString(`${key}-${b}`))
      .slice(0, skillCount);
    const clientCount = 1 + (hashString(`${key}-clients`) % 3);
    const supplierCount = 1 + (hashString(`${key}-suppliers`) % 3);

    return {
      id: `fl-${i}`,
      name,
      email: `${name.toLowerCase().replace(" ", ".")}@freelance.supplybase.com`,
      skills,
      assignedClients: Array.from({ length: clientCount }, (_, j) => pick(BUYER_NAMES, `${key}-client-${j}`)),
      assignedSuppliers: Array.from({ length: supplierCount }, (_, j) => pick(SUPPLIERS, `${key}-supplier-${j}`).companyName),
      activeProjects: hashString(`${key}-projects`) % 6,
      paymentStatus: pick(PAYMENT_STATUSES, `${key}-payment`),
      performanceScore: 55 + (hashString(`${key}-perf`) % 45),
      availability: pick(AVAILABILITY, `${key}-avail`),
      status: "Active",
    };
  });

  return freelancersCache;
}

// Mock mutations — swap for real `POST /api/freelancers/:id/...` calls later.
export async function assignTask(
  freelancerId: string,
  payload: { clientOrSupplier: string; taskTitle: string }
): Promise<{ success: true }> {
  await mockLatency(700);
  const freelancer = getFreelancers().find((f) => f.id === freelancerId);
  if (freelancer) {
    freelancer.activeProjects += 1;
    console.info("[mock] task assigned", freelancerId, payload);
  }
  return { success: true };
}

export async function deactivateFreelancer(id: string): Promise<{ success: true }> {
  await mockLatency();
  const freelancer = getFreelancers().find((f) => f.id === id);
  if (freelancer) freelancer.status = freelancer.status === "Active" ? "Deactivated" : "Active";
  return { success: true };
}
