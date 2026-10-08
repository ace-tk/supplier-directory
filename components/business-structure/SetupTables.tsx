"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DESIGNATIONS,
  ID_PREFIX,
  LOCATION_TYPE_LABEL,
  LOCATION_TYPES,
  TOOLS,
  nextCode,
  type SetupData,
} from "@/lib/business-structure";
import { saveBusinessSetupAction } from "@/services/business-structure";

type TableKey = "entities" | "businesses" | "locations" | "members" | "assignments" | "access";
type Row = Record<string, string | boolean>;

const TABLES: { key: TableKey; label: string }[] = [
  { key: "entities", label: "Legal Entities" },
  { key: "businesses", label: "Businesses" },
  { key: "locations", label: "Locations" },
  { key: "members", label: "Members" },
  { key: "assignments", label: "Assignments" },
  { key: "access", label: "Tool Access" },
];

/** The sheet's columns, as the prototype shows them. `required` columns are checked on save. */
interface Column {
  field: string;
  label: string;
  required?: boolean;
  kind: "text" | "select" | "check";
  options?: readonly string[] | { value: string; label: string }[];
}

const ENTITY_COLS: Column[] = [
  { field: "code", label: "ID", kind: "text" },
  { field: "legalName", label: "Legal name", required: true, kind: "text" },
  { field: "gstin", label: "GSTIN", kind: "text" },
  { field: "registeredAddress", label: "Registered address", kind: "text" },
];
const BUSINESS_COLS: Column[] = [
  { field: "code", label: "ID", kind: "text" },
  { field: "entityCode", label: "Entity ID", required: true, kind: "select" },
  { field: "name", label: "Business name", required: true, kind: "text" },
  { field: "operationalAddress", label: "Operational address", kind: "text" },
];
const LOCATION_COLS: Column[] = [
  { field: "code", label: "ID", kind: "text" },
  { field: "businessCode", label: "Business ID", required: true, kind: "select" },
  { field: "type", label: "Type", required: true, kind: "select", options: LOCATION_TYPES.map((t) => ({ value: t, label: LOCATION_TYPE_LABEL[t] })) },
  { field: "name", label: "Name", required: true, kind: "text" },
  { field: "address", label: "Address", kind: "text" },
  { field: "mapPin", label: "Map pin", kind: "text" },
];
const MEMBER_COLS: Column[] = [
  { field: "code", label: "ID", kind: "text" },
  { field: "name", label: "Name", required: true, kind: "text" },
  { field: "mobile", label: "Mobile", kind: "text" },
  { field: "email", label: "Email", kind: "text" },
  { field: "photoUrl", label: "Photo (link)", kind: "text" },
];
const ASSIGNMENT_COLS: Column[] = [
  { field: "code", label: "ID", kind: "text" },
  { field: "memberCode", label: "Member ID", required: true, kind: "select" },
  { field: "businessCode", label: "Business ID", required: true, kind: "select" },
  { field: "locationCode", label: "Location ID", kind: "select" },
  { field: "designation", label: "Designation", required: true, kind: "select", options: DESIGNATIONS },
  { field: "reportsToCode", label: "Reports-to ID", kind: "select" },
];
const ACCESS_COLS: Column[] = [
  { field: "assignmentCode", label: "Assignment ID", required: true, kind: "select" },
  { field: "tool", label: "Tool", required: true, kind: "select", options: TOOLS },
  { field: "view", label: "View", kind: "check" },
  { field: "create", label: "Create", kind: "check" },
  { field: "edit", label: "Edit", kind: "check" },
  { field: "approve", label: "Approve", kind: "check" },
];

const COLUMNS: Record<TableKey, Column[]> = {
  entities: ENTITY_COLS,
  businesses: BUSINESS_COLS,
  locations: LOCATION_COLS,
  members: MEMBER_COLS,
  assignments: ASSIGNMENT_COLS,
  access: ACCESS_COLS,
};

const NEW_ROW: Record<TableKey, Row> = {
  entities: { legalName: "", gstin: "", registeredAddress: "" },
  businesses: { entityCode: "", name: "", operationalAddress: "" },
  locations: { businessCode: "", type: "", name: "", address: "", mapPin: "" },
  members: { name: "", mobile: "", email: "", photoUrl: "" },
  assignments: { memberCode: "", businessCode: "", locationCode: "", designation: "", reportsToCode: "" },
  access: { assignmentCode: "", tool: "", view: true, create: false, edit: false, approve: false },
};

/** Shown in the list of errors; the prototype caps it at 30. */
const ERROR_LIST_LIMIT = 30;

