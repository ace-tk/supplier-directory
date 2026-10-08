"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Building, Building2, Copy, KeyRound, Loader2, MapPin, Plus, Search, ShieldCheck, Store, UserPlus, Users, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignedBusinessStep, type AssignedBusinessActions } from "@/components/business-structure/AssignedBusiness";
import { StructureOverview } from "@/components/business-structure/StructureOverview";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DESIGNATIONS,
  PARTY_GROUPS,
  NO_ACCESS,
  PLANNED_TOOLS,
  TOOLS,
  VERTICALS,
  LOCATION_TYPE_LABEL,
  assignMembers,
  entityOf,
  groupOfParty,
  hasAnyAccess,
  membersWithTools,
  registerBusiness,
  removeLocation,
  removeTeamMember,
  saveLocation,
  saveTeamMember,
  setToolAccess,
  teamOf,
  toolAccessOf,
  updateBusiness,
  type AssignedParty,
  type Change,
  type LocationType,
  type ToolLevels,
  type SetupData,
  type TeamMember,
} from "@/lib/business-structure";
import { ROLE_PRESETS, type TeamRoleKey } from "@/lib/team-permissions";
import { assignPartyAction, getAssignedPartiesAction, getTeamDirectoryAction, saveBusinessSetupAction, searchPartiesAction, setPartyResponsibleAction, unassignPartyAction, type SetupResult, type TeamDirectoryEntry } from "@/services/business-structure";
import { inviteTeamMemberAction } from "@/services/team-management";

/** The server calls this screen makes. Passed in so the screen can be exercised without a server. */
export interface BusinessSetupActions extends AssignedBusinessActions {
  parties: () => Promise<{ success: true; data: AssignedParty[] } | { success: false; error: string }>;
  save: (setup: SetupData) => Promise<SetupResult>;
  teamDirectory: () => Promise<{ success: true; data: TeamDirectoryEntry[] } | { success: false; error: string }>;
  invite: (input: { name: string; email: string; roleKey: string; roleName?: string; department?: string; permissions: string[] }) => Promise<{ success: true; data: { token: string; existingUser: boolean } } | { success: false; error: string }>;
}

const REAL_ACTIONS: BusinessSetupActions = {
  save: saveBusinessSetupAction,
  teamDirectory: getTeamDirectoryAction,
  invite: inviteTeamMemberAction,
  parties: getAssignedPartiesAction,
  searchParties: searchPartiesAction,
  assignParty: assignPartyAction,
  setResponsible: setPartyResponsibleAction,
  unassignParty: unassignPartyAction,
};

const STEPS = ["01 · Team members", "02 · Verticals & locations", "03 · Tool access", "04 · Assigned business", "Structure overview"] as const;
const LOGIN_ROLES = (Object.entries(ROLE_PRESETS) as [TeamRoleKey, (typeof ROLE_PRESETS)[TeamRoleKey]][]).filter(([key]) => key !== "OWNER");

const fieldCls = "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary";
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

type Dialogs = null | { kind: "register" } | { kind: "business" } | { kind: "member"; memberCode?: string } | { kind: "location"; type: LocationType; locationCode?: string } | { kind: "assign"; locationCode: string };

const VERTICAL_ICON = { WAREHOUSE: Warehouse, RETAIL_STORE: Store, OFFICE: Building } as const;
const PLURAL: Record<LocationType, string> = { WAREHOUSE: "Warehouses", RETAIL_STORE: "Retail Stores", OFFICE: "Back Offices" };

