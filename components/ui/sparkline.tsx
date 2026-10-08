import { cn } from "@/lib/utils"

interface SparklineProps {
  data: number[]
  className?: string
  /** Any CSS colour; defaults to the primary token. */
  color?: string
}

/** Tiny dependency-free line chart. Renders nothing for fewer than 2 points. */
export function Sparkline({ data, className, color = "var(--pri)" }: SparklineProps) {
  if (data.length < 2) return null
  const w = 100
  const h = 32
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 3 - ((v - min) / span) * (h - 6)] as const)
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ")
  const area = `${line} L${w} ${h} L0 ${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden className={cn("h-8 w-full", className)}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
