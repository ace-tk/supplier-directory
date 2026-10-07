// Business Structure — the setup tables' rules: the lists, the row shapes,
// normalising and validating a set of tables, and the next free code.
// Pure (no "use server", no DB, no network) so the screen, the server
// action and the tests use exactly the same rules.

export const DESIGNATIONS = [
  "Director",
  "Creative Director",
  "Creative Lead",
  "Operations Manager",
  "Operations",
  "Designer",
  "Graphic Designer",
  "Store Manager",
  "Warehouse Manager",
  "Accounts",
  "Marketing",
  "Freelancer",
] as const;

export const TOOLS = [
  "Dashboard",
  "Projects",
  "Tasks",
  "Supply chain",
  "Content",
  "Product",
  "Catalog",
  "Mood board",
  "AI Garment Studio",
  "CRM",
  "Invoices",
  "Expenses",
  "Inventory",
  "Shop",
  "Deals",
  "Marketing",
  "Freelancers",
  "Team",
  "Settings",
] as const;

export const LOCATION_TYPES = ["RETAIL_STORE", "WAREHOUSE", "OFFICE"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];
export const LOCATION_TYPE_LABEL: Record<LocationType, string> = { RETAIL_STORE: "Retail Store", WAREHOUSE: "Warehouse", OFFICE: "Office" };

export interface EntityRow {
  code: string;
  legalName: string;
  gstin: string;
  registeredAddress: string;
}
export interface BusinessRow {
  code: string;
  entityCode: string;
  name: string;
  operationalAddress: string;
}
export interface LocationRow {
  code: string;
  businessCode: string;
  type: LocationType | "";
  name: string;
  address: string;
  mapPin: string;
}
export interface MemberRow {
  code: string;
  name: string;
  mobile: string;
  email: string;
  photoUrl: string;
}
export interface AssignmentRow {
  code: string;
  memberCode: string;
  businessCode: string;
  locationCode: string;
  designation: string;
  reportsToCode: string;
}
export interface AccessRow {
  assignmentCode: string;
  tool: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  approve: boolean;
}

export interface MemberEntityAssignmentRow {
  memberCode: string;
  entityType: "BUYER" | "SUPPLIER" | "FREELANCER";
  entityId: string;
  entityName: string;
}

export interface SetupData {
  entities: EntityRow[];
  businesses: BusinessRow[];
  locations: LocationRow[];
  members: MemberRow[];
  assignments: AssignmentRow[];
  access: AccessRow[];
  memberEntityAssignments?: MemberEntityAssignmentRow[];
}

export const EMPTY_SETUP: SetupData = { entities: [], businesses: [], locations: [], members: [], assignments: [], access: [], memberEntityAssignments: [] };


/** The ID prefix for each table, as in the prototype (E001, B001, L001, M001, A001). */
export const ID_PREFIX = { entities: "E", businesses: "B", locations: "L", members: "M", assignments: "A" } as const;

