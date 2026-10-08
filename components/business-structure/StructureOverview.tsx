"use client";

import { Briefcase, Building, Building2, MapPin, Plus, Printer, ShieldCheck, Store, User, Users, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PARTY_GROUPS, VERTICALS, LOCATION_TYPE_LABEL, partiesOf, reportingTree, toolsInUse, toolsOfMember, type AssignedParty, type LocationType, type OrgNode, type SetupData, type TeamMember } from "@/lib/business-structure";

const ICON = { WAREHOUSE: Warehouse, RETAIL_STORE: Store, OFFICE: Building } as const;
const PLURAL: Record<LocationType, string> = { WAREHOUSE: "Warehouses", RETAIL_STORE: "Retail Stores", OFFICE: "Back Offices" };

/** The reporting tree's connecting lines, and the rules that print only the chart. Scoped to the classes used below. */
const CSS = `
.org-tree ul{display:flex;justify-content:center;list-style:none;padding:25px 0 0;margin:0;position:relative}
.org-tree li{list-style:none;text-align:center;padding:0 7px;position:relative;flex:0 0 auto}
.org-tree li:before,.org-tree li:after{content:'';position:absolute;top:-15px;width:50%;height:15px;border-top:1px solid var(--color-border,#cbd5e1);right:50%}
.org-tree li:after{right:auto;left:50%;border-left:1px solid var(--color-border,#cbd5e1)}
.org-tree li:first-child:before,.org-tree li:last-child:after{border:0}
.org-tree li:only-child:before,.org-tree li:only-child:after{display:none}
.org-tree ul ul:before{content:'';position:absolute;top:0;left:50%;height:10px;border-left:1px solid var(--color-border,#cbd5e1)}
.org-tree>ul{padding-top:0}
.org-tree>ul>li:before,.org-tree>ul>li:after{display:none}
@media print{body *{visibility:hidden}.org-print,.org-print *{visibility:visible}.org-print{position:absolute;left:0;top:0;width:100%;border:0}.org-print button{border:1px solid #cbd5e1}.org-noprint{display:none!important}}
`;

function Branch({ nodes, onOpenMember }: { nodes: OrgNode[]; onOpenMember: (memberCode: string) => void }) {
  return (
    <ul>
      {nodes.map((n) => (
        <li key={n.member.memberCode}>
          <button type="button" onClick={() => onOpenMember(n.member.memberCode)} title="Edit this person" className="inline-block min-w-28 max-w-40 rounded-xl border border-border bg-card p-2.5 text-left hover:border-primary/50">
            <User className="h-4 w-4 text-primary" aria-hidden />
            <b className="mt-1.5 block text-xs">{n.member.name}</b>
            <small className="block text-[10px] text-muted-foreground">{n.member.designation}</small>
          </button>
          {n.children.length > 0 && <Branch nodes={n.children} onOpenMember={onOpenMember} />}
        </li>
      ))}
    </ul>
  );
}

