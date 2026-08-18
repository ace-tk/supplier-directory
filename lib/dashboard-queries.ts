// Real, DB-backed data for the Admin dashboard home page. No fabricated
// numbers anywhere here — every value is a direct count/sum/aggregate, or
// explicitly omitted (no trend) when there isn't enough history to compute
// one honestly. Mirrors the same payment-summary math already used by
// lib/invoicing/queries.ts's getDashboardStatsForOwner, just un-scoped from
// a single ownerId to platform-wide (nothing existing already does that).

import { startOfMonth, endOfMonth, subMonths } from "date-fns";
import Decimal from "decimal.js";
import { db } from "@/lib/db";
import { computeInvoicePaymentSummary } from "@/lib/invoicing/payments";
import { formatRelativeTime } from "@/utils/format";

function dec(value: { toString(): string } | null | undefined): string {
  return value == null ? "0" : value.toString();
}

export interface AdminDashboardStats {
  activeSuppliers: number;
  crmContacts: number;
  pendingInvoices: number;
  revenueMTD: string;
  /** Real vs-last-month % change — null when last month had zero revenue
   * (can't honestly express a percentage against zero). */
  revenueTrendPct: number | null;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [activeSuppliers, crmContacts, thisMonthSales, lastMonthSales, openSalesInvoices] = await Promise.all([
    db.supplierListing.count(),
    db.conversation.count(),
    db.invoice.findMany({
      where: { type: "SALES", archivedAt: null, invoiceDate: { gte: monthStart, lte: now } },
      select: { grandTotal: true },
    }),
    db.invoice.findMany({
      where: { type: "SALES", archivedAt: null, invoiceDate: { gte: lastMonthStart, lte: lastMonthEnd } },
      select: { grandTotal: true },
    }),
    db.invoice.findMany({
      where: { type: "SALES", archivedAt: null, status: { notIn: ["PAID", "CANCELLED"] } },
      select: { grandTotal: true, payments: { select: { amount: true } } },
    }),
  ]);

  const revenueMTD = thisMonthSales.reduce((acc, inv) => acc.plus(new Decimal(dec(inv.grandTotal))), new Decimal(0));
  const revenueLastMonth = lastMonthSales.reduce((acc, inv) => acc.plus(new Decimal(dec(inv.grandTotal))), new Decimal(0));
  const revenueTrendPct = revenueLastMonth.gt(0)
    ? revenueMTD.minus(revenueLastMonth).div(revenueLastMonth).times(100).toDecimalPlaces(0).toNumber()
    : null;

  const pendingInvoices = openSalesInvoices.filter((inv) => {
    const { balanceDue } = computeInvoicePaymentSummary(
      dec(inv.grandTotal),
      inv.payments.map((p) => ({ amount: dec(p.amount) }))
    );
    return new Decimal(balanceDue).gt(0);
  }).length;

  return {
    activeSuppliers,
    crmContacts,
    pendingInvoices,
    revenueMTD: revenueMTD.toFixed(2),
    revenueTrendPct,
  };
}

export interface AdminGettingStartedState {
  hasSupplier: boolean;
  hasBuyer: boolean;
  hasProduct: boolean;
  hasInvoice: boolean;
  hasFreelancer: boolean;
}

export async function getAdminGettingStarted(): Promise<AdminGettingStartedState> {
  const [supplierCount, buyerCount, productCount, invoiceCount, freelancerCount] = await Promise.all([
    db.supplierListing.count(),
    db.user.count({ where: { role: "BUYER" } }),
    db.catalogRow.count(),
    db.invoice.count(),
    db.user.count({ where: { role: "FREELANCER" } }),
  ]);

  return {
    hasSupplier: supplierCount > 0,
    hasBuyer: buyerCount > 0,
    hasProduct: productCount > 0,
    hasInvoice: invoiceCount > 0,
    hasFreelancer: freelancerCount > 0,
  };
}

export interface AdminTaskItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface AdminTasksState {
  tasks: AdminTaskItem[];
  completedCount: number;
  totalCount: number;
}

/** Reuses the real CRM Task model (created today via the CRM Inbox UI) —
 * no separate admin task system exists, and the task's own instructions
 * say not to build one just for this dashboard. */
export async function getAdminTasks(): Promise<AdminTasksState> {
  const [tasks, completedCount, totalCount] = await Promise.all([
    db.task.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, completed: true } }),
    db.task.count({ where: { completed: true } }),
    db.task.count(),
  ]);
  return { tasks, completedCount, totalCount };
}

export interface AdminActivityItem {
  id: string;
  kind: "invoice" | "supplier" | "buyer" | "article" | "conversation";
  title: string;
  meta: string;
  createdAt: Date;
  relativeTime: string;
}

/** No generic AuditLog/cross-module activity table exists in this schema —
 * merged live from the newest rows of the models that actually have a
 * createdAt, same "recent" idiom already used elsewhere (orderBy createdAt
 * desc, take N). */
export async function getAdminRecentActivity(limit = 7): Promise<AdminActivityItem[]> {
  const take = 5;
  const [invoices, suppliers, buyers, articles, conversations] = await Promise.all([
    db.invoice.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, invoiceNumber: true, type: true, grandTotal: true, currency: true, createdAt: true },
    }),
    db.user.findMany({
      where: { role: "SUPPLIER" },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, name: true, createdAt: true, supplier: { select: { companyName: true } } },
    }),
    db.user.findMany({
      where: { role: "BUYER" },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, name: true, createdAt: true, buyer: { select: { companyName: true } } },
    }),
    db.article.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, url: true, createdAt: true },
    }),
    db.conversation.findMany({
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, createdAt: true, supplier: { select: { companyName: true } } },
    }),
  ]);

  const items: AdminActivityItem[] = [
    ...invoices.map((i) => ({
      id: `invoice-${i.id}`,
      kind: "invoice" as const,
      title: `Invoice ${i.invoiceNumber} created`,
      meta: `${i.currency} ${dec(i.grandTotal)} · ${i.type}`,
      createdAt: i.createdAt,
      relativeTime: "",
    })),
    ...suppliers.map((s) => ({
      id: `supplier-${s.id}`,
      kind: "supplier" as const,
      title: "New supplier joined",
      meta: s.supplier?.companyName ?? s.name,
      createdAt: s.createdAt,
      relativeTime: "",
    })),
    ...buyers.map((b) => ({
      id: `buyer-${b.id}`,
      kind: "buyer" as const,
      title: "New buyer joined",
      meta: b.buyer?.companyName ?? b.name,
      createdAt: b.createdAt,
      relativeTime: "",
    })),
    ...articles.map((a) => ({
      id: `article-${a.id}`,
      kind: "article" as const,
      title: "Article added",
      meta: a.title ?? a.url,
      createdAt: a.createdAt,
      relativeTime: "",
    })),
    ...conversations.map((c) => ({
      id: `conversation-${c.id}`,
      kind: "conversation" as const,
      title: "CRM conversation started",
      meta: c.supplier?.companyName ?? "Unknown supplier",
      createdAt: c.createdAt,
      relativeTime: "",
    })),
  ];

  return items
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((item) => ({ ...item, relativeTime: formatRelativeTime(item.createdAt) }));
}
