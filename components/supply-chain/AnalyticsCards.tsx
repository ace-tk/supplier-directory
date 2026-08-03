"use client";

import { motion } from "framer-motion";
import { Workflow, AlertTriangle, CheckCircle2, Clock3, CalendarClock, type LucideIcon } from "lucide-react";
import { AnimatedCounter } from "./AnimatedCounter";
import type { SupplyChainAnalytics } from "@/types/supply-chain";
import { cn } from "@/lib/utils";

interface CardDef {
  key: keyof SupplyChainAnalytics;
  label: string;
  icon: LucideIcon;
  accent: string;
  bar: string;
}

const CARDS: CardDef[] = [
  { key: "activeCount", label: "Active Supply Chains", icon: Workflow, accent: "text-blue-500 bg-blue-500/10", bar: "bg-blue-500" },
  { key: "delayedCount", label: "Delayed Orders", icon: AlertTriangle, accent: "text-red-500 bg-red-500/10", bar: "bg-red-500" },
  { key: "completedCount", label: "Completed Orders", icon: CheckCircle2, accent: "text-emerald-500 bg-emerald-500/10", bar: "bg-emerald-500" },
  { key: "inProgressCount", label: "In Progress", icon: Clock3, accent: "text-violet-500 bg-violet-500/10", bar: "bg-violet-500" },
  { key: "upcomingDeadlines", label: "Upcoming Deadlines", icon: CalendarClock, accent: "text-amber-500 bg-amber-500/10", bar: "bg-amber-500" },
];

export function AnalyticsCards({ analytics }: { analytics: SupplyChainAnalytics }) {
  const maxValue = Math.max(1, ...CARDS.map((c) => analytics[c.key]));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {CARDS.map((card, i) => {
        const value = analytics[card.key];
        const barWidth = Math.max(6, Math.round((value / maxValue) * 100));
        return (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05, ease: [0.4, 0, 0.2, 1] }}
            whileHover={{ y: -3 }}
            className="relative overflow-hidden rounded-2xl bg-card border border-border p-4 shadow-card hover:shadow-elevated transition-shadow duration-200"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-muted-foreground leading-tight max-w-[10ch]">{card.label}</p>
              <div className={cn("flex items-center justify-center w-8 h-8 rounded-lg shrink-0", card.accent)}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              <AnimatedCounter value={value} />
            </p>
            <div className="h-1 rounded-full bg-muted mt-3 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${barWidth}%` }}
                transition={{ duration: 0.8, delay: 0.15 + i * 0.05, ease: [0.4, 0, 0.2, 1] }}
                className={cn("h-full rounded-full", card.bar)}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
