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
export const LOCATION_TYPE_LABEL: Record<LocationType, string> = { RETAIL_STORE: "Retail Store", WAREHOUSE: "Warehouse", OFFICE: "Back Office" };

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
  /** Empty = the person is on the business's team but not assigned to a location yet. */
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

  checkRows("entities", data.entities, [{ key: "legalName", label: "Legal name" }], (r, errs, where) => {
    if (r.gstin.trim() && !isValidGstin(r.gstin)) errs.push(`${where}: GSTIN must be 15 characters in the GST format (for example 27AAAAA0001A1Z1).`);
  });

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
    [{ key: "memberCode", label: "Member ID" }, { key: "businessCode", label: "Business ID" }, { key: "designation", label: "Designation" }],
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


// ---------------------------------------------------------------- GST
/** 2 digits (state), 5 letters + 4 digits + 1 letter (PAN), 1 entity digit/letter, "Z", 1 check character. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const normalizeGstin = (v: string) => v.trim().toUpperCase();
export const isValidGstin = (v: string) => GSTIN_PATTERN.test(normalizeGstin(v));

// ---------------------------------------------------------------- Business Setup: the guided screen's operations
// Plain functions on a SetupData, so the screen and the tests share the same rules. Each returns the new
// setup, or a message for the user. None of them touches the database.

export type Change = { ok: true; setup: SetupData; code: string } | { ok: false; error: string };
const fail = (error: string): Change => ({ ok: false, error });
const sameGst = (a: string, b: string) => normalizeGstin(a) === normalizeGstin(b);

export function entityOf(setup: SetupData, businessCode: string): EntityRow | undefined {
  const b = setup.businesses.find((x) => x.code === businessCode);
  return b ? setup.entities.find((e) => e.code === b.entityCode) : undefined;
}

/**
 * Registers a business: its company (legal entity, one GST) and the business itself. A GST that already
 * belongs to a company is reused, so two businesses of one company share it.
 */
export function registerBusiness(setup: SetupData, input: { businessName: string; legalName: string; gstin: string }): Change {
  const name = input.businessName.trim();
  if (!name) return fail("Enter the business name.");
  if (setup.businesses.some((b) => b.name.trim().toLowerCase() === name.toLowerCase())) return fail("A business with this name already exists.");
  const gstin = normalizeGstin(input.gstin);
  if (gstin && !isValidGstin(gstin)) return fail("Enter a 15-character GSTIN in the expected format.");
  let entities = setup.entities;
  let entity = gstin ? entities.find((e) => sameGst(e.gstin, gstin)) : undefined;
  if (!entity) {
    entity = { code: nextCode(ID_PREFIX.entities, entities), legalName: input.legalName.trim() || name, gstin, registeredAddress: "" };
    entities = [...entities, entity];
  }
  const business: BusinessRow = { code: nextCode(ID_PREFIX.businesses, setup.businesses), entityCode: entity.code, name, operationalAddress: "" };
  return { ok: true, setup: { ...setup, entities, businesses: [...setup.businesses, business] }, code: business.code };
}

/**
 * Changes a business's name and GST. Moving to a GST that another company already has joins that company;
 * otherwise the company's GST is changed (or, if other businesses share the company, a new company is made).
 */
export function updateBusiness(setup: SetupData, businessCode: string, input: { name: string; gstin: string }): Change {
  const business = setup.businesses.find((b) => b.code === businessCode);
  if (!business) return fail("Business not found.");
  const name = input.name.trim();
  if (!name) return fail("Enter the business name.");
  if (setup.businesses.some((b) => b.code !== businessCode && b.name.trim().toLowerCase() === name.toLowerCase())) return fail("A business with this name already exists.");
  const gstin = normalizeGstin(input.gstin);
  if (gstin && !isValidGstin(gstin)) return fail("Enter a 15-character GSTIN in the expected format.");

  let entities = setup.entities;
  let entityCode = business.entityCode;
  const current = entities.find((e) => e.code === entityCode);
  if (!current || !sameGst(current.gstin, gstin)) {
    const other = gstin ? entities.find((e) => e.code !== entityCode && sameGst(e.gstin, gstin)) : undefined;
    const sharedWith = setup.businesses.filter((b) => b.entityCode === entityCode && b.code !== businessCode).length;
    if (other) entityCode = other.code;
    else if (current && sharedWith === 0) entities = entities.map((e) => (e.code === entityCode ? { ...e, gstin } : e));
    else {
      const created: EntityRow = { code: nextCode(ID_PREFIX.entities, entities), legalName: current?.legalName || name, gstin, registeredAddress: current?.registeredAddress ?? "" };
      entities = [...entities, created];
      entityCode = created.code;
    }
  }
  const businesses = setup.businesses.map((b) => (b.code === businessCode ? { ...b, name, entityCode } : b));
  // A company left with no business is removed, so the table does not fill with empty companies.
  const used = new Set(businesses.map((b) => b.entityCode));
  entities = entities.filter((e) => used.has(e.code));
  return { ok: true, setup: { ...setup, entities, businesses }, code: businessCode };
}