export function BusinessSetup({ saved, onSaved, actions = REAL_ACTIONS }: { saved: SetupData; onSaved: (setup: SetupData) => void; actions?: BusinessSetupActions }) {
  const [selected, setSelected] = useState("");
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [directory, setDirectory] = useState<TeamDirectoryEntry[]>([]);
  const [parties, setParties] = useState<AssignedParty[]>([]);
  const [partiesLoaded, setPartiesLoaded] = useState(false);
  const [activation, setActivation] = useState<{ link: string; existing: boolean; name: string } | null>(null);

  const business = saved.businesses.find((b) => b.code === selected) ?? saved.businesses[0];
  const entity = business ? entityOf(saved, business.code) : undefined;
  const team = business ? teamOf(saved, business.code) : [];

  useEffect(() => {
    let live = true;
    void actions.teamDirectory().then((r) => live && r.success && setDirectory(r.data));
    void actions.parties().then((r) => {
      if (!live) return;
      if (r.success) setParties(r.data);
      setPartiesLoaded(true);
    });
    return () => {
      live = false;
    };
  }, [actions]);

  /** Saves a change made by one of the pure operations. Returns a message if it could not be done. */
  async function commit(change: Change): Promise<string | null> {
    if (!change.ok) return change.error;
    const result = await actions.save(change.setup);
    if (!result.success) return result.errors.slice(0, 3).join(" ");
    onSaved(result.data);
    return null;
  }

  const loginOf = (email: string) => (email ? directory.find((d) => d.email.toLowerCase() === email.toLowerCase()) : undefined);
  const memberCount = (code: string) => teamOf(saved, code).length;
  const locationCount = (code: string) => saved.locations.filter((l) => l.businessCode === code).length;
  const shown = team.filter((m) => `${m.name} ${m.designation}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">One business. One GST. One connected team.</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight">Build your business structure</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Register a business, add its team, assign locations and choose the tools each person can use. The admin always has full access; everyone else gets a login with a role.
        </p>
      </div>

      {/* Businesses */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="group" aria-label="Businesses">
        {saved.businesses.map((b, i) => {
          const e = entityOf(saved, b.code);
          const active = b.code === business?.code;
          return (
            <button
              key={b.code}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSelected(b.code);
                setSearch("");
              }}
              className={cn("rounded-2xl border p-4 text-left transition-colors", active ? "border-2 border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40")}
            >
              <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                <Building2 className="h-4 w-4" aria-hidden />
                <span className="sr-only">0{i + 1}</span>
              </span>
              <strong className="mt-3 block truncate text-base">{b.name}</strong>
              <small className="block text-xs text-muted-foreground">GST {e?.gstin || "not added"}</small>
              <small className="block text-xs text-muted-foreground">
                {memberCount(b.code)} members · {locationCount(b.code)} locations
              </small>
            </button>
          );
        })}
        <button type="button" onClick={() => setDialog({ kind: "register" })} className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary">
          <Plus className="h-5 w-5" aria-hidden />
          Register business
        </button>
      </div>

      {!business ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <p className="font-medium">No business yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Register your first business. Its GST is shared by every warehouse, store and back office under it.</p>
          <Button className="mt-4" onClick={() => setDialog({ kind: "register" })}>
            <Plus className="h-4 w-4" /> Register business
          </Button>
        </div>
      ) : (
        <>
          <section aria-label="Selected business" className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] bg-hero px-6 py-5 ring-1 ring-border">
            <div className="min-w-0">
              <small className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected business / {business.code}</small>
              <h3 className="truncate text-xl font-semibold">{business.name}</h3>
              <small className="text-xs text-muted-foreground">GST {entity?.gstin || "not added"} · Inherited by every warehouse, store and back office</small>
            </div>
            <Button variant="outline" onClick={() => setDialog({ kind: "business" })}>
              Edit business
            </Button>
          </section>

          <div role="tablist" aria-label="Setup steps" className="flex flex-wrap gap-2">
            {STEPS.map((label, i) => (
              <button key={label} type="button" role="tab" aria-selected={step === i} onClick={() => setStep(i)} className={cn("rounded-lg border px-4 py-2 text-sm", step === i ? "border-primary/50 bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
            <section role="tabpanel" aria-label={STEPS[step]} className="min-w-0 rounded-2xl border border-border bg-card p-5">
              {step === 0 ? (
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">Start with your people</h3>
                      <p className="text-xs text-muted-foreground">One team directory for {business.name}</p>
                    </div>
                    <Button onClick={() => setDialog({ kind: "member" })}>
                      <UserPlus className="h-4 w-4" /> Add member
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="relative block w-full max-w-60">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members or designation" aria-label="Search members" className={cn(fieldCls, "pl-8")} />
                    </label>
                    <small className="text-xs text-muted-foreground">{team.length} team member{team.length === 1 ? "" : "s"}</small>
                  </div>
                  {shown.length ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {shown.map((m) => (
                        <MemberCard key={m.memberCode} member={m} setup={saved} login={loginOf(m.email)?.roleName} onEdit={() => setDialog({ kind: "member", memberCode: m.memberCode })} />
                      ))}
                    </div>
                  ) : (
                    <p className="py-10 text-center text-sm text-muted-foreground">{team.length ? "No matching members." : "No team members yet. Add the first person to start."}</p>
                  )}
                </div>
              ) : step === 1 ? (
                <VerticalsStep
                  setup={saved}
                  businessCode={business.code}
                  gstin={entity?.gstin ?? ""}
                  businessName={business.name}
                  team={team}
                  onAdd={(type) => setDialog({ kind: "location", type })}
                  onEdit={(type, locationCode) => setDialog({ kind: "location", type, locationCode })}
                  onAssign={(locationCode) => setDialog({ kind: "assign", locationCode })}
                  onGoToTeam={() => setStep(0)}
                />
              ) : step === 2 ? (
                <ToolAccessStep
                  setup={saved}
                  businessCode={business.code}
                  businessName={business.name}
                  team={team}
                  onChange={async (memberCode, tool, levels) => commit(setToolAccess(saved, business.code, memberCode, tool, levels))}
                  onGoToTeam={() => setStep(0)}
                />
              ) : step === 3 ? (
                <AssignedBusinessStep businessCode={business.code} businessName={business.name} team={team} parties={parties} loaded={partiesLoaded} actions={actions} onParties={setParties} />
              ) : (
                <StructureOverview
                  setup={saved}
                  businessCode={business.code}
                  businessName={business.name}
                  gstin={entity?.gstin ?? ""}
                  team={team}
                  parties={parties}
                  onOpenMember={(memberCode) => setDialog({ kind: "member", memberCode })}
                  onAssign={(locationCode) => setDialog({ kind: "assign", locationCode })}
                  onAddLocation={(type) => setDialog({ kind: "location", type })}
                />
              )}
            </section>

            <aside aria-label="Live structure" className="rounded-2xl border border-border bg-card p-5 lg:sticky lg:top-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Live structure</p>
              <h3 className="mt-2 text-lg font-semibold">{business.name}</h3>
              <small className="text-xs text-muted-foreground">{entity?.gstin || "GST not added"}</small>
              <div className="mt-4 space-y-4 text-xs">
                <div className="border-l-2 border-border pl-3">
                  <h4 className="text-sm font-semibold">01 / Team</h4>
                  <p className="mt-1">{team.length} people in this business</p>
                  <p>{team.filter((m) => m.locationCodes.length).length} assigned to locations</p>
                </div>
                <div className="border-l-2 border-border pl-3">
                  <h4 className="text-sm font-semibold">02 / Verticals</h4>
                  {VERTICALS.map((t) => (
                    <p key={t} className="mt-1">
                      {LOCATION_TYPE_LABEL[t]} <b>{saved.locations.filter((l) => l.businessCode === business.code && l.type === t).length}</b>
                    </p>
                  ))}
                </div>
                <div className="border-l-2 border-border pl-3">
                  <h4 className="text-sm font-semibold">04 / Assigned</h4>
                  {PARTY_GROUPS.map((g) => (
                    <p key={g.id} className="mt-1">
                      {g.label} <b>{parties.filter((p) => p.businessCode === business.code && groupOfParty(p.type) === g.id).length}</b>
                    </p>
                  ))}
                </div>
                <div className="border-l-2 border-border pl-3">
                  <h4 className="text-sm font-semibold">03 / Tools</h4>
                  <p className="mt-1">{membersWithTools(saved, business.code)} {membersWithTools(saved, business.code) === 1 ? "member" : "members"} with tool access</p>
                </div>
              </div>
              <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">A member can belong to several locations. Their identity stays in this business&apos;s team.</p>
            </aside>
          </div>
        </>
      )}

      {dialog?.kind === "register" && <RegisterDialog onClose={() => setDialog(null)} onSave={async (v) => {
        const change = registerBusiness(saved, v);
        const error = await commit(change);
        if (!error && change.ok) {
          setSelected(change.code);
          toast.success("Business registered");
        }
        return error;
      }} />}
      {dialog?.kind === "business" && business && (
        <BusinessDialog
          name={business.name}
          gstin={entity?.gstin ?? ""}
          onClose={() => setDialog(null)}
          onSave={async (v) => {
            const error = await commit(updateBusiness(saved, business.code, v));
            if (!error) toast.success("Business updated");
            return error;
          }}
        />
      )}
      {dialog?.kind === "member" && business && (
        <MemberDialog
          key={dialog.memberCode ?? "new"}
          member={dialog.memberCode ? team.find((t) => t.memberCode === dialog.memberCode) : undefined}
          team={team}
          directory={directory}
          onClose={() => setDialog(null)}
          onSave={async (input, login) => {
            const error = await commit(saveTeamMember(saved, business.code, input));
            if (error) return error;
            toast.success(input.memberCode ? "Member updated" : "Member added");
            if (login) {
              const preset = ROLE_PRESETS[login.roleKey];
              const invited = await actions.invite({ name: input.name.trim(), email: input.email.trim().toLowerCase(), roleKey: login.roleKey, roleName: preset.name, department: preset.department, permissions: [...preset.permissions] });
              if (!invited.success) toast.error(`Member saved, but the login could not be created: ${invited.error}`);
              else {
                setActivation({ link: `${window.location.origin}${invited.data.existingUser ? "/accept-team-invite" : "/reset-password"}?token=${invited.data.token}`, existing: invited.data.existingUser, name: input.name.trim() });
                void actions.teamDirectory().then((r) => r.success && setDirectory(r.data));
              }
            }
            return null;
          }}
          onRemove={async (code) => {
            const error = await commit(removeTeamMember(saved, business.code, code));
            if (!error) toast.success("Removed from this business");
            return error;
          }}
        />
      )}
      {dialog?.kind === "location" && business && (
        <LocationDialog
          key={dialog.locationCode ?? `new-${dialog.type}`}
          type={dialog.type}
          location={dialog.locationCode ? saved.locations.find((l) => l.code === dialog.locationCode) : undefined}
          suggested={`${LOCATION_TYPE_LABEL[dialog.type]} ${saved.locations.filter((l) => l.businessCode === business.code && l.type === dialog.type).length + 1}`}
          businessName={business.name}
          gstin={entity?.gstin ?? ""}
          onClose={() => setDialog(null)}
          onSave={async (v) => {
            const error = await commit(saveLocation(saved, business.code, { locationCode: dialog.locationCode, type: dialog.type, ...v }));
            if (!error) toast.success(dialog.locationCode ? "Location updated" : `${LOCATION_TYPE_LABEL[dialog.type]} added`);
            return error;
          }}
          onDelete={async (code) => {
            const error = await commit(removeLocation(saved, code));
            if (!error) toast.success("Location deleted");
            return error;
          }}
        />
      )}
      {dialog?.kind === "assign" && business && (
        <AssignDialog
          key={dialog.locationCode}
          location={saved.locations.find((l) => l.code === dialog.locationCode)}
          team={team}
          businessName={business.name}
          onClose={() => setDialog(null)}
          onSave={async (codes) => {
            const error = await commit(assignMembers(saved, business.code, dialog.locationCode, codes));
            if (!error) toast.success("Assignments updated");
            return error;
          }}
        />
      )}
      <Dialog open={Boolean(activation)} onOpenChange={(v) => !v && setActivation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Login created for {activation?.name}</DialogTitle>
            <DialogDescription>Email delivery is not configured. Copy and send this one-time link to them.</DialogDescription>
          </DialogHeader>
          {activation && (
            <div className="space-y-3">
              <p className="break-all rounded-xl border bg-muted/40 p-3 font-mono text-xs">{activation.link}</p>
              <p className="text-xs text-muted-foreground">{activation.existing ? "This email already has a SupplyBase account. They must sign in with it and confirm the invitation." : "They will set their own password from this link."}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={async () => {
                if (!activation) return;
                await navigator.clipboard.writeText(activation.link);
                toast.success("Link copied");
              }}
            >
              <Copy className="h-4 w-4" /> Copy link
            </Button>
            <Button onClick={() => setActivation(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MemberCard({ member, setup, login, onEdit }: { member: TeamMember; setup: SetupData; login?: string; onEdit: () => void }) {
  const boss = setup.members.find((m) => m.code === member.reportsToCode);
  const places = member.locationCodes.map((c) => setup.locations.find((l) => l.code === c)?.name).filter(Boolean) as string[];
  return (
    <article className="rounded-xl border border-border p-4" aria-label={member.name}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary" aria-hidden>
        {initials(member.name) || <Users className="h-4 w-4" />}
      </div>
      <h4 className="mt-3 text-sm font-semibold">{member.name}</h4>
      <p className="mt-1 text-xs text-muted-foreground">{member.designation}</p>
      <p className="mt-1 text-xs text-muted-foreground">Reports to {boss?.name ?? "—"}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {places.length ? places.map((p) => <span key={p} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px]"><MapPin className="h-3 w-3" aria-hidden />{p}</span>) : <small className="text-xs text-muted-foreground">Unassigned</small>}
      </div>
      <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        <KeyRound className="h-3 w-3" aria-hidden /> {login ? `Login · ${login}` : "No login"}
      </p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onEdit}>
        Edit profile
      </Button>
    </article>
  );
}

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Modal({ title, description, onClose, onSubmit, submitLabel, children, extraFooter }: { title: string; description?: string; onClose: () => void; onSubmit: () => Promise<void>; submitLabel: string; children: React.ReactNode; extraFooter?: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await onSubmit();
            setBusy(false);
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
          <DialogFooter className="sm:justify-between">
            <div>{extraFooter}</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {submitLabel}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-sm text-rose-ink">
      {message}
    </p>
  ) : null;
}

function RegisterDialog({ onClose, onSave }: { onClose: () => void; onSave: (v: { businessName: string; legalName: string; gstin: string }) => Promise<string | null> }) {
  const [v, setV] = useState({ businessName: "", legalName: "", gstin: "" });
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="Register business"
      description="The company's GST is shared by every warehouse, retail store and back office under it."
      onClose={onClose}
      submitLabel="Register"
      onSubmit={async () => {
        const e = await onSave(v);
        if (e) setError(e);
        else onClose();
      }}
    >
      <Field id="reg-name" label="Business name">
        <Input id="reg-name" value={v.businessName} onChange={(e) => setV({ ...v, businessName: e.target.value })} autoFocus />
      </Field>
      <Field id="reg-legal" label="Company legal name" hint="Leave blank to use the business name.">
        <Input id="reg-legal" value={v.legalName} onChange={(e) => setV({ ...v, legalName: e.target.value })} />
      </Field>
      <Field id="reg-gst" label="GSTIN" hint="15 characters, for example 27AAAAA0001A1Z1. Can be added later.">
        <Input id="reg-gst" value={v.gstin} onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })} maxLength={15} />
      </Field>
      <ErrorLine message={error} />
    </Modal>
  );
}

function BusinessDialog({ name, gstin, onClose, onSave }: { name: string; gstin: string; onClose: () => void; onSave: (v: { name: string; gstin: string }) => Promise<string | null> }) {
  const [v, setV] = useState({ name, gstin });
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title="Edit business"
      description="All locations inherit this GST. A different GST starts a different company."
      onClose={onClose}
      submitLabel="Save changes"
      onSubmit={async () => {
        const e = await onSave(v);
        if (e) setError(e);
        else onClose();
      }}
    >
      <Field id="biz-name" label="Business name">
        <Input id="biz-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <Field id="biz-gst" label="GSTIN">
        <Input id="biz-gst" value={v.gstin} onChange={(e) => setV({ ...v, gstin: e.target.value.toUpperCase() })} maxLength={15} />
      </Field>
      <ErrorLine message={error} />
    </Modal>
  );
}

function MemberDialog({
  member,
  team,
  directory,
  onClose,
  onSave,
  onRemove,
}: {
  member?: TeamMember;
  team: TeamMember[];
  directory: TeamDirectoryEntry[];
  onClose: () => void;
  onSave: (input: { memberCode?: string; name: string; designation: string; reportsToCode: string; email: string; mobile: string }, login: { roleKey: TeamRoleKey } | null) => Promise<string | null>;
  onRemove: (memberCode: string) => Promise<string | null>;
}) {
  const [v, setV] = useState({ name: member?.name ?? "", designation: member?.designation ?? "", reportsToCode: member?.reportsToCode ?? "", email: member?.email ?? "", mobile: member?.mobile ?? "" });
  const [giveLogin, setGiveLogin] = useState(false);
  const [roleKey, setRoleKey] = useState<TeamRoleKey>(LOGIN_ROLES[0][0]);
  const [error, setError] = useState<string | null>(null);
  const hasLogin = directory.some((d) => v.email && d.email.toLowerCase() === v.email.trim().toLowerCase());
  const onTeam = new Set(team.map((t) => t.email.toLowerCase()).filter(Boolean));
  const pickable = directory.filter((d) => !onTeam.has(d.email.toLowerCase()));

  return (
    <Modal
      title={member ? "Edit member" : "Add team member"}
      description="They join this business's team. Locations and tool access come in the next steps."
      onClose={onClose}
      submitLabel={member ? "Save changes" : "Add member"}
      extraFooter={
        member ? (
          <Button
            type="button"
            variant="ghost"
            className="text-rose-ink hover:text-rose-ink"
            onClick={async () => {
              const e = await onRemove(member.memberCode);
              if (e) setError(e);
              else onClose();
            }}
          >
            Remove from this business
          </Button>
        ) : null
      }
      onSubmit={async () => {
        const e = await onSave({ memberCode: member?.memberCode, ...v }, giveLogin && !hasLogin ? { roleKey } : null);
        if (e) setError(e);
        else onClose();
      }}
    >
      {!member && pickable.length > 0 && (
        <Field id="mem-pick" label="Pick from Team Management (optional)" hint="People who already have a SupplyBase login.">
          <select
            id="mem-pick"
            className={fieldCls}
            value=""
            onChange={(e) => {
              const d = pickable.find((x) => x.userId === e.target.value);
              if (d) setV((cur) => ({ ...cur, name: d.name, email: d.email }));
            }}
          >
            <option value="">— choose a person —</option>
            {pickable.map((d) => (
              <option key={d.userId} value={d.userId}>
                {d.name} — {d.roleName}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field id="mem-name" label="Member name">
        <Input id="mem-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />
      </Field>
      <Field id="mem-role" label="Designation">
        <select id="mem-role" className={fieldCls} value={v.designation} onChange={(e) => setV({ ...v, designation: e.target.value })}>
          <option value="">— choose —</option>
          {DESIGNATIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </Field>
      <Field id="mem-boss" label="Reports to">
        <select id="mem-boss" className={fieldCls} value={v.reportsToCode} onChange={(e) => setV({ ...v, reportsToCode: e.target.value })}>
          <option value="">No manager / top level</option>
          {team
            .filter((t) => t.memberCode !== member?.memberCode)
            .map((t) => (
              <option key={t.memberCode} value={t.memberCode}>
                {t.name} — {t.designation}
              </option>
            ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="mem-email" label="Email">
          <Input id="mem-email" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        </Field>
        <Field id="mem-mobile" label="Mobile">
          <Input id="mem-mobile" value={v.mobile} onChange={(e) => setV({ ...v, mobile: e.target.value })} />
        </Field>
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-3">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> Login
        </p>
        {hasLogin ? (
          <p className="mt-1 text-xs text-muted-foreground">This person already has a SupplyBase login (see Team Management).</p>
        ) : (
          <>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={giveLogin} disabled={!v.email.trim()} onChange={(e) => setGiveLogin(e.target.checked)} />
              Give this person a SupplyBase login
            </label>
            {!v.email.trim() && <p className="mt-1 text-xs text-muted-foreground">Add their email to give them a login.</p>}
            {giveLogin && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="mem-login-role">Role</Label>
                <select id="mem-login-role" className={fieldCls} value={roleKey} onChange={(e) => setRoleKey(e.target.value as TeamRoleKey)}>
                  {LOGIN_ROLES.map(([key, role]) => (
                    <option key={key} value={key}>
                      {role.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Uses the Team Management roles and counts toward the seat limit. The admin always has full access.</p>
              </div>
            )}
          </>
        )}
      </div>
      <ErrorLine message={error} />
    </Modal>
  );
}

function VerticalsStep({
  setup,
  businessCode,
  businessName,
  gstin,
  team,
  onAdd,
  onEdit,
  onAssign,
  onGoToTeam,
}: {
  setup: SetupData;
  businessCode: string;
  businessName: string;
  gstin: string;
  team: TeamMember[];
  onAdd: (type: LocationType) => void;
  onEdit: (type: LocationType, locationCode: string) => void;
  onAssign: (locationCode: string) => void;
  onGoToTeam: () => void;
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold">Three verticals. One GST.</h3>
      <p className="text-sm text-muted-foreground">Add as many locations as you need, then assign people from {businessName}&apos;s team.</p>
      {!team.length && (
        <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          There is nobody on the team yet.{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={onGoToTeam}>
            Add team members first
          </button>{" "}
          to assign them to locations.
        </p>
      )}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {VERTICALS.map((type) => {
          const Icon = VERTICAL_ICON[type];
          const locations = setup.locations.filter((l) => l.businessCode === businessCode && l.type === type);
          return (
            <section key={type} aria-label={PLURAL[type]} className="rounded-xl border border-border bg-muted/20 p-3">
              <h4 className="flex items-center gap-2 px-1 pb-3 pt-1 text-sm font-semibold">
                <Icon className="h-4 w-4 text-primary" aria-hidden /> {PLURAL[type]}
                <span className="ml-auto text-xs font-normal text-muted-foreground">{locations.length}</span>
              </h4>
              <div className="space-y-3">
                {locations.map((l) => {
                  const people = team.filter((m) => m.locationCodes.includes(l.code));
                  return (
                    <article key={l.code} aria-label={l.name} className="rounded-xl border border-border bg-card p-3">
                      <h5 className="text-sm font-semibold">{l.name}</h5>
                      <p className="mt-1 text-xs text-muted-foreground">{l.address || "Address not added"}</p>
                      <small className="text-[11px] text-muted-foreground">{gstin || "GST not added"}</small>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {people.length ? people.map((m) => <span key={m.memberCode} className="rounded-md bg-muted px-2 py-0.5 text-[11px]">{m.name}</span>) : <small className="text-xs text-muted-foreground">No members assigned</small>}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => onAssign(l.code)}>
                          Assign members
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onEdit(type, l.code)}>
                          Edit
                        </Button>
                      </div>
                    </article>
                  );
                })}
                <Button variant="outline" className="w-full" onClick={() => onAdd(type)}>
                  <Plus className="h-4 w-4" /> Add {LOCATION_TYPE_LABEL[type]}
                </Button>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function LocationDialog({
  type,
  location,
  suggested,
  businessName,
  gstin,
  onClose,
  onSave,
  onDelete,
}: {
  type: LocationType;
  location?: { code: string; name: string; address: string };
  suggested: string;
  businessName: string;
  gstin: string;
  onClose: () => void;
  onSave: (v: { name: string; address: string }) => Promise<string | null>;
  onDelete: (code: string) => Promise<string | null>;
}) {
  const [v, setV] = useState({ name: location?.name ?? suggested, address: location?.address ?? "" });
  const [error, setError] = useState<string | null>(null);
  const label = LOCATION_TYPE_LABEL[type];
  return (
    <Modal
      title={location ? `Edit ${label}` : `Add ${label}`}
      onClose={onClose}
      submitLabel={location ? "Save changes" : `Add ${label}`}
      extraFooter={
        location ? (
          <Button
            type="button"
            variant="ghost"
            className="text-rose-ink hover:text-rose-ink"
            onClick={async () => {
              if (!window.confirm(`Delete ${location.name}? The people assigned to it stay on the team, unassigned.`)) return;
              const e = await onDelete(location.code);
              if (e) setError(e);
              else onClose();
            }}
          >
            Delete location
          </Button>
        ) : null
      }
      onSubmit={async () => {
        const e = await onSave(v);
        if (e) setError(e);
        else onClose();
      }}
    >
      <Field id="loc-name" label="Location name">
        <Input id="loc-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} autoFocus />
      </Field>
      <Field id="loc-address" label="Address">
        <Input id="loc-address" value={v.address} onChange={(e) => setV({ ...v, address: e.target.value })} />
      </Field>
      <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
        {businessName} · GST {gstin || "not added"}
        <br />
        Inherited automatically from this business.
      </p>
      <ErrorLine message={error} />
    </Modal>
  );
}

function AssignDialog({ location, team, businessName, onClose, onSave }: { location?: { code: string; name: string }; team: TeamMember[]; businessName: string; onClose: () => void; onSave: (memberCodes: string[]) => Promise<string | null> }) {
  const [picked, setPicked] = useState<string[]>(() => (location ? team.filter((m) => m.locationCodes.includes(location.code)).map((m) => m.memberCode) : []));
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      title={`Assign members · ${location?.name ?? ""}`}
      description={`Select from ${businessName}'s team. Members can also be assigned to other locations.`}
      onClose={onClose}
      submitLabel="Save assignments"
      onSubmit={async () => {
        const e = await onSave(picked);
        if (e) setError(e);
        else onClose();
      }}
    >
      {team.length ? (
        <div className="space-y-2">
          {team.map((m) => (
            <label key={m.memberCode} className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
              <input type="checkbox" checked={picked.includes(m.memberCode)} onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, m.memberCode] : cur.filter((c) => c !== m.memberCode)))} />
              {m.name}
              <small className="ml-auto text-xs text-muted-foreground">{m.designation}</small>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">There is nobody on the team yet. Add team members in step 01 first.</p>
      )}
      <ErrorLine message={error} />
    </Modal>
  );
}

