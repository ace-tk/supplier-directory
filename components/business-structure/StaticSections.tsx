"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CONNECTED_FLOWS,
  MODULE_GROUPS,
  MODULE_STATUS_LABEL,
  PORTALS,
  ROADMAP_PHASES,
  ROADMAP_WORK,
  type ModuleStatus,
} from "@/lib/business-structure-content";

export function PortalsSection() {
  return (
    <div className="space-y-4">
      <SectionIntro text="Four separate logins. The business structure applies to the Admin portal; the other three are outside parties that connect to a business." />
      <div className="grid gap-4 md:grid-cols-2">
        {PORTALS.map((p) => (
          <Card key={p.name}>
            <CardContent className="flex items-start gap-3">
              <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                {p.initial}
              </span>
              <div className="min-w-0 space-y-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {p.name}
                  <Badge variant={p.insideStructure ? "default" : "secondary"}>{p.connection}</Badge>
                </p>
                <p className="text-sm text-muted-foreground">{p.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

const FILTERS: ("all" | ModuleStatus)[] = ["all", "built", "partly", "planned"];

export function ModulesSection() {
  const [filter, setFilter] = useState<"all" | ModuleStatus>("all");
  const count = (f: "all" | ModuleStatus) => MODULE_GROUPS.reduce((n, g) => n + g.items.filter((m) => f === "all" || m.status === f).length, 0);
  const pill: Record<ModuleStatus, "default" | "secondary" | "outline"> = { built: "default", partly: "secondary", planned: "outline" };

  return (
    <div className="space-y-4">
      <SectionIntro text="Every tool, shown in the context of the chosen business. Status is against the Business OS reference." />
      <div role="group" aria-label="Filter modules by status" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn("rounded-md border px-2.5 py-1 text-sm", filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 hover:bg-muted")}
          >
            {f === "all" ? "All" : MODULE_STATUS_LABEL[f]} ({count(f)})
          </button>
        ))}
      </div>

      {MODULE_GROUPS.map((g) => {
        const items = g.items.filter((m) => filter === "all" || m.status === filter);
        if (!items.length) return null;
        return (
          <section key={g.group} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((m) => (
                <Card key={m.name} size="sm">
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{m.name}</p>
                      <Badge variant={pill[m.status]}>{MODULE_STATUS_LABEL[m.status]}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export function FlowsSection() {
  return (
    <div className="space-y-4">
      <SectionIntro text="One record travels through the modules, so nothing is typed twice. Orange steps are not built yet." />
      {CONNECTED_FLOWS.map((f) => (
        <Card key={f.title}>
          <CardHeader>
            <CardTitle>{f.title}</CardTitle>
            <CardDescription>
              {f.notBuilt.length
                ? `${f.notBuilt.length} step${f.notBuilt.length > 1 ? "s" : ""} not built yet (orange).`
                : "All steps exist today; one shared party profile across them needs checking."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="flex flex-wrap items-center gap-2 text-sm">
              {f.steps.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="text-muted-foreground">→</span>}
                  <span
                    className={cn(
                      "rounded-md border px-2 py-1",
                      f.notBuilt.includes(i) ? "border-peach-ink/30 bg-peach text-peach-ink  " : "border-border bg-muted/40"
                    )}
                  >
                    {s}
                  </span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function RoadmapSection() {
  return (
    <div className="space-y-6">
      <SectionIntro text="One backend, four ways to use it. Phases are in order, not to a calendar; each gate must be passed before the next phase." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ROADMAP_PHASES.map((p) => (
          <Card key={p.title} className={cn(p.current && "ring-2 ring-primary/40")}>
            <CardHeader>
              <p className="text-xs font-medium text-muted-foreground">{p.label}</p>
              <CardTitle>{p.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                {p.points.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
              {p.gate && (
                <p className="rounded-md bg-muted/50 p-2 text-xs">
                  <b>{p.gate.label}:</b> {p.gate.text}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What needs building, in order</CardTitle>
          <CardDescription>Sizes are relative, not time estimates.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">#</th>
                <th className="py-2 pr-3 font-medium">Work</th>
                <th className="py-2 pr-3 font-medium">Size</th>
                <th className="py-2 font-medium">Why in this order</th>
              </tr>
            </thead>
            <tbody>
              {ROADMAP_WORK.map((r) => (
                <tr key={r.no} className="border-b border-border/60 align-top">
                  <td className="py-2 pr-3 tabular-nums">{r.no}</td>
                  <td className="py-2 pr-3">{r.work}</td>
                  <td className="py-2 pr-3">{r.size}</td>
                  <td className="py-2 text-muted-foreground">{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionIntro({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
