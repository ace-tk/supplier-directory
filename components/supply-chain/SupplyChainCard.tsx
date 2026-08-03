"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, Factory, CalendarDays } from "lucide-react";
import { StatusBadge } from "@/components/portal/status-badge";
import { AvatarGroup, Avatar, AvatarFallback, AvatarGroupCount } from "@/components/ui/avatar";
import {
  PRIORITY_STYLES,
  PRIORITY_DOT,
  PRIORITY_LABELS,
  SUPPLY_CHAIN_STATUS_LABELS,
  formatShortDate,
  initialsFor,
  avatarColorFor,
} from "@/lib/supply-chain-ui";
import { cn } from "@/lib/utils";
import type { SupplyChainRecord } from "@/types/supply-chain";

export function SupplyChainCard({ chain, basePath, index = 0 }: { chain: SupplyChainRecord; basePath: string; index?: number }) {
  const totalMilestones = chain.milestones.length;
  const avgProgress = totalMilestones
    ? Math.round(chain.milestones.reduce((sum, m) => sum + m.progress, 0) / totalMilestones)
    : 0;

  const uniqueAssignees = Array.from(
    new Map(chain.milestones.flatMap((m) => m.assignees).map((a) => [a.user.id, a.user])).values()
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -4 }}
    >
      <Link
        href={`${basePath}/${chain.id}`}
        className="group block rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-elevated hover:border-primary/30 transition-all duration-200"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-[15px] leading-snug truncate group-hover:text-primary transition-colors">
              {chain.name}
            </h3>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{chain.orderName}</p>
          </div>
          <span className={cn("shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", PRIORITY_STYLES[chain.priority])}>
            <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOT[chain.priority])} />
            {PRIORITY_LABELS[chain.priority]}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-4">
          <span className="flex items-center gap-1 truncate">
            <Building2 className="w-3 h-3 shrink-0" /> {chain.buyerName}
          </span>
          <span className="flex items-center gap-1 truncate">
            <Factory className="w-3 h-3 shrink-0" /> {chain.supplierName}
          </span>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-foreground">{avgProgress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${avgProgress}%` }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border/60">
          <div className="flex items-center gap-2">
            <StatusBadge status={SUPPLY_CHAIN_STATUS_LABELS[chain.status]} />
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarDays className="w-3 h-3" /> {formatShortDate(chain.expectedDelivery)}
            </span>
          </div>

          {uniqueAssignees.length > 0 && (
            <AvatarGroup>
              {uniqueAssignees.slice(0, 3).map((a) => (
                <Avatar key={a.id} size="sm">
                  <AvatarFallback className={cn("text-white text-[9px] font-semibold", avatarColorFor(a.id))}>
                    {initialsFor(a.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {uniqueAssignees.length > 3 && (
                <AvatarGroupCount className="size-6 text-[9px]">+{uniqueAssignees.length - 3}</AvatarGroupCount>
              )}
            </AvatarGroup>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