export interface TeamMember {
  memberCode: string;
  name: string;
  email: string;
  mobile: string;
  designation: string;
  reportsToCode: string;
  /** Locations of this business the member is assigned to. */
  locationCodes: string[];
  assignmentCodes: string[];
}

/** The people on a business's team: everyone with an assignment in it, however many locations they have. */
export function teamOf(setup: SetupData, businessCode: string): TeamMember[] {
  const byMember = new Map<string, AssignmentRow[]>();
  for (const a of setup.assignments) if (a.businessCode === businessCode) byMember.set(a.memberCode, [...(byMember.get(a.memberCode) ?? []), a]);
  const out: TeamMember[] = [];
  for (const m of setup.members) {
    const rows = byMember.get(m.code);
    if (!rows) continue;
    out.push({
      memberCode: m.code,
      name: m.name,
      email: m.email,
      mobile: m.mobile,
      designation: rows[0].designation,
      reportsToCode: rows[0].reportsToCode,
      locationCodes: rows.map((r) => r.locationCode).filter(Boolean),
      assignmentCodes: rows.map((r) => r.code),
    });
  }
  return out;
}

/** Walks the reports-to chain upwards from `start`; true if it comes back to `target`. */
function reportsUpTo(reportsTo: Map<string, string>, start: string, target: string): boolean {
  const seen = new Set<string>();
  for (let cur: string | undefined = start; cur && !seen.has(cur); cur = reportsTo.get(cur)) {
    if (cur === target) return true;
    seen.add(cur);
  }
  return false;
}

export interface MemberInput {
  /** Set when editing. */
  memberCode?: string;
  name: string;
  designation: string;
  /** A member of the same business team, or empty for the top. */
  reportsToCode: string;
  email: string;
  mobile: string;
}

/**
 * Adds a person to a business's team, or edits them. The same designation and reporting line apply to all
 * their locations in this business. A new person starts with no location (Verticals & locations assigns one).
 */
export function saveTeamMember(setup: SetupData, businessCode: string, input: MemberInput): Change {
  if (!setup.businesses.some((b) => b.code === businessCode)) return fail("Business not found.");
  const name = input.name.trim();
  if (!name) return fail("Enter the member's name.");
  if (!(DESIGNATIONS as readonly string[]).includes(input.designation)) return fail("Choose a designation.");
  const email = input.email.trim().toLowerCase();
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return fail("Enter a valid email address.");
  const team = teamOf(setup, businessCode);
  const existing = input.memberCode ? setup.members.find((m) => m.code === input.memberCode) : undefined;
  if (input.memberCode && !existing) return fail("Member not found.");
  // The same person (same email) is never added twice.
  const twin = email ? setup.members.find((m) => m.email.toLowerCase() === email && m.code !== existing?.code) : undefined;
  if (twin && team.some((t) => t.memberCode === twin.code)) return fail(`${twin.name} is already on this team.`);

  let members = setup.members;
  let memberCode = existing?.code ?? twin?.code ?? "";
  if (existing) members = members.map((m) => (m.code === existing.code ? { ...m, name, email, mobile: input.mobile.trim() } : m));
  else if (twin) members = members.map((m) => (m.code === twin.code ? { ...m, name: m.name || name, mobile: m.mobile || input.mobile.trim() } : m));
  else {
    memberCode = nextCode(ID_PREFIX.members, members);
    members = [...members, { code: memberCode, name, mobile: input.mobile.trim(), email, photoUrl: "" }];
  }

  const reportsToCode = input.reportsToCode;
  if (reportsToCode) {
    if (reportsToCode === memberCode) return fail("A member cannot report to themselves.");
    if (!team.some((t) => t.memberCode === reportsToCode)) return fail("A person can only report to someone on this business's team.");
    const reportsTo = new Map(team.map((t) => [t.memberCode, t.reportsToCode]));
    if (reportsUpTo(reportsTo, reportsToCode, memberCode)) return fail("Reporting cannot create a circular hierarchy.");
  }

  let assignments = setup.assignments;
  const mine = assignments.filter((a) => a.businessCode === businessCode && a.memberCode === memberCode);
  if (mine.length) assignments = assignments.map((a) => (mine.includes(a) ? { ...a, designation: input.designation, reportsToCode } : a));
  else assignments = [...assignments, { code: nextCode(ID_PREFIX.assignments, assignments), memberCode, businessCode, locationCode: "", designation: input.designation, reportsToCode }];
  return { ok: true, setup: { ...setup, members, assignments }, code: memberCode };
}

/**
 * Takes a person off a business's team: their locations and tool access in it go too, and people who
 * reported to them move to the top. The person stays in Members if they are on another team.
 */
export function removeTeamMember(setup: SetupData, businessCode: string, memberCode: string): Change {
  const gone = setup.assignments.filter((a) => a.businessCode === businessCode && a.memberCode === memberCode);
  if (!gone.length) return fail("This person is not on the team.");
  const goneCodes = new Set(gone.map((a) => a.code));
  let assignments = setup.assignments.filter((a) => !goneCodes.has(a.code));
  assignments = assignments.map((a) => (a.businessCode === businessCode && a.reportsToCode === memberCode ? { ...a, reportsToCode: "" } : a));
  const stillThere = assignments.some((a) => a.memberCode === memberCode || a.reportsToCode === memberCode);
  const members = stillThere ? setup.members : setup.members.filter((m) => m.code !== memberCode);
  const access = setup.access.filter((t) => !goneCodes.has(t.assignmentCode));
  return { ok: true, setup: { ...setup, members, assignments, access }, code: memberCode };
}


