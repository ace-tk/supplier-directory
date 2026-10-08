"use client";

import { useId, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OrdersPoint } from "@/lib/dashboard-chart-queries";

const RANGES = [
  { key: 7, label: "7D" },
  { key: 30, label: "30D" },
  { key: 90, label: "90D" },
] as const;

const W = 600;
const H = 200;
const PAD = 12;

function fmtDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Smooth path through the points (midpoint cubic) */
function smooth(pts: Array<[number, number]>) {
  if (pts.length < 2) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const mx = (x0 + x1) / 2;
    d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`;
  }
  return d;
}

export function OrdersChart({ series }: { series: OrdersPoint[] }) {
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();

  const data = series.slice(-range);
  const total = data.reduce((n, p) => n + p.count, 0);
  const max = Math.max(1, ...data.map((p) => p.count));
  const xAt = (i: number) => (data.length === 1 ? W / 2 : PAD + (i / (data.length - 1)) * (W - PAD * 2));
  const yAt = (v: number) => H - PAD - (v / max) * (H - PAD * 2);
  const pts = data.map((p, i) => [xAt(i), yAt(p.count)] as [number, number]);
  const line = smooth(pts);
  const area = pts.length > 1 ? `${line} L${pts[pts.length - 1][0]} ${H} L${pts[0][0]} ${H} Z` : "";

  const active = hover !== null ? data[hover] : null;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Orders overview</CardTitle>
        <CardDescription>
          <span className="tabular-nums">{total.toLocaleString()}</span> sales invoices in the last {range} days
        </CardDescription>
        <CardAction>
          <div role="radiogroup" aria-label="Range" className="inline-flex gap-0.5 rounded-full bg-soft p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                role="radio"
                aria-checked={range === r.key}
                onClick={() => { setRange(r.key); setHover(null); }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  range === r.key ? "bg-surface text-pri-text shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="flex h-[200px] items-center justify-center rounded-2xl bg-soft/60 text-sm text-muted-foreground">
            No sales invoices in this period yet.
          </div>
        ) : (
          <>
            <div
              className="relative h-[200px] touch-pan-y"
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
                setHover(Math.round(ratio * (data.length - 1)));
              }}
              onPointerLeave={() => setHover(null)}
            >
              <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={`Orders per day, last ${range} days`}>
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--pri)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--pri)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((f) => (
                  <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="var(--border)" strokeDasharray="4 6" vectorEffect="non-scaling-stroke" />
                ))}
                {area && <path d={area} fill={`url(#${gradId})`} />}
                <path d={line} fill="none" stroke="var(--pri)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {hover !== null && active && (
                <>
                  <div className="pointer-events-none absolute inset-y-0 w-px bg-border" style={{ left: `${(xAt(hover) / W) * 100}%` }} />
                  <div
                    className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-primary"
                    style={{ left: `${(xAt(hover) / W) * 100}%`, top: `${(yAt(active.count) / H) * 100}%` }}
                  />
                  <div
                    className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xl bg-popover px-3 py-1.5 text-xs shadow-elevated ring-1 ring-border"
                    style={{ left: `${Math.min(88, Math.max(12, (xAt(hover) / W) * 100))}%`, top: `${(yAt(active.count) / H) * 100}%` }}
                  >
                    <span className="text-muted-foreground">{fmtDay(active.date)}</span>{" "}
                    <span className="font-semibold tabular-nums">{active.count}</span>
                  </div>
                </>
              )}
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
              <span>{fmtDay(data[0].date)}</span>
              <span>{fmtDay(data[Math.floor(data.length / 2)].date)}</span>
              <span>{fmtDay(data[data.length - 1].date)}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
