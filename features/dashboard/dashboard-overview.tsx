"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  ShoppingCart,
  TrendingUp,
  Plus,
  FileText,
  Bell,
  ArrowUpRight,
  Package,
  Clock,
  CheckCircle2,
  Circle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/cards/stat-card";
import { AnimatedCard } from "@/components/cards/animated-card";
import { PageHeader } from "@/components/layout/page-header";
import { SectionHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/format";
import type { SessionUser } from "@/types/auth";

const STATS = [
  { title: "Active Suppliers", value: "—", change: 0, icon: Building2, iconColor: "text-blue-500" },
  { title: "CRM Contacts", value: "—", change: 0, icon: Users, iconColor: "text-violet-500" },
  { title: "Open Orders", value: "—", change: 0, icon: ShoppingCart, iconColor: "text-emerald-500" },
  { title: "Revenue MTD", value: "—", change: 0, icon: TrendingUp, iconColor: "text-orange-500" },
];

const QUICK_ACTIONS = [
  { label: "Add Supplier", description: "Onboard a new supplier", icon: Building2, color: "text-blue-500", bg: "bg-blue-500/10" },
  { label: "New Contact", description: "Add a CRM contact", icon: Users, color: "text-violet-500", bg: "bg-violet-500/10" },
  { label: "Create Order", description: "Place a bulk order", icon: ShoppingCart, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { label: "View Reports", description: "Check analytics", icon: TrendingUp, color: "text-orange-500", bg: "bg-orange-500/10" },
];

const ACTIVITY = [
  { id: "1", text: "New supplier application received", meta: "Acme Manufacturing", time: new Date(Date.now() - 1000 * 60 * 12), status: "pending", icon: Building2 },
  { id: "2", text: "Order #ORD-2841 fulfilled", meta: "$4,200 · 48 units", time: new Date(Date.now() - 1000 * 60 * 35), status: "done", icon: Package },
  { id: "3", text: "CRM contact updated", meta: "Sarah Lee · Brightline Co", time: new Date(Date.now() - 1000 * 60 * 60), status: "done", icon: Users },
  { id: "4", text: "Verification pending review", meta: "GlobalTrade Ltd", time: new Date(Date.now() - 1000 * 60 * 60 * 3), status: "pending", icon: Clock },
  { id: "5", text: "System maintenance scheduled", meta: "Sunday 2:00 AM UTC", time: new Date(Date.now() - 1000 * 60 * 60 * 5), status: "info", icon: Bell },
];

const TASKS = [
  { id: "1", label: "Review new supplier applications", done: false },
  { id: "2", label: "Update pricing catalog", done: false },
  { id: "3", label: "Send weekly summary to team", done: true },
  { id: "4", label: "Renew 3 supplier contracts", done: false },
];

interface DashboardOverviewProps {
  user: SessionUser;
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

export function DashboardOverview({ user }: DashboardOverviewProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <PageHeader
        title={`${greetingByHour()}, ${user.name.split(" ")[0]}`}
        description="Here's what's happening across your workspace today."
        actions={
          <Button size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Quick add
          </Button>
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
                <motion.button
                  key={action.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 + i * 0.05 }}
                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
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
                </motion.button>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <SectionHeader title="Recent Activity" description="Latest events across your workspace" />
            <AnimatedCard delay={0.2} hover={false} className="divide-y divide-border">
              {ACTIVITY.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors"
                >
                  <div className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-lg shrink-0 mt-0.5",
                    item.status === "pending" && "bg-warning/10 text-warning",
                    item.status === "done" && "bg-success/10 text-success",
                    item.status === "info" && "bg-muted text-muted-foreground",
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{item.text}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.meta}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                    {mounted ? formatRelativeTime(item.time) : ""}
                  </span>
                </div>
              ))}
            </AnimatedCard>
          </div>

          {/* Empty widget placeholder */}
          <div>
            <SectionHeader title="Analytics Preview" />
            <AnimatedCard delay={0.25} hover={false} className="h-40">
              <EmptyState
                icon={TrendingUp}
                title="Analytics coming soon"
                description="Revenue charts and performance metrics will appear here."
                className="py-8"
              />
            </AnimatedCard>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Tasks */}
          <div>
            <SectionHeader title="Tasks" description="Your pending to-dos" />
            <AnimatedCard delay={0.15} hover={false} className="p-4 space-y-1">
              {TASKS.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2.5 py-2 px-1 rounded-lg hover:bg-muted/20 transition-colors group cursor-default"
                >
                  {task.done ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-border shrink-0" />
                  )}
                  <span className={cn(
                    "text-sm flex-1 leading-snug",
                    task.done ? "line-through text-muted-foreground" : "text-foreground"
                  )}>
                    {task.label}
                  </span>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="w-full mt-2 gap-1.5 text-muted-foreground hover:text-foreground">
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
                {[
                  { label: "Create your account", done: true },
                  { label: "Complete your profile", done: false },
                  { label: "Add your first supplier", done: false },
                  { label: "Invite team members", done: false },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-border shrink-0" />
                    )}
                    <span className={cn(
                      "text-sm",
                      step.done ? "text-muted-foreground line-through" : "text-foreground"
                    )}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>1 of 4 complete</span>
                  <span>25%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "25%" }}
                    transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </div>
            </AnimatedCard>
          </div>

          {/* Skeleton placeholder widget */}
          <div>
            <SectionHeader title="Upcoming" />
            <AnimatedCard delay={0.25} hover={false} className="p-4 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                Calendar integration coming soon
              </p>
            </AnimatedCard>
          </div>
        </div>
      </div>
    </div>
  );
}