// ---------------------------------------------------------------- Business Setup: verticals & locations
/** Warehouse, Retail Store and Back Office, in the order the screen shows them. */
export const VERTICALS: LocationType[] = ["WAREHOUSE", "RETAIL_STORE", "OFFICE"];

export interface LocationInput {
  /** Set when editing; the type of an existing location does not change. */
  locationCode?: string;
  type: LocationType;
  name: string;
  address: string;
}

/** Adds a location to a business (it shares the business's GST), or edits one. Names are unique within a business. */
export function saveLocation(setup: SetupData, businessCode: string, input: LocationInput): Change {
  if (!setup.businesses.some((b) => b.code === businessCode)) return fail("Business not found.");
  const name = input.name.trim();
  if (!name) return fail("Enter the location name.");
  const existing = input.locationCode ? setup.locations.find((l) => l.code === input.locationCode && l.businessCode === businessCode) : undefined;
  if (input.locationCode && !existing) return fail("Location not found.");
  const type = existing?.type || input.type;
  if (!(LOCATION_TYPES as readonly string[]).includes(type)) return fail("Choose Warehouse, Retail Store or Back Office.");
  if (setup.locations.some((l) => l.businessCode === businessCode && l.code !== existing?.code && l.name.trim().toLowerCase() === name.toLowerCase())) return fail("A location with this name already exists.");
  if (existing) {
    return { ok: true, setup: { ...setup, locations: setup.locations.map((l) => (l.code === existing.code ? { ...l, name, address: input.address.trim() } : l)) }, code: existing.code };
  }
  const location: LocationRow = { code: nextCode(ID_PREFIX.locations, setup.locations), businessCode, type, name, address: input.address.trim(), mapPin: "" };
  return { ok: true, setup: { ...setup, locations: [...setup.locations, location] }, code: location.code };
}

/** What a member's tool access looks like across their assignments in a business: the same on every one. */
function accessCopies(setup: SetupData, fromAssignment: string, toAssignment: string): AccessRow[] {
  return setup.access.filter((t) => t.assignmentCode === fromAssignment).map((t) => ({ ...t, assignmentCode: toAssignment }));
}

/**
 * Sets who works at a location. Ticked people from the business's team are assigned (a person with no location
 * yet gets this one; a person who already works elsewhere gets an extra assignment with the same designation,
 * reporting line and tool access); unticked people are taken off it, and someone left with no location stays on
 * the team as "unassigned".
 */
export function assignMembers(setup: SetupData, businessCode: string, locationCode: string, memberCodes: string[]): Change {
  const location = setup.locations.find((l) => l.code === locationCode && l.businessCode === businessCode);
  if (!location) return fail("Location not found.");
  const team = new Map(teamOf(setup, businessCode).map((t) => [t.memberCode, t]));
  for (const code of memberCodes) if (!team.has(code)) return fail("Only people on this business's team can be assigned.");
  const wanted = new Set(memberCodes);

  let assignments = setup.assignments;
  let access = setup.access;
  for (const [memberCode] of team) {
    const mine = assignments.filter((a) => a.businessCode === businessCode && a.memberCode === memberCode);
    const here = mine.find((a) => a.locationCode === locationCode);
    if (wanted.has(memberCode) && !here) {
      const unplaced = mine.find((a) => !a.locationCode);
      if (unplaced) assignments = assignments.map((a) => (a === unplaced ? { ...a, locationCode } : a));
      else {
        const base = mine[0];
        const code = nextCode(ID_PREFIX.assignments, assignments);
        assignments = [...assignments, { code, memberCode, businessCode, locationCode, designation: base.designation, reportsToCode: base.reportsToCode }];
        access = [...access, ...accessCopies({ ...setup, access }, base.code, code)];
      }
    } else if (!wanted.has(memberCode) && here) {
      if (mine.length > 1) {
        assignments = assignments.filter((a) => a !== here);
        access = access.filter((t) => t.assignmentCode !== here.code);
      } else assignments = assignments.map((a) => (a === here ? { ...a, locationCode: "" } : a));
    }
  }
  return { ok: true, setup: { ...setup, assignments, access }, code: locationCode };
}

/** Deletes a location. People who worked only there stay on the team as unassigned. */
export function removeLocation(setup: SetupData, locationCode: string): Change {
  const location = setup.locations.find((l) => l.code === locationCode);
  if (!location) return fail("Location not found.");
  const kept = assignMembers(setup, location.businessCode, locationCode, []);
  if (!kept.ok) return kept;
  return { ok: true, setup: { ...kept.setup, locations: kept.setup.locations.filter((l) => l.code !== locationCode) }, code: locationCode };
}
