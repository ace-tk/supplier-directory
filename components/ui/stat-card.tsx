"use client"

import { useEffect, useRef, useState } from "react"
import { animate, useReducedMotion } from "framer-motion"
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { IconTile, type Tone } from "@/components/ui/icon-tile"
import { Sparkline } from "@/components/ui/sparkline"

/** Counts up from 0 once on mount (instant under prefers-reduced-motion). */
export function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const done = useRef(false)

  useEffect(() => {
    if (reduce || done.current) {
      // Reduced motion, or the value changed after the first count-up: show it directly.
      setShown(value)
      return
    }
    done.current = true
    const controls = animate(0, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => setShown(Math.round(v)),
    })
    return () => controls.stop()
  }, [value, reduce])

  return <>{shown.toLocaleString()}</>
}

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  tone?: Tone
  /** Only shown when real trend data exists, never invented. */
  trend?: { label: string; direction: "up" | "down" | "flat" }
  sparkline?: number[]
  className?: string
}

/** KPI card: icon tile, label, big tabular number, optional trend chip + sparkline. */
export function StatCard({ label, value, icon, tone = "sky", trend, sparkline, className }: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex flex-col gap-3 rounded-[20px] bg-card p-5 ring-1 ring-border shadow-[var(--shadow-soft)]",
        "transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <IconTile icon={icon} tone={tone} />
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              trend.direction === "up" && "bg-mint text-mint-ink",
              trend.direction === "down" && "bg-rose text-rose-ink",
              trend.direction === "flat" && "bg-soft text-muted-foreground"
            )}
          >
            {trend.direction === "up" && <ArrowUpRight className="size-3" />}
            {trend.direction === "down" && <ArrowDownRight className="size-3" />}
            {trend.label}
          </span>
        )}
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-3xl font-semibold tracking-tight tabular-nums">
          {typeof value === "number" ? <CountUp value={value} /> : value}
        </p>
      </div>
      {sparkline && sparkline.length > 1 && <Sparkline data={sparkline} />}
    </div>
  )
}
