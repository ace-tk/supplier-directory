import { cn } from "@/lib/utils"

/** Linear progress bar. `value` is 0–100. */
export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-soft", className)}
    >
      <div className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out" style={{ transform: `scaleX(${v / 100})` }} />
    </div>
  )
}

/** Circular progress ring with the percentage in the middle. */
export function ProgressRing({ value, size = 72, stroke = 8, className, label }: { value: number; size?: number; stroke?: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v)}
      aria-label={label}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--pri)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 400ms ease-out" }}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums">{Math.round(v)}%</span>
    </div>
  )
}
