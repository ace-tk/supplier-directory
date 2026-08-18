"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  Receipt,
  TrendingUp,
  Plus,
  ArrowUpRight,
  ChevronDown,
  CheckCircle2,
  Circle,
  Zap,
  NotebookText,
  ShoppingBag,
  Megaphone,
  FolderKanban,
  MessageSquare,
  Package,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/cards/stat-card";
import { AnimatedCard } from "@/components/cards/animated-card";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader } from "@/components/layout/page-header";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/invoicing/ui";
import type { SessionUser } from "@/types/auth";
import type { AdminDashboardStats, AdminGettingStartedState, AdminTasksState, AdminActivityItem } from "@/lib/dashboard-queries";

const QUICK_ACTIONS = [
  { label: "Add Supplier", description: "Onboard a new supplier", icon: Building2, color: "text-blue-500", bg: "bg-blue-500/10", href: "/directory" },
  { label: "New Contact", description: "Add a CRM contact", icon: Users, color: "text-violet-500", bg: "bg-violet-500/10", href: "/crm" },
  { label: "Create Invoice", description: "Bill a buyer", icon: Receipt, color: "text-emerald-500", bg: "bg-emerald-500/10", href: "/invoices/new" },
  { label: "Add Product", description: "Add to the catalog", icon: Package, color: "text-orange-500", bg: "bg-orange-500/10", href: "/catalog/new" },
];

const QUICK_ADD_ITEMS = [
  { label: "Add Supplier", href: "/directory", icon: Building2 },
  { label: "New Contact", href: "/crm", icon: Users },
  { label: "Create Invoice", href: "/invoices/new", icon: Receipt },
  { label: "Add Product", href: "/catalog/new", icon: Package },
  { label: "Add Expense", href: "/invoices/expenses/new", icon: Receipt },
  { label: "Create Content", href: "/content/new", icon: NotebookText },
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

const ACTIVITY_ICON: Record<AdminActivityItem["kind"], typeof Building2> = {
  invoice: Receipt,
  supplier: Building2,
  buyer: Users,
  article: BookOpen,
  conversation: MessageSquare,
};

const GETTING_STARTED_STEPS = (state: AdminGettingStartedState) => [
  { label: "Add your first supplier", done: state.hasSupplier, href: "/directory" },
  { label: "Add your first buyer", done: state.hasBuyer, href: "/buyer-leads" },
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

export function DashboardOverview({ user, stats, gettingStarted, tasksState, activity }: DashboardOverviewProps) {
  const steps = GETTING_STARTED_STEPS(gettingStarted);
  const completedSteps = steps.filter((s) => s.done).length;
  const progressPct = Math.round((completedSteps / steps.length) * 100);

  const STATS = [
    { title: "Active Suppliers", value: stats.activeSuppliers, icon: Building2, iconColor: "text-blue-500" },
    { title: "CRM Contacts", value: stats.crmContacts, icon: Users, iconColor: "text-violet-500" },
    { title: "Pending Invoices", value: stats.pendingInvoices, icon: Receipt, iconColor: "text-emerald-500" },
    {
      title: "Revenue MTD",
      value: formatMoney(stats.revenueMTD, "INR"),
      change: stats.revenueTrendPct ?? undefined,
      icon: TrendingUp,
      iconColor: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top quick-navigation row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" render={<Link href="/content" />} nativeButton={false}>
          <NotebookText className="h-3.5 w-3.5" /> Content Management
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" render={<Link href="/shop" />} nativeButton={false}>
          <ShoppingBag className="h-3.5 w-3.5" /> Shop
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Megaphone className="h-3.5 w-3.5" /> Campaigns <ChevronDown className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {CAMPAIGN_LINKS.map((c) => (
              <DropdownMenuItem key={c.href} render={<Link href={c.href} />}>
                {c.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="outline" size="sm" className="gap-1.5 opacity-50 cursor-not-allowed" disabled>
                <FolderKanban className="h-3.5 w-3.5" /> Project Management
                <Badge variant="secondary" className="h-4 px-1 text-[9px]">Soon</Badge>
              </Button>
            }
          />
          <TooltipContent>Coming soon</TooltipContent>
        </Tooltip>
      </div>

      {/* Welcome */}
      <PageHeader
        title={`${greetingByHour()}, ${user.name.split(" ")[0]}`}
        description="Here's what's happening across your workspace today."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" className="gap-1.5" />}>
              <Plus className="h-3.5 w-3.5" />
              Quick add
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {QUICK_ADD_ITEMS.map((item) => (
                <DropdownMenuItem key={item.href} render={<Link href={item.href} />} className="gap-2">
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {/* Role badge */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-2"
      >
        <Badge variant="secondary" className="gap-1.5 px-2.5 py-1 text-xs bg-primary/10 text-primary border-primary/20">
          <Zap className="h-3 w-3" />
          {roleLabel[user.role] ?? user.role} account
        </Badge>
        <Badge variant="secondary" className="text-xs text-muted-foreground">
          {user.email}
        </Badge>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat, i) => (
          <StatCard key={stat.title} {...stat} delay={i * 0.05} />
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div>
            <SectionHeader title="Quick Actions" />
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACTIONS.map((action, i) => (
                <motion.div
                  key={action.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
                >
                  <Link
                    href={action.href}
                    className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-shadow text-left group"
                  >
                    <div className={cn("flex items-center justify-center w-9 h-9 rounded-lg shrink-0", action.bg, action.color)}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{action.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{action.description}</p>
                    </div>
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <SectionHeader title="Recent Activity" description="Latest events across your workspace" />
            <AnimatedCard delay={0.2} hover={false} className="divide-y divide-border">
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground px-4 py-6 text-center">No activity yet.</p>
              ) : (
                activity.map((item) => {
                  const Icon = ACTIVITY_ICON[item.kind];
                  return (
                    <div key={item.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors">
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5 bg-muted text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{item.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.meta}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">{item.relativeTime}</span>
                    </div>
                  );
                })
              )}
            </AnimatedCard>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Tasks */}
          <div>
            <SectionHeader title="Tasks" description={`${tasksState.completedCount} of ${tasksState.totalCount} complete`} />
            <AnimatedCard delay={0.15} hover={false} className="p-4 space-y-1">
              {tasksState.tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No tasks yet.</p>
              ) : (
                tasksState.tasks.map((task) => (
                  <div key={task.id} className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-muted/20 transition-colors group cursor-default">
                    {task.completed ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <Circle className="h-4 w-4 text-border shrink-0" />
                    )}
                    <span className={cn("text-sm flex-1 leading-snug", task.completed ? "line-through text-muted-foreground" : "text-foreground")}>
                      {task.title}
                    </span>
                  </div>
                ))
              )}
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 gap-1.5 text-muted-foreground hover:text-foreground"
                render={<Link href="/crm" />}
                nativeButton={false}
              >
                <Plus className="h-3.5 w-3.5" />
                Add task
              </Button>
            </AnimatedCard>
          </div>

          {/* Onboarding checklist */}
          <div>
            <SectionHeader title="Getting Started" />
            <AnimatedCard delay={0.2} hover={false} className="p-4">
              <div className="space-y-3">
                {steps.map((step) => (
                  <Link key={step.label} href={step.href} className="flex items-center gap-2.5 group">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />
                    )}
                    <span className={cn("text-sm group-hover:text-foreground transition-colors", step.done ? "text-muted-foreground line-through" : "text-foreground")}>
                      {step.label}
                    </span>
                  </Link>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>{completedSteps} of {steps.length} complete</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </div>
            </AnimatedCard>
          </div>
        </div>
      </div>
    </div>
  );
}
