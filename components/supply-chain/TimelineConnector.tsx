"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MilestoneStatus } from "@/types/supply-chain";

export function TimelineConnector({ leftStatus }: { leftStatus: MilestoneStatus }) {
  if (leftStatus === "COMPLETED") {
    return (
      <div className="relative h-0.5 flex-1 min-w-8 rounded-full bg-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.5)] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ duration: 0.6 }}
          className="h-full bg-emerald-500"
        />
      </div>
    );
  }

  if (leftStatus === "IN_PROGRESS" || leftStatus === "DELAYED") {
    const color = leftStatus === "DELAYED" ? "bg-red-500" : "bg-primary";
    return (
      <div className="relative h-0.5 flex-1 min-w-8 rounded-full bg-border overflow-hidden">
        <motion.div
          className={cn("absolute inset-y-0 left-0 w-1/3 rounded-full", color)}
          animate={{ x: ["-100%", "300%"] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    );
  }

  return <div className="h-0.5 flex-1 min-w-8 rounded-full bg-border/60 border-t border-dashed border-border" />;
}
