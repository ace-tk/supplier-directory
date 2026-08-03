"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Truck } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { MILESTONE_CARD_STYLES } from "@/lib/supply-chain-ui";
import type { Milestone } from "@/types/supply-chain";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);

  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
}

interface CalendarViewProps {
  milestones: Milestone[];
  expectedDelivery: string;
  onMilestoneClick: (milestone: Milestone) => void;
}

export function CalendarView({ milestones, expectedDelivery, onMilestoneClick }: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => new Date());
  const today = new Date();
  const deliveryDate = new Date(expectedDelivery);

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const monthLabel = cursor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {WEEKDAYS.map((d) => (
          <p key={d} className="text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            {d}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, i) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          const isDelivery = sameDay(day, deliveryDate);
          const dayMilestones = milestones.filter((m) => sameDay(new Date(m.dueDate), day));

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: i * 0.004 }}
              className={cn(
                "min-h-[84px] rounded-xl border p-1.5 flex flex-col gap-1",
                inMonth ? "border-border/60 bg-background/40" : "border-transparent opacity-40",
                isToday && "border-primary/60 ring-1 ring-primary/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("text-[11px]", isToday ? "font-semibold text-primary" : "text-muted-foreground")}>
                  {day.getDate()}
                </span>
                {isDelivery && <Truck className="h-3 w-3 text-primary" aria-label="Expected delivery" />}
              </div>

              <div className="flex flex-col gap-1">
                {dayMilestones.slice(0, 2).map((m) => {
                  const styles = MILESTONE_CARD_STYLES[m.status];
                  return (
                    <button
                      key={m.id}
                      onClick={() => onMilestoneClick(m)}
                      className={cn(
                        "text-left text-[10px] px-1.5 py-0.5 rounded-md truncate bg-muted hover:bg-muted/70 transition-colors",
                        styles.text
                      )}
                      title={m.name}
                    >
                      {m.name}
                    </button>
                  );
                })}
                {dayMilestones.length > 2 && (
                  <span className="text-[9px] text-muted-foreground pl-1.5">+{dayMilestones.length - 2} more</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
