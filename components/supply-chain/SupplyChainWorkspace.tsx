"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Building2, Factory, CalendarDays, Hash, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/portal/status-badge";
import { TimelineCanvas } from "./TimelineCanvas";
import { KanbanBoard } from "./KanbanBoard";
import { CalendarView } from "./CalendarView";
import { MilestoneDrawer } from "./MilestoneDrawer";
import { TimelineSharing } from "./TimelineSharing";
import {
  PRIORITY_STYLES,
  PRIORITY_DOT,
  PRIORITY_LABELS,
  SUPPLY_CHAIN_STATUS_LABELS,
  MILESTONE_STATUS_LABELS,
  formatShortDate,
} from "@/lib/supply-chain-ui";
import { MILESTONE_STATUSES, PRIORITIES } from "@/types/supply-chain";
import type { SupplyChainAccess } from "@/lib/supply-chain-permissions";
import { cn } from "@/lib/utils";
import type { SupplyChainRecord, MilestoneRecord, MilestoneDetail } from "@/types/supply-chain";

type ViewKey = "timeline" | "board" | "calendar";

export function SupplyChainWorkspace({
  chain: initialChain,
  access,
  basePath,
}: {
  chain: SupplyChainRecord;
  access: SupplyChainAccess;
  basePath: string;
}) {
  const [chain, setChain] = useState(initialChain);
  const [view, setView] = useState<ViewKey>("timeline");
  const [drawerMilestoneId, setDrawerMilestoneId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  function handleMilestonesChange(milestones: MilestoneRecord[]) {
    setChain((prev) => ({ ...prev, milestones }));
  }

  function handleMilestoneClick(milestone: MilestoneRecord) {
    setDrawerMilestoneId(milestone.id);
    setDrawerOpen(true);
  }

  function handleMilestoneUpdated(updated: MilestoneDetail) {
    setChain((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id === updated.id
          ? {
              ...m,
              name: updated.name,
              status: updated.status,
              priority: updated.priority,
              dueDate: updated.dueDate,
              progress: updated.progress,
              notes: updated.notes,
              assignees: updated.assignees,
              tags: updated.tags,
              mediaCount: updated.mediaCount,
              attachmentCount: updated.attachmentCount,
              commentCount: updated.commentCount,
            }
          : m
      ),
    }));
  }

  const filteredMilestones = useMemo(() => {
    const q = search.trim().toLowerCase();
    return chain.milestones.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (priorityFilter !== "all" && m.priority !== priorityFilter) return false;
      if (!q) return true;
      const haystack = [
        m.name,
        m.description ?? "",
        m.notes ?? "",
        ...m.assignees.map((a) => a.user.name),
        ...m.tags.map((t) => t.user.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [chain.milestones, search, statusFilter, priorityFilter]);

  const isFiltering = search.trim() !== "" || statusFilter !== "all" || priorityFilter !== "all";
  // Timeline/Board can't safely drop filtered-out cards from the DOM — that
  // would corrupt `order` for hidden items on any drag. They dim instead;
  // only Calendar (no drag) removes non-matches outright.
  const visibleIds = useMemo(() => new Set(filteredMilestones.map((m) => m.id)), [filteredMilestones]);

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
              {PRIORITY_LABELS[chain.priority]}
            </span>
            <StatusBadge status={SUPPLY_CHAIN_STATUS_LABELS[chain.status]} />
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

        <div className="flex items-center gap-2">
          <TimelineSharing
            chainId={chain.id}
            shares={chain.shares}
            canShare={access.canShare}
            onSharesChange={(shares) => setChain((prev) => ({ ...prev, shares }))}
          />
          <Tabs value={view} onValueChange={(v) => v && setView(v as ViewKey)}>
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {chain.description && (
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">{chain.description}</p>
      )}

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-5">
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search milestones, notes, tagged people..."
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-40 h-8 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {MILESTONE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {MILESTONE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={(v) => v && setPriorityFilter(v)}>
          <SelectTrigger className="w-full sm:w-36 h-8 text-xs">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
              canEdit={access.canEditChain}
              visibleIds={isFiltering ? visibleIds : undefined}
              onMilestonesChange={handleMilestonesChange}
              onMilestoneClick={handleMilestoneClick}
            />
          )}
          {view === "board" && (
            <KanbanBoard
              chainId={chain.id}
              milestones={chain.milestones}
              canEdit={access.canEditChain}
              visibleIds={isFiltering ? visibleIds : undefined}
              onMilestonesChange={handleMilestonesChange}
              onMilestoneClick={handleMilestoneClick}
            />
          )}
          {view === "calendar" && (
            <CalendarView
              milestones={filteredMilestones}
              expectedDelivery={chain.expectedDelivery}
              onMilestoneClick={handleMilestoneClick}
            />
          )}
        </motion.div>
      </AnimatePresence>

      <MilestoneDrawer
        milestoneId={drawerMilestoneId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onMilestoneUpdated={handleMilestoneUpdated}
      />
    </div>
  );
}
