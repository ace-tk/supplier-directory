"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Receipt,
  TrendingUp,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Zap,
  NotebookText,
  ShoppingBag,
  Megaphone,
  FolderKanban,
  MessageSquare,
  BookOpen,
  Wallet,
  BarChart3,
  UserPlus,
  Upload,
  Warehouse,
  CalendarClock,
  Mail,
  MessageCircle,
  ArrowUpRight,
  Sparkles,
  ListChecks,
  FilePlus2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { IconTile, TONE_CLASS, type Tone } from "@/components/ui/icon-tile";
import { ProgressRing } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OrdersChart } from "@/components/dashboard/OrdersChart";
import { NetworkDonut } from "@/components/dashboard/NetworkDonut";
import type { NetworkCounts, OrdersPoint } from "@/lib/dashboard-chart-queries";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardTasksPanel } from "@/components/dashboard/DashboardTasksPanel";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/invoicing/ui";
import type { SessionUser } from "@/types/auth";
import type { AdminDashboardStats, AdminGettingStartedState, AdminTasksState, AdminActivityItem } from "@/lib/dashboard-queries";

const QUICK_ACTIONS: Array<{ label: string; description: string; icon: typeof Building2; tone: Tone; href: string }> = [
  { label: "Add Supplier", description: "Onboard a new supplier", icon: Building2, tone: "sky", href: "/directory" },
  { label: "New Contact", description: "Add a CRM contact", icon: Users, tone: "lav", href: "/crm" },
  { label: "Create Order", description: "Place a bulk order", icon: Wallet, tone: "mint", href: "/invoices/new" },
  { label: "View Reports", description: "Check analytics and insights", icon: BarChart3, tone: "peach", href: "/invoices/reports" },
  { label: "Add Buyer", description: "Invite and add a new buyer", icon: UserPlus, tone: "butter", href: "/buyer-directory" },
  { label: "Create Campaign", description: "Launch a marketing campaign", icon: Megaphone, tone: "rose", href: "/marketing/email-campaigns" },
  { label: "Upload Catalog", description: "Upload your product catalog", icon: Upload, tone: "sage", href: "/catalog" },
  { label: "Manage Inventory", description: "Track and manage inventory", icon: Warehouse, tone: "sky", href: "/inventory/admin" },
];

const QUICK_ADD_ITEMS: Array<{ label: string; href: string; icon: typeof Building2; tone: Tone }> = [
  { label: "Add Supplier", href: "/directory", icon: Building2, tone: "sky" },
  { label: "New Contact", href: "/crm", icon: Users, tone: "lav" },
  { label: "Create Invoice", href: "/invoices/new", icon: Receipt, tone: "mint" },
  { label: "Add Product", href: "/catalog/new", icon: ShoppingBag, tone: "sage" },
  { label: "Add Expense", href: "/invoices/expenses/new", icon: Wallet, tone: "peach" },
  { label: "Create Content", href: "/content/new", icon: NotebookText, tone: "rose" },
];

const CAMPAIGN_LINKS = [
  { label: "Email Campaigns", href: "/marketing/email-campaigns" },
  { label: "WhatsApp Campaigns", href: "/marketing/whatsapp-campaigns" },
  { label: "Promotional Campaigns", href: "/marketing/promotional-campaigns" },
  { label: "Newsletter", href: "/marketing/newsletter" },
  { label: "Scheduled Campaigns", href: "/marketing/scheduled-campaigns" },
  { label: "Campaign Analytics", href: "/marketing/analytics" },
  { label: "Buyer Campaigns", href: "/marketing/buyer-campaigns" },
  { label: "Supplier Campaigns", href: "/marketing/supplier-campaigns" },
];

const ACTIVITY_STYLE: Record<AdminActivityItem["kind"], { icon: typeof Building2; tone: Tone }> = {
  invoice: { icon: Receipt, tone: "mint" },
  supplier: { icon: Building2, tone: "sky" },
  buyer: { icon: Users, tone: "lav" },
  article: { icon: BookOpen, tone: "butter" },
  conversation: { icon: MessageSquare, tone: "rose" },
};

/** Pastel chip used for the tool-link row */
const CHIP = "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium outline-none transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] motion-reduce:transition-none";