function ToolAccessStep({
  setup,
  businessCode,
  businessName,
  team,
  onChange,
  onGoToTeam,
}: {
  setup: SetupData;
  businessCode: string;
  businessName: string;
  team: TeamMember[];
  onChange: (memberCode: string, tool: string, levels: ToolLevels) => Promise<string | null>;
  onGoToTeam: () => void;
}) {
  const [picked, setPicked] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!team.length) {
    return (
      <div className="py-10 text-center">
        <h3 className="text-lg font-semibold">Assign tools to team members</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your team before assigning tools.{" "}
          <button type="button" className="font-medium text-primary hover:underline" onClick={onGoToTeam}>
            Go to team members
          </button>
        </p>
      </div>
    );
  }

  const member = team.find((m) => m.memberCode === picked) ?? team[0];
  const access = toolAccessOf(setup, businessCode, member.memberCode);
  const on = [...access.values()].filter(hasAnyAccess).length;
  const places = member.locationCodes.map((c) => setup.locations.find((l) => l.code === c)?.name).filter(Boolean);

  /** One change at a time: each one is saved before the next is made, so none is lost. */
  async function change(tool: string, levels: ToolLevels) {
    setBusy(true);
    setError(await onChange(member.memberCode, tool, levels));
    setBusy(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Assign tools to team members</h3>
          <p className="text-xs text-muted-foreground">Tool access belongs to the selected member within {businessName}.</p>
        </div>
        <span className="rounded-md bg-muted px-2 py-1 text-xs">{businessName}</span>
      </div>

      <div className="mt-4 space-y-1.5">
        <Label htmlFor="tool-member">Select team member</Label>
        <select id="tool-member" className={fieldCls} value={member.memberCode} onChange={(e) => setPicked(e.target.value)}>
          {team.map((m) => (
            <option key={m.memberCode} value={m.memberCode}>
              {m.name} — {m.designation}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
        <b>{member.name}</b> · {member.designation}
        <br />
        <span className="text-xs text-muted-foreground">Locations: {places.length ? places.join(" · ") : "Not assigned yet"}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground" role="status">
          {on} of {TOOLS.length} tools on
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
          Advanced: Create, Edit, Approve
        </label>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2" role="group" aria-label={`Tools for ${member.name}`}>
        {TOOLS.map((tool) => {
          const levels = access.get(tool) ?? NO_ACCESS;
          return (
            <div key={tool} className={cn("rounded-lg border p-3 text-sm", levels.view ? "border-primary/40 bg-primary/5" : "border-border")}>
              <label className="flex items-center gap-2">
                <input type="checkbox" aria-label={tool} checked={levels.view} disabled={busy} onChange={(e) => void change(tool, e.target.checked ? { ...NO_ACCESS, view: true } : NO_ACCESS)} />
                <span className="font-medium">{tool}</span>
                {PLANNED_TOOLS.includes(tool) && <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Not built yet</span>}
              </label>
              {advanced && (
                <div className="mt-2 flex gap-4 pl-6 text-xs">
                  {(["create", "edit", "approve"] as const).map((level) => (
                    <label key={level} className="flex items-center gap-1.5">
                      <input type="checkbox" aria-label={`${tool} ${level}`} checked={levels[level]} disabled={busy} onChange={(e) => void change(tool, { ...levels, [level]: e.target.checked })} />
                      {level[0].toUpperCase() + level.slice(1)}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ErrorLine message={error} />
      <p className="mt-4 text-xs text-muted-foreground">
        Switches save immediately. A designation does not turn tools on by itself. The admin always has full access. This records what each person should be able to open; their login is set by the role in Team Management.
        Tools marked &quot;Not built yet&quot; have no module in SupplyBase yet.
      </p>
    </div>
  );
}
