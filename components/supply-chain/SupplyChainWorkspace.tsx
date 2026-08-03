"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Building2, Factory, CalendarDays, Hash } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/portal/status-badge";
import { TimelineCanvas } from "./TimelineCanvas";
import { KanbanBoard } from "./KanbanBoard";
import { CalendarView } from "./CalendarView";
import { MilestoneDrawer } from "./MilestoneDrawer";
import { PRIORITY_STYLES, PRIORITY_DOT, formatShortDate } from "@/lib/supply-chain-ui";
import { cn } from "@/lib/utils";
import type { SupplyChainRecord, Milestone } from "@/types/supply-chain";

type ViewKey = "timeline" | "board" | "calendar";

export function SupplyChainWorkspace({ chain: initialChain, basePath }: { chain: SupplyChainRecord; basePath: string }) {
  const [chain, setChain] = useState(initialChain);
  const [view, setView] = useState<ViewKey>("timeline");
  const [drawerMilestone, setDrawerMilestone] = useState<Milestone | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function handleMilestonesChange(milestones: Milestone[]) {
    setChain((prev) => ({ ...prev, milestones }));
  }

  function handleMilestoneClick(milestone: Milestone) {
    setDrawerMilestone(milestone);
    setDrawerOpen(true);
  }

  return (
    <div>
      <Link
        href={basePath}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Supply Chain
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{chain.name}</h1>
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", PRIORITY_STYLES[chain.priority])}>
              <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOT[chain.priority])} />
              {chain.priority}
            </span>
            <StatusBadge status={chain.status} />
          </div>
          <p className="text-sm text-muted-foreground mb-3">{chain.orderName}</p>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" /> {chain.orderNumber}
            </span>
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> {chain.buyerName}
            </span>
            <span className="flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5" /> {chain.supplierName}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Due {formatShortDate(chain.expectedDelivery)}
            </span>
          </div>
        </div>

        <Tabs value={view} onValueChange={(v) => v && setView(v as ViewKey)}>
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {chain.description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{chain.description}</p>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {view === "timeline" && (
            <TimelineCanvas
              chainId={chain.id}
              milestones={chain.milestones}
              onMilestonesChange={handleMilestonesChange}
              onMilestoneClick={handleMilestoneClick}
            />
          )}
          {view === "board" && (
            <KanbanBoard
              chainId={chain.id}
              milestones={chain.milestones}
              onMilestonesChange={handleMilestonesChange}
              onMilestoneClick={handleMilestoneClick}
            />
          )}
          {view === "calendar" && (
            <CalendarView
              milestones={chain.milestones}
              expectedDelivery={chain.expectedDelivery}
              onMilestoneClick={handleMilestoneClick}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <MilestoneDrawer milestone={drawerMilestone} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
