"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Briefcase, Loader2, Plus, Search, ShoppingBag, Truck, UserSquare2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  PARTY_GROUPS,
  groupOfParty,
  partiesOf,
  partyKey,
  withParty,
  withoutParty,
  type AssignedParty,
  type PartyCandidate,
  type PartyGroup,
  type PartyType,
  type TeamMember,
} from "@/lib/business-structure";

type Result<T> = { success: true; data: T } | { success: false; error: string };

/** The server calls this step makes. Passed in so the step can be exercised without a server. */
export interface AssignedBusinessActions {
  searchParties: (group: PartyGroup, query: string) => Promise<Result<PartyCandidate[]>>;
  assignParty: (input: { businessCode: string; type: PartyType; id: string; responsibleMemberCode?: string }) => Promise<Result<AssignedParty>>;
  setResponsible: (input: { businessCode: string; type: PartyType; id: string; responsibleMemberCode: string }) => Promise<Result<AssignedParty>>;
  unassignParty: (input: { businessCode: string; type: PartyType; id: string }) => Promise<Result<null>>;
}

const ICON: Record<PartyGroup, typeof ShoppingBag> = { BUYER: ShoppingBag, SUPPLIER: Truck, FREELANCER: UserSquare2 };
const fieldCls = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary";

/** Step "Assigned business": the buyers, suppliers and freelancers connected to this business, each with a responsible team member. */
export function AssignedBusinessStep({
  businessCode,
  businessName,
  team,
  parties,
  loaded,
  actions,
  onParties,
}: {
  businessCode: string;
  businessName: string;
  team: TeamMember[];
  parties: AssignedParty[];
  loaded: boolean;
  actions: AssignedBusinessActions;
  onParties: (next: AssignedParty[]) => void;
}) {
  const [picker, setPicker] = useState<PartyGroup | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function changeResponsible(p: AssignedParty, responsibleMemberCode: string) {
    setBusy(partyKey(p));
    const r = await actions.setResponsible({ businessCode, type: p.type, id: p.id, responsibleMemberCode });
    setBusy(null);
    if (r.success) onParties(withParty(parties, r.data));
    else toast.error(r.error);
  }

  async function remove(p: AssignedParty) {
    setBusy(partyKey(p));
    const r = await actions.unassignParty({ businessCode, type: p.type, id: p.id });
    setBusy(null);
    if (r.success) {
      onParties(withoutParty(parties, businessCode, p.type, p.id));
      toast.success(`${p.name} removed from ${businessName}`);
    } else toast.error(r.error);
  }

  return (
    <div>
      <h3 className="text-lg font-semibold">Assigned business</h3>
      <p className="text-sm text-muted-foreground">The buyers, suppliers and freelancers connected to {businessName}. Choose who on the team looks after each of them.</p>
      {!loaded && <p className="mt-3 text-xs text-muted-foreground">Loading…</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {PARTY_GROUPS.map((g) => {
          const Icon = ICON[g.id];
          const list = partiesOf(parties, businessCode, g.id);
          return (
            <section key={g.id} aria-label={g.label} className="rounded-xl border border-border bg-muted/20 p-3">
              <h4 className="flex items-center gap-2 px-1 pb-3 pt-1 text-sm font-semibold">
                <Icon className="h-4 w-4 text-primary" aria-hidden /> {g.label}
                <span className="ml-auto text-xs font-normal text-muted-foreground">{list.length}</span>
              </h4>
              <div className="space-y-3">
                {list.map((p) => (
                  <article key={partyKey(p)} aria-label={p.name} className="rounded-xl border border-border bg-card p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <h5 className="truncate text-sm font-semibold">{p.name}</h5>
                        <p className="truncate text-xs text-muted-foreground">{p.detail || "—"}</p>
                      </div>
                      <button type="button" aria-label={`Remove ${p.name}`} disabled={busy === partyKey(p)} onClick={() => void remove(p)} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-red-600 disabled:opacity-50">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <label className="mt-2 block text-[11px] text-muted-foreground" htmlFor={`resp-${partyKey(p)}`}>
                      Responsible team member
                    </label>
                    <select id={`resp-${partyKey(p)}`} className={`${fieldCls} mt-1`} value={p.responsibleMemberCode} disabled={busy === partyKey(p)} onChange={(e) => void changeResponsible(p, e.target.value)}>
                      <option value="">— nobody yet —</option>
                      {team.map((m) => (
                        <option key={m.memberCode} value={m.memberCode}>
                          {m.name} — {m.designation}
                        </option>
                      ))}
                    </select>
                  </article>
                ))}
                {!list.length && loaded && <p className="px-1 text-xs text-muted-foreground">No {g.label.toLowerCase()} assigned yet.</p>}
                <Button variant="outline" className="w-full" onClick={() => setPicker(g.id)}>
                  <Plus className="h-4 w-4" /> Assign {g.one}
                </Button>
              </div>
            </section>
          );
        })}
      </div>

      {!team.length && <p className="mt-3 text-xs text-muted-foreground">Add team members to choose who is responsible.</p>}
      <p className="mt-4 text-xs text-muted-foreground">A buyer, supplier or freelancer can be connected to more than one business. Removing them here does not delete them from SupplyBase.</p>

      {picker && (
        <PartyPicker
          group={picker}
          businessCode={businessCode}
          businessName={businessName}
          taken={new Set(parties.filter((p) => p.businessCode === businessCode).map(partyKey))}
          actions={actions}
          onAssigned={(p) => onParties(withParty(parties, p))}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}

function PartyPicker({
  group,
  businessCode,
  businessName,
  taken,
  actions,
  onAssigned,
  onClose,
}: {
  group: PartyGroup;
  businessCode: string;
  businessName: string;
  taken: Set<string>;
  actions: AssignedBusinessActions;
  onAssigned: (p: AssignedParty) => void;
  onClose: () => void;
}) {
  const meta = PARTY_GROUPS.find((g) => g.id === group)!;
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<PartyCandidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  // Searches as the person types, a moment after they stop.
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const r = await actions.searchParties(group, query);
      if (!live) return;
      if (r.success) {
        setFound(r.data);
        setError(null);
      } else setError(r.error);
    }, query ? 250 : 0);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [actions, group, query]);

  async function assign(c: PartyCandidate) {
    setWorking(partyKey(c));
    const r = await actions.assignParty({ businessCode, type: c.type, id: c.id });
    setWorking(null);
    if (r.success) {
      onAssigned(r.data);
      toast.success(`${c.name} assigned to ${businessName}`);
    } else setError(r.error);
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign {meta.one}</DialogTitle>
          <DialogDescription>Pick from the {meta.label.toLowerCase()} already in SupplyBase. They are connected to {businessName}.</DialogDescription>
        </DialogHeader>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${meta.label.toLowerCase()}`} aria-label={`Search ${meta.label.toLowerCase()}`} className={`${fieldCls} pl-8`} autoFocus />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="space-y-2" aria-label="Search results">
          {found === null ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching…
            </p>
          ) : found.length ? (
            found.map((c) => {
              const isTaken = taken.has(partyKey(c));
              return (
                <div key={partyKey(c)} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                  <Briefcase className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.detail || "—"}
                      {groupOfParty(c.type) === "SUPPLIER" && c.type === "SUPPLIER_LISTING" ? " · directory listing" : ""}
                    </p>
                  </div>
                  {isTaken ? (
                    <span className="text-xs text-muted-foreground">Assigned</span>
                  ) : (
                    <Button size="sm" variant="outline" disabled={working === partyKey(c)} onClick={() => void assign(c)} aria-label={`Assign ${c.name}`}>
                      Assign
                    </Button>
                  )}
                </div>
              );
            })
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">{query ? `No ${meta.label.toLowerCase()} match “${query}”.` : `There are no ${meta.label.toLowerCase()} in SupplyBase yet.`}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