const GRADIENT_FROM: Record<Tone, string> = {
  sky: "from-sky",
  mint: "from-mint",
  peach: "from-peach",
  lav: "from-lav",
  rose: "from-rose",
  butter: "from-butter",
  sage: "from-sage",
  primary: "from-soft",
};

const GETTING_STARTED_STEPS = (state: AdminGettingStartedState) => [
  { label: "Add your first supplier", done: state.hasSupplier, href: "/directory" },
  { label: "Add your first buyer", done: state.hasBuyer, href: "/buyer-directory" },
  { label: "Add your first product", done: state.hasProduct, href: "/catalog/new" },
  { label: "Create your first invoice", done: state.hasInvoice, href: "/invoices/new" },
  { label: "Add a freelancer", done: state.hasFreelancer, href: "/freelancers" },
];

interface DashboardOverviewProps {
  user: SessionUser;
  stats: AdminDashboardStats;
  gettingStarted: AdminGettingStartedState;
  tasksState: AdminTasksState;
  activity: AdminActivityItem[];
  ordersSeries?: OrdersPoint[];
  network?: NetworkCounts;
}

const greetingByHour = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

const roleLabel: Record<string, string> = {
  ADMIN: "Administrator",
  SUPPLIER: "Supplier",
  BUYER: "Buyer",
};

