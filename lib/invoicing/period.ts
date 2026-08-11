import {
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  differenceInCalendarDays,
} from "date-fns";

export type NamedPeriod = "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_YEAR";
export type DashboardPeriod = NamedPeriod | { from: string; to: string };

export const PERIOD_LABELS: Record<NamedPeriod, string> = {
  THIS_MONTH: "This Month",
  LAST_MONTH: "Last Month",
  THIS_QUARTER: "This Quarter",
  THIS_YEAR: "This Year",
};

export function resolvePeriodRange(period: DashboardPeriod, now: Date = new Date()): { from: Date; to: Date } {
  if (typeof period === "object") {
    return { from: new Date(period.from), to: new Date(period.to) };
  }
  switch (period) {
    case "THIS_MONTH":
      return { from: startOfMonth(now), to: endOfMonth(now) };
    case "LAST_MONTH": {
      const lastMonth = subMonths(now, 1);
      return { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) };
    }
    case "THIS_QUARTER":
      return { from: startOfQuarter(now), to: endOfQuarter(now) };
    case "THIS_YEAR":
      return { from: startOfYear(now), to: endOfYear(now) };
  }
}

/** Daily buckets for short ranges (<=31 days), monthly buckets otherwise — keeps charts readable either way. */
export function chartBucketGranularity(from: Date, to: Date): "day" | "month" {
  return differenceInCalendarDays(to, from) <= 31 ? "day" : "month";
}
