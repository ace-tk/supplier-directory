"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { type SetupData } from "@/lib/business-structure";
import { type AssignedBusinessData } from "@/services/business-structure";
import { PortalsSection, ModulesSection, FlowsSection, RoadmapSection } from "@/components/business-structure/StaticSections";
import { SetupTables } from "@/components/business-structure/SetupTables";
import { Hierarchy } from "@/components/business-structure/Hierarchy";
import { BusinessStructureTree } from "@/components/business-structure/BusinessStructureTree";
import { BusinessSetup } from "@/components/business-structure/BusinessSetup";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "setup", label: "Business Setup" },
  { id: "tables", label: "Setup Tables" },
  { id: "hierarchy", label: "Hierarchy" },
  { id: "portals", label: "Portals" },
  { id: "modules", label: "Modules" },
  { id: "flows", label: "Connected Flows" },
  { id: "deals", label: "Deals" },
  { id: "roadmap", label: "App Roadmap" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function BusinessStructureTabs({
  initialSetup,
  assignedBusiness,
}: {
  initialSetup: SetupData;
  assignedBusiness?: AssignedBusinessData;
}) {
  const [tab, setTab] = useState<TabId>("overview");
  // The last saved setup. The overview and hierarchy show this, never unsaved edits.
  const [saved, setSaved] = useState<SetupData>(initialSetup);
  // Goes up when the guided Business Setup saves, so the Setup Tables reload the new data.
  const [version, setVersion] = useState(0);

  return (
    <div className="space-y-6">
      {/* Horizontal scroll on phones, so every tab stays reachable without wrapping. */}
      <div role="tablist" aria-label="Business Structure sections" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Setup Tables stays mounted, so unsaved edits survive switching tabs. It starts again from the saved
          setup whenever Business Setup has saved something. */}
      <div role="tabpanel" aria-label="Setup Tables" hidden={tab !== "tables"}>
        <SetupTables key={version} initial={saved} onSaved={setSaved} />
      </div>

      {tab !== "tables" && (
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
          {tab === "overview" && (
            <OverviewSection
              saved={saved}
              assignedBusiness={assignedBusiness}
              onSaved={setSaved}
              onOpen={setTab}
            />
          )}
          {tab === "setup" && (
            <BusinessSetup
              saved={saved}
              onSaved={(next) => {
                setSaved(next);
                setVersion((v) => v + 1);
              }}
            />
          )}
          {tab === "hierarchy" && <Hierarchy saved={saved} onEdit={() => setTab("tables")} />}
          {tab === "portals" && <PortalsSection />}
          {tab === "modules" && <ModulesSection />}
          {tab === "flows" && <FlowsSection />}
          {tab === "deals" && <ComingNext title="Deals" body="Deals from brands, shown to the buyers you assign. Built after the setup and hierarchy steps." />}
          {tab === "roadmap" && <RoadmapSection />}
        </div>
      )}
    </div>
  );
}

function OverviewSection({
  saved,
  assignedBusiness,
  onSaved,
  onOpen,
}: {
  saved: SetupData;
  assignedBusiness?: AssignedBusinessData;
  onSaved: (saved: SetupData) => void;
  onOpen: (t: TabId) => void;
}) {
  const stats = [
    { label: "Businesses", value: saved.businesses.length },
    { label: "Locations", value: saved.locations.length },
    { label: "Members", value: saved.members.length },
    { label: "Assignments", value: saved.assignments.length },
  ];
  const locationsOf = (code: string) => saved.locations.filter((l) => l.businessCode === code).length;
  const membersOf = (code: string) => new Set(saved.assignments.filter((a) => a.businessCode === code).map((a) => a.memberCode)).size;

  return (
    <div className="space-y-6">
      {/* Visual Business Structure Hierarchy Tree */}
      <BusinessStructureTree
        saved={saved}
        assignedBusiness={assignedBusiness}
        onSaved={onSaved}
        onOpenTab={onOpen}
      />

      <p className="text-sm text-muted-foreground">Business setup comes first. Fill the setup tables, validate and save, and the hierarchy is generated from them.</p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent>
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Businesses under your organization</CardTitle>
            <CardDescription>{saved.businesses.length ? "From the last saved setup." : "Nothing saved yet. Businesses appear here once the setup tables are saved."}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {saved.businesses.map((b) => (
              <div key={b.code} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {locationsOf(b.code)} location{locationsOf(b.code) === 1 ? "" : "s"} · {membersOf(b.code)} member{membersOf(b.code) === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => onOpen("tables")} className="text-sm font-medium text-primary hover:underline">
              Open Setup Tables →
            </button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How it works</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li>
                <b>Enter or import Excel data</b>
                <p className="text-muted-foreground">Six linked tables: legal entities, businesses, locations, members, assignments, tool access.</p>
              </li>
              <li>
                <b>Validate &amp; save</b>
                <p className="text-muted-foreground">Required fields, linked IDs and the reporting structure are checked.</p>
              </li>
              <li>
                <b>Hierarchy is generated</b>
                <p className="text-muted-foreground">The organisation structure and the member reporting chart are drawn from the saved rows.</p>
              </li>
              <li>
                <b>Click a member</b>
                <p className="text-muted-foreground">See their business and location assignments, who they report to, and their tool access.</p>
              </li>
            </ol>
            <button type="button" onClick={() => onOpen("hierarchy")} className="mt-4 text-sm font-medium text-primary hover:underline">
              See the generated hierarchy →
            </button>
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardContent className="text-sm text-muted-foreground">
          Add member once <span aria-hidden>→</span> Assign businesses &amp; locations <span aria-hidden>→</span> Set designation &amp; reporting <span aria-hidden>→</span> Configure tool access
        </CardContent>
      </Card>
    </div>
  );
}


function ComingNext({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
    </Card>
  );
}
