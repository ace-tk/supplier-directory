import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NetworkCounts } from "@/lib/dashboard-chart-queries";

const SLICES = [
  { key: "buyers", label: "Buyers", color: "var(--pri)" },
  { key: "suppliers", label: "Suppliers", color: "var(--mint-ink)" },
  { key: "freelancers", label: "Freelancers", color: "var(--lav-ink)" },
] as const;

/** Buyers / Suppliers / Freelancers split (user accounts by role). */
export function NetworkDonut({ counts }: { counts: NetworkCounts }) {
  const total = counts.buyers + counts.suppliers + counts.freelancers;
  const size = 148;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Network</CardTitle>
        <CardDescription>People on the platform by role</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Network split by role">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--soft)" strokeWidth={stroke} />
            {total > 0 &&
              SLICES.map((s) => {
                const len = (counts[s.key] / total) * c;
                const el = (
                  <circle
                    key={s.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={stroke}
                    strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
                    strokeDashoffset={-offset}
                    strokeLinecap="round"
                  />
                );
                offset += len;
                return el;
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums">{total.toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
        </div>
        <ul className="w-full space-y-2">
          {SLICES.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-full" style={{ background: s.color }} />
              <span className="flex-1 text-muted-foreground">{s.label}</span>
              <span className="font-medium tabular-nums">{counts[s.key].toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
