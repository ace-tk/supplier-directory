"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LOCATION_TYPE_LABEL, type LocationType, type SetupData } from "@/lib/business-structure";

/**
 * The organisation chart and member reporting charts, drawn from the last
 * saved setup (never from unsaved edits). Click a member to see their
 * assignments, who they report to and their tool access.
 */
export function Hierarchy({ saved, onEdit }: { saved: SetupData; onEdit: () => void }) {
  const hasData = saved.assignments.length > 0 || saved.businesses.length > 0;
  const [selected, setSelected] = useState<string | null>(null);

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hierarchy</CardTitle>
          <CardDescription>Nothing to show yet. Save the setup tables and the hierarchy is generated from them.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" onClick={onEdit}>
            Open Setup Tables
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div className="min-w-0 space-y-6">
        <OrgChart saved={saved} onSelect={setSelected} />
        {saved.businesses.map((b) => (
          <ReportingChart key={b.code} saved={saved} businessCode={b.code} onSelect={setSelected} />
        ))}
      </div>
      <div className="xl:sticky xl:top-6 xl:self-start">
        <MemberProfile saved={saved} memberCode={selected} onEdit={onEdit} />
      </div>
    </div>
  );
}

function OrgChart({ saved, onSelect }: { saved: SetupData; onSelect: (code: string) => void }) {
  const memberCount = (businessCode: string) => new Set(saved.assignments.filter((a) => a.businessCode === businessCode).map((a) => a.memberCode)).size;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organisation</CardTitle>
        <CardDescription>Legal entity → businesses → locations, with the members in each business.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {saved.entities.map((e) => (
          <div key={e.code} className="space-y-3">
            <div className="rounded-md bg-primary/10 px-3 py-2">
              <p className="font-semibold">{e.legalName}</p>
              <p className="text-xs text-muted-foreground">{e.code}{e.gstin ? ` · GSTIN ${e.gstin}` : ""}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {saved.businesses
                .filter((b) => b.entityCode === e.code)
                .map((b) => (
                  <div key={b.code} className="rounded-md border border-border p-3">
                    <p className="font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.code} · {memberCount(b.code)} member{memberCount(b.code) === 1 ? "" : "s"}
                      {b.operationalAddress ? ` · ${b.operationalAddress}` : ""}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {saved.locations
                        .filter((l) => l.businessCode === b.code)
                        .map((l) => (
                          <li key={l.code} className="flex items-center gap-2 text-sm">
                            <Badge variant="outline">{LOCATION_TYPE_LABEL[l.type as LocationType] ?? l.type}</Badge>
                            <span>{l.name}</span>
                            <span className="text-xs text-muted-foreground">{l.code}</span>
                          </li>
                        ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {saved.assignments
                        .filter((a) => a.businessCode === b.code)
                        .map((a) => {
                          const m = saved.members.find((x) => x.code === a.memberCode);
                          return (
                            <button key={a.code} type="button" onClick={() => onSelect(a.memberCode)} className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs hover:bg-muted">
                              {m?.name ?? a.memberCode}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ))}
        {saved.businesses.some((b) => !saved.entities.some((e) => e.code === b.entityCode)) && (
          <p className="text-xs text-muted-foreground">Some businesses are not under a saved legal entity.</p>
        )}
      </CardContent>
    </Card>
  );
}

function ReportingChart({ saved, businessCode, onSelect }: { saved: SetupData; businessCode: string; onSelect: (code: string) => void }) {
  const business = saved.businesses.find((b) => b.code === businessCode);
  const rows = saved.assignments.filter((a) => a.businessCode === businessCode);
  if (!business || !rows.length) return null;

  const memberCodes = new Set(rows.map((a) => a.memberCode));
  // Top of the chart: anyone who reports to nobody in this business.
  const roots = rows.filter((a) => !a.reportsToCode || !memberCodes.has(a.reportsToCode));
  const childrenOf = (memberCode: string) => rows.filter((a) => a.reportsToCode === memberCode);

  // "seen" stops a loop from repeating forever; the setup is validated, so loops should not exist.
  const render = (a: SetupData["assignments"][number], seen: Set<string>): React.ReactNode => {
    if (seen.has(a.memberCode)) return null;
    const member = saved.members.find((m) => m.code === a.memberCode);
    const location = saved.locations.find((l) => l.code === a.locationCode);
    const nextSeen = new Set(seen).add(a.memberCode);
    const children = childrenOf(a.memberCode);
    return (
      <li key={a.code} className="space-y-1">
        <button type="button" onClick={() => onSelect(a.memberCode)} className="flex w-full flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50">
          <span className="font-medium">{member?.name ?? a.memberCode}</span>
          <span className="text-xs text-muted-foreground">{a.designation}</span>
          <span className="ml-auto text-xs text-muted-foreground">{location?.name ?? a.locationCode}</span>
        </button>
        {children.length > 0 && <ul className="ml-4 space-y-1 border-l border-border pl-3">{children.map((c) => render(c, nextSeen))}</ul>}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reporting · {business.name}</CardTitle>
        <CardDescription>Who reports to whom in this business.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">{roots.map((a) => render(a, new Set()))}</ul>
      </CardContent>
    </Card>
  );
}

function MemberProfile({ saved, memberCode, onEdit }: { saved: SetupData; memberCode: string | null; onEdit: () => void }) {
  if (!memberCode) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>Member profile &amp; access</CardTitle>
          <CardDescription>Click a member in the charts.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  const member = saved.members.find((m) => m.code === memberCode);
  const assignments = saved.assignments.filter((a) => a.memberCode === memberCode);
  const nameOf = (code: string) => saved.members.find((m) => m.code === code)?.name ?? code;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{member?.name ?? memberCode}</CardTitle>
        <CardDescription>
          {member?.code}
          {member?.email ? ` · ${member.email}` : ""}
          {member?.mobile ? ` · ${member.mobile}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <section className="space-y-2">
          <h3 className="font-semibold">Assignments</h3>
          {assignments.length === 0 && <p className="text-muted-foreground">No assignments.</p>}
          {assignments.map((a) => {
            const business = saved.businesses.find((b) => b.code === a.businessCode);
            const location = saved.locations.find((l) => l.code === a.locationCode);
            return (
              <div key={a.code} className="rounded-md border border-border p-2">
                <p className="font-medium">
                  {a.designation} · {business?.name ?? a.businessCode}
                </p>
                <p className="text-xs text-muted-foreground">
                  {location?.name ?? a.locationCode} · reports to {a.reportsToCode ? nameOf(a.reportsToCode) : "nobody (top)"}
                </p>
                <ul className="mt-2 space-y-0.5 text-xs">
                  {saved.access
                    .filter((t) => t.assignmentCode === a.code)
                    .map((t) => (
                      <li key={t.tool}>
                        <span className="font-medium">{t.tool}</span> — {[t.view && "View", t.create && "Create", t.edit && "Edit", t.approve && "Approve"].filter(Boolean).join(", ")}
                      </li>
                    ))}
                </ul>
              </div>
            );
          })}
        </section>
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit in Setup Tables
        </Button>
      </CardContent>
    </Card>
  );
}