/** The next free code for a table: the highest number used so far + 1, zero-padded to three digits. */
export function nextCode(prefix: string, existing: { code: string }[]): string {
  let max = 0;
  for (const row of existing) {
    const n = Number(row.code.replace(/^\D+/, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Tidies the tool access table before it is checked or saved: drops rows
 * whose assignment is gone or that have no level ticked; ticking Create,
 * Edit or Approve forces View on; unticking View clears the rest.
 */
export function normalizeSetup(data: SetupData): SetupData {
  const assignmentCodes = new Set(data.assignments.map((a) => a.code));
  const access = data.access
    .filter((a) => assignmentCodes.has(a.assignmentCode) && (a.view || a.create || a.edit || a.approve))
    .map((a) => {
      const view = a.view || a.create || a.edit || a.approve;
      return view ? { ...a, view: true } : { ...a, view: false, create: false, edit: false, approve: false };
    });
  return { ...data, access };
}

const TABLE_LABEL = {
  entities: "Legal Entities",
  businesses: "Businesses",
  locations: "Locations",
  members: "Members",
  assignments: "Assignments",
  access: "Tool Access",
} as const;

/**
 * Checks the tables and returns every problem, in plain words, in the order
 * the prototype reports them. An empty list means the setup can be saved.
 * Run normalizeSetup first, so the tool access table is already tidy.
 */
export function validateSetup(data: SetupData): string[] {
  const errors: string[] = [];
  const entityCodes = new Set(data.entities.map((r) => r.code));
  const businessCodes = new Set(data.businesses.map((r) => r.code));
  const locationCodes = new Set(data.locations.map((r) => r.code));
  const memberCodes = new Set(data.members.map((r) => r.code));
  const assignmentCodes = new Set(data.assignments.map((r) => r.code));
  const businessName = new Map(data.businesses.map((b) => [b.code, b.name || b.code]));
  const locationBusiness = new Map(data.locations.map((l) => [l.code, l.businessCode]));

  /** Checks the ID, duplicate IDs and required columns of one table. */
  function checkRows<T extends { code: string }>(table: keyof typeof TABLE_LABEL, rows: T[], required: { key: keyof T; label: string }[], ref?: (r: T, errs: string[], row: string) => void) {
    const label = TABLE_LABEL[table];
    const seen = new Set<string>();
    rows.forEach((r, i) => {
      const n = i + 1;
      const id = r.code.trim();
      const where = `${label} row ${n} (${id || "no ID"})`;
      if (!id) errors.push(`${where}: ID is required.`);
      else if (seen.has(id)) errors.push(`${where}: duplicate ID.`);
      seen.add(id);
      for (const col of required) {
        const v = r[col.key];
        if (typeof v === "string" && !v.trim()) errors.push(`${where}: ${col.label} is required.`);
      }
      ref?.(r, errors, where);
    });
  }

  checkRows("entities", data.entities, [{ key: "legalName", label: "Legal name" }]);

  checkRows("businesses", data.businesses, [{ key: "entityCode", label: "Entity ID" }, { key: "name", label: "Business name" }], (r, errs, where) => {
    if (r.entityCode && !entityCodes.has(r.entityCode)) errs.push(`${where}: Entity ID ${r.entityCode} is not in Legal Entities.`);
  });

  checkRows(
    "locations",
    data.locations,
    [{ key: "businessCode", label: "Business ID" }, { key: "type", label: "Type" }, { key: "name", label: "Name" }],
    (r, errs, where) => {
      if (r.businessCode && !businessCodes.has(r.businessCode)) errs.push(`${where}: Business ID ${r.businessCode} is not in Businesses.`);
      if (r.type && !(LOCATION_TYPES as readonly string[]).includes(r.type)) errs.push(`${where}: Type ${r.type} is not in the list of location types.`);
    }
  );

  checkRows("members", data.members, [{ key: "name", label: "Name" }]);

  checkRows(
    "assignments",
    data.assignments,
    [{ key: "memberCode", label: "Member ID" }, { key: "businessCode", label: "Business ID" }, { key: "locationCode", label: "Location ID" }, { key: "designation", label: "Designation" }],
    (r, errs, where) => {
      if (r.memberCode && !memberCodes.has(r.memberCode)) errs.push(`${where}: Member ID ${r.memberCode} is not in Members.`);
      if (r.businessCode && !businessCodes.has(r.businessCode)) errs.push(`${where}: Business ID ${r.businessCode} is not in Businesses.`);
      if (r.locationCode && !locationCodes.has(r.locationCode)) errs.push(`${where}: Location ID ${r.locationCode} is not in Locations.`);
      if (r.designation && !(DESIGNATIONS as readonly string[]).includes(r.designation)) errs.push(`${where}: Designation ${r.designation} is not in the list of designations.`);
      if (r.reportsToCode && !memberCodes.has(r.reportsToCode)) errs.push(`${where}: Reports-to ID ${r.reportsToCode} is not in Members.`);
      if (r.reportsToCode && r.reportsToCode === r.memberCode) errs.push(`Assignments ${r.code}: a member cannot report to themselves.`);
      if (r.locationCode && r.businessCode && locationBusiness.has(r.locationCode) && locationBusiness.get(r.locationCode) !== r.businessCode) {
        errs.push(`Assignments ${r.code}: location ${r.locationCode} belongs to a different business.`);
      }
    }
  );

  // Tool access: no ID column, so rows are named by their assignment.
  const toolSeen = new Set<string>();
  data.access.forEach((r, i) => {
    const where = `Tool Access row ${i + 1} (${r.assignmentCode || "no assignment"})`;
    if (!assignmentCodes.has(r.assignmentCode)) errors.push(`${where}: Assignment ID ${r.assignmentCode || "(blank)"} is not in Assignments.`);
    if (!(TOOLS as readonly string[]).includes(r.tool)) errors.push(`${where}: Tool ${r.tool || "(blank)"} is not in the list of tools.`);
    const key = `${r.assignmentCode}|${r.tool}`;
    if (toolSeen.has(key)) errors.push(`${where}: ${r.tool} is listed more than once for this assignment.`);
    toolSeen.add(key);
  });

  // Reporting loops, per business: follow reports-to links; a cycle means nobody is at the top.
  const byBusiness = new Map<string, AssignmentRow[]>();
  for (const a of data.assignments) {
    if (!a.businessCode) continue;
    byBusiness.set(a.businessCode, [...(byBusiness.get(a.businessCode) ?? []), a]);
  }
  for (const [businessCode, rows] of byBusiness) {
    const reportsTo = new Map(rows.map((a) => [a.memberCode, a.reportsToCode]));
    const reported = new Set<string>();
    for (const start of reportsTo.keys()) {
      const path: string[] = [];
      let cur: string | undefined = start;
      while (cur && !reported.has(cur) && reportsTo.has(cur)) {
        if (path.includes(cur)) {
          const loop = path.slice(path.indexOf(cur));
          const ids = rows.filter((a) => loop.includes(a.memberCode)).map((a) => a.code);
          errors.push(`Assignments: reporting loop in ${businessName.get(businessCode) ?? businessCode} between ${ids.join(", ")}. Someone must be at the top.`);
          break;
        }
        path.push(cur);
        cur = reportsTo.get(cur) || undefined;
      }
      path.forEach((p) => reported.add(p));
    }
  }

  return errors;
}

/** Normalises, then validates. The single check used before any save. */
export function checkSetup(data: SetupData): { data: SetupData; errors: string[] } {
  const normalized = normalizeSetup(data);
  return { data: normalized, errors: validateSetup(normalized) };
}