export function DashboardOverview({ user, stats, gettingStarted, tasksState, activity, ordersSeries, network }: DashboardOverviewProps) {
  const steps = GETTING_STARTED_STEPS(gettingStarted);
  const completedSteps = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedSteps / steps.length) * 100);

  const openTasks = tasksState.totalCount - tasksState.completedCount;
  const revenueTrend = stats.revenueTrendPct;

  const STATS: Array<{ label: string; value: number | string; icon: typeof Building2; tone: Tone; trend?: { label: string; direction: "up" | "down" | "flat" } }> = [
    { label: "Active Suppliers", value: stats.activeSuppliers, icon: Building2, tone: "sky" },
    { label: "CRM Contacts", value: stats.crmContacts, icon: Users, tone: "lav" },
    { label: "Pending Invoices", value: stats.pendingInvoices, icon: Receipt, tone: "mint" },
    {
      label: "Revenue MTD",
      value: formatMoney(stats.revenueMTD, "INR"),
      icon: TrendingUp,
      tone: "peach",
      // Only shown when there is a real previous month to compare against.
      trend: revenueTrend == null ? undefined : { label: `${revenueTrend > 0 ? "+" : ""}${revenueTrend}%`, direction: revenueTrend > 0 ? "up" : revenueTrend < 0 ? "down" : "flat" },
    },
  ];

  const stagger = (i: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.22, ease: "easeOut" as const, delay: i * 0.04 },
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Hero */}
      <motion.section {...stagger(0)} className="relative overflow-hidden rounded-[20px] bg-hero p-6 ring-1 ring-border sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <Badge variant="default" className="gap-1.5 bg-surface/70 text-pri-text">
              <Zap className="h-3 w-3" />
              {roleLabel[user.role] ?? user.role} account
            </Badge>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {greetingByHour()}, {user.name.split(" ")[0]}
            </h1>
            <p className="max-w-xl text-sm text-foreground/70">Here&apos;s what&apos;s happening across your workspace today.</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 text-xs font-medium tabular-nums">
                <ListChecks className="h-3.5 w-3.5 text-pri-text" /> {openTasks} open {openTasks === 1 ? "task" : "tasks"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 text-xs font-medium tabular-nums">
                <Sparkles className="h-3.5 w-3.5 text-pri-text" /> Setup {completedSteps}/{steps.length}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-3 py-1 text-xs font-medium tabular-nums">
                <Receipt className="h-3.5 w-3.5 text-pri-text" /> {stats.pendingInvoices} pending {stats.pendingInvoices === 1 ? "invoice" : "invoices"}
              </span>
            </div>
          </div>
          <Link href="/invoices/new" className={cn(buttonVariants({ size: "lg" }), "shrink-0 gap-2 self-start lg:self-auto")}>
            <FilePlus2 className="h-4 w-4" /> Create invoice
          </Link>
        </div>
      </motion.section>

      {/* Tool chips — horizontally scrollable pastel row */}
      <motion.div {...stagger(1)} className="-mx-4 overflow-x-auto px-4 pb-1 hide-scrollbar sm:mx-0 sm:px-0">
        <div className="flex w-max items-center gap-2 sm:w-auto sm:flex-wrap">
          <Link href="/content" className={cn(CHIP, TONE_CLASS.sky)}><NotebookText className="h-4 w-4" /> Content Management</Link>
          <Link href="/projects" className={cn(CHIP, TONE_CLASS.lav)}><FolderKanban className="h-4 w-4" /> Project Management</Link>
          <Link href="/shop" className={cn(CHIP, TONE_CLASS.mint)}><ShoppingBag className="h-4 w-4" /> Shop</Link>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(CHIP, TONE_CLASS.rose)}>
              <Megaphone className="h-4 w-4" /> Campaigns <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {CAMPAIGN_LINKS.map((c) => (
                <DropdownMenuItem key={c.href} render={<Link href={c.href} />}>
                  {c.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/marketing/scheduled-campaigns" className={cn(CHIP, TONE_CLASS.peach)}><CalendarClock className="h-4 w-4" /> Scheduled Campaigns</Link>
          <Link href="/marketing/email-campaigns" className={cn(CHIP, TONE_CLASS.butter)}><Mail className="h-4 w-4" /> Email Campaigns</Link>
          <Link href="/marketing/whatsapp-campaigns" className={cn(CHIP, TONE_CLASS.sage)}><MessageCircle className="h-4 w-4" /> WhatsApp Campaigns</Link>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((stat, i) => (
          <motion.div key={stat.label} {...stagger(i + 2)}>
            <StatCard {...stat} className="h-full" />
          </motion.div>
        ))}
      </div>

      {/* Charts — only when the page supplied the data */}
      {(ordersSeries || network) && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          {ordersSeries && <motion.div {...stagger(6)} className="min-w-0"><OrdersChart series={ordersSeries} /></motion.div>}
          {network && <motion.div {...stagger(7)}><NetworkDonut counts={network} /></motion.div>}
        </div>
      )}

      {/* Quick actions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map((action, i) => (
            <motion.div key={action.label} {...stagger(i + 8)}>
              <Link
                href={action.href}
                className={cn(
                  "group flex items-center gap-3 rounded-[20px] bg-gradient-to-br to-card p-4 ring-1 ring-border outline-none",
                  "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                  GRADIENT_FROM[action.tone]
                )}
              >
                <IconTile icon={action.icon} tone={action.tone} className="bg-surface/70" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{action.label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{action.description}</p>
                </div>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-pri-text shadow-sm transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
        {/* Quick add — the same real routes as before, as compact pastel chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Quick add</span>
          {QUICK_ADD_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={cn(CHIP, "py-1.5 text-xs", TONE_CLASS[item.tone])}>
              <item.icon className="h-3.5 w-3.5" /> {item.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Bottom row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DashboardTasksPanel initialTasksState={tasksState} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Getting Started</CardTitle>
            <CardDescription>{completedSteps} of {steps.length} complete</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <ProgressRing value={progressPct} label="Getting started progress" />
              <p className="text-sm text-muted-foreground">
                {completedSteps === steps.length ? "All set — your workspace is ready." : "Finish these steps to set up your workspace."}
              </p>
            </div>
            <div className="space-y-1">
              {steps.map((step) => (
                <Link key={step.label} href={step.href} className="group flex items-center gap-2.5 rounded-xl px-1 py-1.5 outline-none transition-colors hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring">
                  {step.done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <div className="h-4 w-4 shrink-0 rounded-full border-2 border-border" />
                  )}
                  <span className={cn("text-sm", step.done ? "text-muted-foreground line-through" : "text-foreground")}>{step.label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <CardDescription>Latest events across your workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {activity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              activity.map((item) => {
                const { icon, tone } = ACTIVITY_STYLE[item.kind];
                return (
                  <div key={item.id} className="flex items-start gap-3 rounded-xl px-1 py-2 transition-colors hover:bg-soft/60">
                    <IconTile icon={icon} tone={tone} size="sm" className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{item.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                    <span className="mt-0.5 shrink-0 text-[11px] text-muted-foreground">{item.relativeTime}</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