/** Step "Structure overview": the whole business on one page, with Print. Clicking a person or a location manages it. */
export function StructureOverview({
  setup,
  businessCode,
  businessName,
  gstin,
  team,
  parties = [],
  onOpenMember,
  onAssign,
  onAddLocation,
}: {
  setup: SetupData;
  businessCode: string;
  businessName: string;
  gstin: string;
  team: TeamMember[];
  parties?: AssignedParty[];
  onOpenMember: (memberCode: string) => void;
  onAssign: (locationCode: string) => void;
  onAddLocation: (type: LocationType) => void;
}) {
  const locations = setup.locations.filter((l) => l.businessCode === businessCode);
  const tree = reportingTree(team);
  const metrics = [
    { label: "Team members", value: team.length, icon: Users },
    { label: "Business locations", value: locations.length, icon: MapPin },
    { label: "Tools in use", value: toolsInUse(setup, businessCode), icon: ShieldCheck },
  ];

  return (
    <div className="org-print" aria-label="Organisation map">
      <style>{CSS}</style>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Organisation map</p>
          <h3 className="mt-1 text-lg font-semibold">A clear view of your business</h3>
          <p className="text-xs text-muted-foreground">Click a person or a location to manage its details.</p>
        </div>
        <Button variant="outline" className="org-noprint" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print chart
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <m.icon className="hidden h-5 w-5 text-primary sm:block" aria-hidden />
            <div>
              <strong className="block text-xl tabular-nums">{m.value}</strong>
              <small className="text-[11px] text-muted-foreground">{m.label}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-6 flex max-w-md items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
        <Building2 className="h-6 w-6 text-primary" aria-hidden />
        <div>
          <strong className="block text-base">{businessName}</strong>
          <small className="text-xs text-muted-foreground">GST {gstin || "not added"}</small>
        </div>
      </div>

      <h4 className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden /> 01 / Member reporting hierarchy
      </h4>
      {tree.length ? (
        <div className="org-tree mt-3 overflow-x-auto pb-3" aria-label="Reporting hierarchy">
          {/* mx-auto centres the tree when it fits and lets it start at the left (scrollable) when it does not */}
          <div className="mx-auto w-max">
            <Branch nodes={tree} onOpenMember={onOpenMember} />
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No team members yet.</p>
      )}

      <h4 className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" aria-hidden /> 02 / Verticals &amp; locations
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">All locations below share {businessName}&apos;s GST. Member badges show who works where.</p>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        {VERTICALS.map((type) => {
          const Icon = ICON[type];
          const here = locations.filter((l) => l.type === type);
          return (
            <section key={type} aria-label={`${PLURAL[type]} overview`}>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
                <Icon className="h-5 w-5 text-primary" aria-hidden />
                <div>
                  <b className="text-sm">{PLURAL[type]}</b>
                  <small className="block text-[10px] text-muted-foreground">
                    {here.length} location{here.length === 1 ? "" : "s"} · one GST
                  </small>
                </div>
              </div>
              <div className="ml-5 mt-3 space-y-3 border-l border-border pl-4">
                {here.map((l) => {
                  const people = team.filter((m) => m.locationCodes.includes(l.code));
                  return (
                    <article key={l.code} aria-label={`${l.name} overview`} className="rounded-xl border border-border bg-card p-3">
                      <h5 className="text-xs font-semibold">{l.name}</h5>
                      <small className="text-[11px] text-muted-foreground">{l.address || "Location details pending"}</small>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {people.length ? (
                          people.map((m) => (
                            <button key={m.memberCode} type="button" onClick={() => onOpenMember(m.memberCode)} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] hover:bg-muted/70">
                              {m.name}
                            </button>
                          ))
                        ) : (
                          <small className="text-[11px] text-muted-foreground">No assigned members</small>
                        )}
                      </div>
                      <Button size="sm" variant="outline" className="org-noprint mt-2 h-7 text-[11px]" onClick={() => onAssign(l.code)}>
                        <Users className="h-3 w-3" /> Assign
                      </Button>
                    </article>
                  );
                })}
                <Button size="sm" variant="ghost" className="org-noprint" onClick={() => onAddLocation(type)}>
                  <Plus className="h-3.5 w-3.5" /> Add {LOCATION_TYPE_LABEL[type]}
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      <h4 className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> 03 / Tools assigned to members
      </h4>
      <div className="mt-2 divide-y divide-border" aria-label="Tools by member">
        {team.map((m) => {
          const tools = toolsOfMember(setup, businessCode, m.memberCode);
          return (
            <div key={m.memberCode} className="grid gap-2 py-3 sm:grid-cols-[160px_1fr]">
              <div>
                <b className="text-xs">{m.name}</b>
                <small className="block text-[10px] text-muted-foreground">{m.designation}</small>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {tools.length ? (
                  tools.map((t) => (
                    <span key={t.tool} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px]">
                      <ShieldCheck className="h-3 w-3 text-primary" aria-hidden />
                      {t.tool}
                    </span>
                  ))
                ) : (
                  <small className="text-[11px] text-muted-foreground">No tools assigned</small>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <h4 className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5" aria-hidden /> 04 / Assigned business
      </h4>
      <div className="mt-2 grid gap-3 sm:grid-cols-3" aria-label="Assigned business overview">
        {PARTY_GROUPS.map((g) => {
          const list = partiesOf(parties, businessCode, g.id);
          return (
            <section key={g.id} aria-label={`${g.label} overview`} className="rounded-xl border border-border p-3">
              <b className="text-xs">
                {g.label} <span className="font-normal text-muted-foreground">({list.length})</span>
              </b>
              {list.length ? (
                <ul className="mt-2 space-y-1">
                  {list.map((p) => (
                    <li key={`${p.type}:${p.id}`} className="text-[11px]">
                      {p.name}
                      <span className="text-muted-foreground"> · {team.find((m) => m.memberCode === p.responsibleMemberCode)?.name ?? "nobody responsible yet"}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">None assigned</p>
              )}
            </section>
          );
        })}
      </div>
      <p className="mt-4 text-[10px] text-muted-foreground">Lines in the first chart: reporting hierarchy. Member badges: assignments across locations. Tools are a record of what each person should be able to open.</p>
    </div>
  );
}