export function SetupTables({ initial, onSaved }: { initial: SetupData; onSaved: (saved: SetupData) => void }) {
  const [draft, setDraft] = useState<SetupData>(initial);
  const [active, setActive] = useState<TableKey>("entities");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const rows = (key: TableKey) => draft[key] as unknown as Row[];
  const update = (fn: (d: SetupData) => SetupData) => {
    setDraft((d) => fn(d));
    setDirty(true);
    setErrors([]);
  };

  function setCell(key: TableKey, index: number, field: string, value: string | boolean) {
    update((d) => {
      const list = [...(d[key] as unknown as Row[])];
      const row = { ...list[index], [field]: value } as Row;
      if (key === "access" && typeof value === "boolean") {
        // Ticking a level forces View on; unticking View clears the rest (the same rule as normalizeSetup).
        if (field !== "view" && value) row.view = true;
        if (field === "view" && !value) {
          row.create = false;
          row.edit = false;
          row.approve = false;
        }
      }
      // A location belongs to one business: changing the business clears the location.
      if (key === "assignments" && field === "businessCode") row.locationCode = "";
      list[index] = row;
      return { ...d, [key]: list };
    });
  }

  function addRow(key: TableKey) {
    update((d) => {
      const prefix = key === "access" ? "" : ID_PREFIX[key];
      const row: Row = key === "access" ? { ...NEW_ROW[key] } : { code: nextCode(prefix, d[key] as unknown as { code: string }[]), ...NEW_ROW[key] };
      return { ...d, [key]: [...(d[key] as unknown as Row[]), row] } as SetupData;
    });
  }

  function deleteRow(key: TableKey, index: number) {
    update((d) => ({ ...d, [key]: (d[key] as unknown as Row[]).filter((_, i) => i !== index) }) as SetupData);
  }

  /** Options for a linked column: other tables' codes, filtered to the chosen business where it matters. */
  function optionsFor(row: Row, col: Column): { value: string; label: string }[] {
    if (col.options) return col.options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
    const label = (code: string, name: string) => (name ? `${code} — ${name}` : code);
    switch (col.field) {
      case "entityCode":
        return draft.entities.map((e) => ({ value: e.code, label: label(e.code, e.legalName) }));
      case "businessCode":
        return draft.businesses.map((b) => ({ value: b.code, label: label(b.code, b.name) }));
      case "memberCode":
        return draft.members.map((m) => ({ value: m.code, label: label(m.code, m.name) }));
      case "reportsToCode":
        return [{ value: "", label: "— none —" }, ...draft.members.map((m) => ({ value: m.code, label: label(m.code, m.name) }))];
      case "locationCode": {
        const business = row.businessCode as string;
        return draft.locations.filter((l) => !business || l.businessCode === business).map((l) => ({ value: l.code, label: label(l.code, l.name) }));
      }
      case "assignmentCode":
        return draft.assignments.map((a) => ({ value: a.code, label: a.code }));
      default:
        return [];
    }
  }

  async function save() {
    setSaving(true);
    const result = await saveBusinessSetupAction(draft);
    setSaving(false);
    if (!result.success) {
      setErrors(result.errors);
      return;
    }
    setDraft(result.data);
    setDirty(false);
    setErrors([]);
    onSaved(result.data);
    toast.success(`Saved. Hierarchy generated from ${result.data.assignments.length} assignment${result.data.assignments.length === 1 ? "" : "s"}.`);
  }

  const cols = COLUMNS[active];
  const list = rows(active);

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Setup tables" className="flex gap-2 overflow-x-auto pb-1">
        {TABLES.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={active === t.key}
            onClick={() => setActive(t.key)}
            className={cn("shrink-0 rounded-md border px-2.5 py-1 text-sm", active === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 hover:bg-muted")}
          >
            {t.label} ({rows(t.key).length})
          </button>
        ))}
      </div>

      {dirty && (
        <p className="rounded-md border border-butter-ink/30 bg-butter px-3 py-2 text-sm text-butter-ink">
          <b>Unsaved changes.</b> The hierarchy still shows the last saved version.
        </p>
      )}

      {errors.length > 0 && (
        <div role="alert" className="rounded-md border border-rose-ink/30 bg-rose p-3 text-sm text-rose-ink">
          <p className="font-semibold">
            {errors.length} thing{errors.length > 1 ? "s" : ""} to fix before saving
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errors.slice(0, ERROR_LIST_LIMIT).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {errors.length > ERROR_LIST_LIMIT && <p className="mt-2 text-xs">…and {errors.length - ERROR_LIST_LIMIT} more.</p>}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{TABLES.find((t) => t.key === active)?.label}</CardTitle>
          <CardDescription>{active === "access" ? "Tool access per assignment. Ticking Create, Edit or Approve turns View on." : "Fields marked as required must be filled before saving."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-2 font-medium">#</th>
                  {cols.map((c) => (
                    <th key={c.field} className="py-2 pr-2 font-medium">
                      {c.label}
                      {c.required && <span aria-hidden className="text-rose-ink"> *</span>}
                    </th>
                  ))}
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {list.map((row, i) => (
                  <tr key={i} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                    {cols.map((c) => (
                      <td key={c.field} className="py-2 pr-2">
                        <CellInput
                          col={c}
                          value={row[c.field]}
                          label={`${TABLES.find((t) => t.key === active)?.label} row ${i + 1} ${c.label}`}
                          options={c.kind === "select" ? optionsFor(row, c) : []}
                          readOnly={c.field === "code" && active !== "access"}
                          onChange={(v) => setCell(active, i, c.field, v)}
                        />
                      </td>
                    ))}
                    <td className="py-2">
                      <button type="button" onClick={() => deleteRow(active, i)} aria-label={`Delete ${TABLES.find((t) => t.key === active)?.label} row ${i + 1}`} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-rose-ink">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={cols.length + 2} className="py-6 text-center text-sm text-muted-foreground">
                      No rows yet. Add one below.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => addRow(active)}>
              <Plus className="h-3.5 w-3.5" /> Add Row
            </Button>
            <Button size="sm" className="ml-auto" onClick={save} disabled={saving || !dirty}>
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Validate &amp; Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CellInput({ col, value, label, options, readOnly, onChange }: { col: Column; value: string | boolean | undefined; label: string; options: { value: string; label: string }[]; readOnly: boolean; onChange: (v: string | boolean) => void }) {
  if (col.kind === "check") {
    return <input type="checkbox" aria-label={label} checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-primary" />;
  }
  if (col.kind === "select") {
    return (
      <select aria-label={label} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className="h-8 w-full min-w-[140px] rounded-md border border-border bg-background px-2 text-sm">
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      aria-label={label}
      value={(value as string) ?? ""}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      className={cn("h-8 w-full min-w-[120px] rounded-md border border-border bg-background px-2 text-sm", readOnly && "bg-muted/40 text-muted-foreground")}
    />
  );
}
