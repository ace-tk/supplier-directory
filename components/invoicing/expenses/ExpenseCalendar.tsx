"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  format,
} from "date-fns";
import { cn } from "@/lib/utils";

/** A compact month calendar — real expense dates (from `expenseDates`) get
 * a dot marker, never a hardcoded pattern. Selecting a day updates the
 * transaction date. */
export function ExpenseCalendar({
  selectedDate,
  onSelectDate,
  expenseDates,
}: {
  /** yyyy-mm-dd */
  selectedDate: string;
  onSelectDate: (date: string) => void;
  /** Set of yyyy-mm-dd strings that have at least one real expense. */
  expenseDates: Set<string>;
}) {
  const [cursor, setCursor] = useState(() => (selectedDate ? new Date(`${selectedDate}T00:00:00`) : new Date()));

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor));
    const end = endOfWeek(endOfMonth(cursor));
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  function toKey(d: Date): string {
    return format(d, "yyyy-MM-dd");
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCursor((c) => subMonths(c, 1))}
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <p className="text-xs font-semibold text-foreground">{format(cursor, "MMMM yyyy")}</p>
        <button
          type="button"
          onClick={() => setCursor((c) => addMonths(c, 1))}
          className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="text-[10px] text-muted-foreground font-medium">
            {d}
          </span>
        ))}
        {days.map((day) => {
          const key = toKey(day);
          const inMonth = isSameMonth(day, cursor);
          const isSelected = selectedDate && isSameDay(day, new Date(`${selectedDate}T00:00:00`));
          const hasExpense = expenseDates.has(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={cn(
                "relative h-7 w-7 mx-auto flex items-center justify-center rounded-full text-[11px] transition-colors",
                !inMonth && "text-muted-foreground/40",
                inMonth && !isSelected && "text-foreground hover:bg-muted",
                isSelected && "bg-primary text-primary-foreground font-semibold"
              )}
              aria-label={format(day, "d MMMM yyyy")}
              aria-current={isSelected ? "date" : undefined}
            >
              {format(day, "d")}
              {hasExpense && !isSelected && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-violet-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
