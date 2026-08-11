"use client";

import { useId } from "react";
import { formatMoney } from "@/lib/invoicing/ui";

interface Point {
  label: string;
  a: number;
  b: number;
}

export function DualSeriesLineChart({
  points,
  seriesALabel,
  seriesBLabel,
  currency = "INR",
}: {
  points: Point[];
  seriesALabel: string;
  seriesBLabel: string;
  currency?: string;
}) {
  const gradientId = useId();
  const width = 600;
  const height = 220;
  const padding = { top: 12, right: 12, bottom: 24, left: 12 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...points.map((p) => Math.max(p.a, p.b)));
  const hasData = points.some((p) => p.a > 0 || p.b > 0);

  const x = (i: number) => padding.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padding.top + innerH - (v / max) * innerH;

  const pathFor = (key: "a" | "b") => points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p[key])}`).join(" ");

  if (!hasData) {
    return <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">No data for this period yet.</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs">
        <Legend color="var(--color-primary)" label={seriesALabel} />
        <Legend color="#f59e0b" label={seriesBLabel} />
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label={`${seriesALabel} vs ${seriesBLabel} over time`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={padding.left} y1={padding.top + innerH} x2={width - padding.right} y2={padding.top + innerH} stroke="currentColor" className="text-border" strokeWidth={1} />
        <path d={`${pathFor("a")} L${x(points.length - 1)},${padding.top + innerH} L${x(0)},${padding.top + innerH} Z`} fill={`url(#${gradientId})`} stroke="none" />
        <path d={pathFor("a")} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={pathFor("b")} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.a)} r={2.5} fill="var(--color-primary)" />
            <circle cx={x(i)} cy={y(p.b)} r={2.5} fill="#f59e0b" />
          </g>
        ))}
        {points.map((p, i) => {
          if (points.length > 10 && i % Math.ceil(points.length / 8) !== 0) return null;
          return (
            <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize={9} fill="currentColor" className="text-muted-foreground">
              {p.label}
            </text>
          );
        })}
      </svg>
      <p className="text-[11px] text-muted-foreground mt-1">Peak: {formatMoney(max, currency)}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
