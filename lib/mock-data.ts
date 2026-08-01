// Mock data for the Buyer/Supplier portal dashboards and list pages.
// Every getter takes a stable key (usually the session user id) and derives
// deterministic-but-varied records from it, plus real seeded product/supplier
// names so lists don't feel like lorem ipsum. Swap the body of any getter for
// a real API call later — call sites only depend on the return shape.

import { PRODUCTS } from "@/data/products";
import { SUPPLIERS } from "@/data/suppliers";
import type { Supplier } from "@/types/supplier";

function toSupplier(s: (typeof SUPPLIERS)[number]): Supplier {
  return { ...s, notes: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" };
}

export function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function pick<T>(arr: T[], seed: string): T {
  return arr[hashString(seed) % arr.length];
}

export function dateAgo(days: number): string {
  const d = new Date("2026-08-01T00:00:00Z");
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function formatMockDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export type OrderStatus = "Processing" | "Shipped" | "Delivered" | "Cancelled";
export interface OrderRecord {
  id: string;
  productName: string;
  counterpartyName: string;
  quantity: string;
  total: string;
  status: OrderStatus;
  date: string;
}

const ORDER_STATUSES: OrderStatus[] = ["Processing", "Shipped", "Delivered", "Delivered", "Cancelled"];

function generateOrders(key: string, perspective: "buyer" | "supplier", count: number): OrderRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const product = pick(PRODUCTS, `${key}-order-product-${i}`);
    const supplier = pick(SUPPLIERS, `${key}-order-supplier-${i}`);
    const qty = 50 + (hashString(`${key}-order-qty-${i}`) % 450);
    const unitPrice = 200 + (hashString(`${key}-order-price-${i}`) % 800);
    return {
      id: `ORD-${(hashString(`${key}-${i}`) % 90000) + 10000}`,
      productName: product.name,
      counterpartyName: perspective === "buyer" ? supplier.companyName : `${supplier.city} Trading Co.`,
      quantity: `${qty} pcs`,
      total: `₹${(qty * unitPrice).toLocaleString("en-IN")}`,
      status: pick(ORDER_STATUSES, `${key}-order-status-${i}`),
      date: dateAgo(i * 4 + (hashString(`${key}-order-day-${i}`) % 5)),
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBuyerOrders(userId: string): OrderRecord[] {
  return generateOrders(userId, "buyer", 8);
}

export function getSupplierOrders(userId: string): OrderRecord[] {
  return generateOrders(userId, "supplier", 8);
}

// ---------------------------------------------------------------------------
// Counter offers
// ---------------------------------------------------------------------------
export type CounterOfferStatus = "Pending" | "Accepted" | "Rejected" | "Countered";
export interface CounterOfferRecord {
  id: string;
  productName: string;
  counterpartyName: string;
  originalPrice: string;
  offerPrice: string;
  quantity: string;
  status: CounterOfferStatus;
  date: string;
}

const OFFER_STATUSES: CounterOfferStatus[] = ["Pending", "Accepted", "Rejected", "Countered"];

function generateCounterOffers(key: string, count: number): CounterOfferRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const product = pick(PRODUCTS, `${key}-offer-product-${i}`);
    const supplier = pick(SUPPLIERS, `${key}-offer-supplier-${i}`);
    const offerPrice = 180 + (hashString(`${key}-offer-price-${i}`) % 600);
    const qty = 50 + (hashString(`${key}-offer-qty-${i}`) % 300);
    return {
      id: `${key}-offer-${i}`,
      productName: product.name,
      counterpartyName: supplier.companyName,
      originalPrice: product.priceRange ?? "N/A",
      offerPrice: `₹${offerPrice} per pc`,
      quantity: `${qty} pcs`,
      status: pick(OFFER_STATUSES, `${key}-offer-status-${i}`),
      date: dateAgo(i * 3 + (hashString(`${key}-offer-day-${i}`) % 4)),
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBuyerCounterOffers(userId: string): CounterOfferRecord[] {
  return generateCounterOffers(`buyer-${userId}`, 6);
}

export function getSupplierCounterOffers(userId: string): CounterOfferRecord[] {
  return generateCounterOffers(`supplier-${userId}`, 6);
}

// ---------------------------------------------------------------------------
// Video requests
// ---------------------------------------------------------------------------
export type VideoRequestStatus = "Pending" | "Fulfilled" | "Declined";
export interface VideoRequestRecord {
  id: string;
  productName: string;
  counterpartyName: string;
  status: VideoRequestStatus;
  date: string;
}

const VIDEO_STATUSES: VideoRequestStatus[] = ["Pending", "Fulfilled", "Fulfilled", "Declined"];

function generateVideoRequests(key: string, count: number): VideoRequestRecord[] {
  return Array.from({ length: count }, (_, i) => {
    const product = pick(PRODUCTS, `${key}-video-product-${i}`);
    const supplier = pick(SUPPLIERS, `${key}-video-supplier-${i}`);
    return {
      id: `${key}-video-${i}`,
      productName: product.name,
      counterpartyName: supplier.companyName,
      status: pick(VIDEO_STATUSES, `${key}-video-status-${i}`),
      date: dateAgo(i * 5 + (hashString(`${key}-video-day-${i}`) % 4)),
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getBuyerVideoRequests(userId: string): VideoRequestRecord[] {
  return generateVideoRequests(`buyer-${userId}`, 5);
}

export function getSupplierVideoRequests(userId: string): VideoRequestRecord[] {
  return generateVideoRequests(`supplier-${userId}`, 5);
}

// ---------------------------------------------------------------------------
// Buyer enquiries (supplier-side inbox)
// ---------------------------------------------------------------------------
export type EnquiryStatus = "New" | "Replied" | "Closed";
export interface EnquiryRecord {
  id: string;
  buyerName: string;
  company: string;
  productName: string;
  message: string;
  status: EnquiryStatus;
  date: string;
}

const ENQUIRY_STATUSES: EnquiryStatus[] = ["New", "Replied", "Replied", "Closed"];
const BUYER_NAMES = ["Ananya Rao", "Marcus Lee", "Fatima Al-Sayed", "David Kim", "Priya Nair", "Tom Becker"];
const ENQUIRY_MESSAGES = [
  "Interested in bulk pricing for 1000+ units. Can you share your best quote?",
  "Do you offer private labeling and custom packaging?",
  "What's your typical lead time for international shipping?",
  "Can you send physical samples before we place a bulk order?",
  "Looking for a long-term supply partnership — what are your export certifications?",
];

export function getSupplierEnquiries(userId: string): EnquiryRecord[] {
  const key = `enquiry-${userId}`;
  return Array.from({ length: 7 }, (_, i) => {
    const product = pick(PRODUCTS, `${key}-product-${i}`);
    return {
      id: `${key}-${i}`,
      buyerName: pick(BUYER_NAMES, `${key}-name-${i}`),
      company: `${pick(BUYER_NAMES, `${key}-name-${i}`).split(" ")[1]} Trading LLC`,
      productName: product.name,
      message: pick(ENQUIRY_MESSAGES, `${key}-msg-${i}`),
      status: pick(ENQUIRY_STATUSES, `${key}-status-${i}`),
      date: dateAgo(i * 2 + (hashString(`${key}-day-${i}`) % 3)),
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ---------------------------------------------------------------------------
// Team members (supplier-side)
// ---------------------------------------------------------------------------
export type TeamRole = "Owner" | "Manager" | "Sales" | "Support";
export interface TeamMemberRecord {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: "Active" | "Invited";
}

export function getTeamMembers(userId: string, ownerName: string, ownerEmail: string): TeamMemberRecord[] {
  const key = `team-${userId}`;
  const names = ["Rahul Verma", "Sara Ahmed", "Wei Zhang", "Neha Kapoor"];
  const roles: TeamRole[] = ["Manager", "Sales", "Sales", "Support"];
  const members: TeamMemberRecord[] = [
    { id: `${key}-owner`, name: ownerName, email: ownerEmail, role: "Owner", status: "Active" },
  ];
  names.forEach((name, i) => {
    members.push({
      id: `${key}-${i}`,
      name,
      email: `${name.toLowerCase().replace(" ", ".")}@company.com`,
      role: roles[i],
      status: hashString(`${key}-status-${i}`) % 3 === 0 ? "Invited" : "Active",
    });
  });
  return members;
}

export type ProductStatus = "Live" | "Draft" | "Out of Stock";
const PRODUCT_STATUSES: ProductStatus[] = ["Live", "Live", "Live", "Draft", "Out of Stock"];

export function getSupplierProducts(userId: string) {
  const key = `products-${userId}`;
  const count = 8 + (hashString(key) % 6);
  const shuffled = [...PRODUCTS].sort((a, b) => hashString(`${key}-${a.id}`) - hashString(`${key}-${b.id}`));
  return shuffled.slice(0, count).map((p, i) => ({
    ...p,
    status: pick(PRODUCT_STATUSES, `${key}-status-${i}`),
    views: 50 + (hashString(`${key}-views-${i}`) % 950),
  }));
}

// ---------------------------------------------------------------------------
// Saved suppliers / recently viewed products / downloads (buyer-side)
// ---------------------------------------------------------------------------
export function getSavedSuppliers(userId: string): Supplier[] {
  const key = `saved-${userId}`;
  const count = 4 + (hashString(key) % 4);
  const shuffled = [...SUPPLIERS].sort((a, b) => hashString(`${key}-${a.id}`) - hashString(`${key}-${b.id}`));
  return shuffled.slice(0, count).map(toSupplier);
}

export function getRecentlyViewedProducts(userId: string) {
  const key = `viewed-${userId}`;
  const count = 6;
  const shuffled = [...PRODUCTS].sort((a, b) => hashString(`${key}-${a.id}`) - hashString(`${key}-${b.id}`));
  return shuffled.slice(0, count);
}

export interface DownloadRecord {
  id: string;
  fileName: string;
  type: "Product Details" | "Supplier Details";
  date: string;
}

export function getDownloads(userId: string): DownloadRecord[] {
  const key = `downloads-${userId}`;
  return Array.from({ length: 6 }, (_, i) => {
    const isProduct = hashString(`${key}-type-${i}`) % 2 === 0;
    const name = isProduct
      ? pick(PRODUCTS, `${key}-product-${i}`).name
      : pick(SUPPLIERS, `${key}-supplier-${i}`).companyName;
    return {
      id: `${key}-${i}`,
      fileName: `${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.txt`,
      type: (isProduct ? "Product Details" : "Supplier Details") as DownloadRecord["type"],
      date: dateAgo(i * 3 + (hashString(`${key}-day-${i}`) % 4)),
    };
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getProfileCompletion(userId: string): number {
  return 55 + (hashString(`profile-${userId}`) % 40); // 55-94%
}

// ---------------------------------------------------------------------------
// Supplier analytics
// ---------------------------------------------------------------------------
export interface AnalyticsPoint {
  label: string;
  value: number;
}

export function getSupplierAnalytics(userId: string) {
  const key = `analytics-${userId}`;
  const months = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];
  const views: AnalyticsPoint[] = months.map((label, i) => ({
    label,
    value: 400 + (hashString(`${key}-views-${i}`) % 1600),
  }));
  const topProducts = [...PRODUCTS]
    .sort((a, b) => hashString(`${key}-${a.id}`) - hashString(`${key}-${b.id}`))
    .slice(0, 5)
    .map((p, i) => ({ name: p.name, views: 200 + (hashString(`${key}-top-${i}`) % 900) }))
    .sort((a, b) => b.views - a.views);

  return {
    totalViews: views.reduce((sum, v) => sum + v.value, 0),
    viewsTrend: views,
    topProducts,
    conversionRate: 3 + (hashString(`${key}-conv`) % 8),
  };
}
