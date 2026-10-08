"use server";

// Design of the Business Structure setup tables. Admin only, like the other
// admin modules. Rows are stored in the database; the tables are shown and
// edited by their human codes (E001, B001, …) and translated to row IDs here.
//
// Saving replaces the admin's whole setup in one transaction, after the same
// checks the screen runs (checkSetup), so the database never holds a setup
// that the validation would reject.

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getUser } from "@/lib/session";
import { checkSetup, EMPTY_SETUP, isPartyGroup, isPartyType, type AssignedParty, type PartyCandidate, type PartyGroup, type PartyType, type SetupData } from "@/lib/business-structure";

export type SetupResult = { success: true; data: SetupData } | { success: false; errors: string[] };

async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

const clean = (v: string) => v.trim();
const orNull = (v: string) => (v.trim() ? v.trim() : null);

/** The admin's saved setup, as the tables show it. */
export async function getBusinessSetupAction(): Promise<SetupResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, errors: ["Admins only."] };
  const ownerId = admin.id;

  const [entities, businesses, locations, members, assignments, access] = await Promise.all([
    db.businessEntity.findMany({ where: { ownerId }, orderBy: { code: "asc" } }),
    db.business.findMany({ where: { ownerId }, orderBy: { code: "asc" }, include: { entity: { select: { code: true } } } }),
    db.businessLocation.findMany({ where: { ownerId }, orderBy: { code: "asc" }, include: { business: { select: { code: true } } } }),
    db.businessMember.findMany({ where: { ownerId }, orderBy: { code: "asc" } }),
    db.businessAssignment.findMany({
      where: { ownerId },
      orderBy: { code: "asc" },
      include: { member: { select: { code: true } }, business: { select: { code: true } }, location: { select: { code: true } }, reportsTo: { select: { code: true } } },
    }),
    db.businessToolAccess.findMany({ where: { assignment: { ownerId } }, orderBy: [{ assignmentId: "asc" }, { tool: "asc" }], include: { assignment: { select: { code: true } } } }),
  ]);

  return {
    success: true,
    data: {
      entities: entities.map((e) => ({ code: e.code, legalName: e.legalName, gstin: e.gstin ?? "", registeredAddress: e.registeredAddress ?? "" })),
      businesses: businesses.map((b) => ({ code: b.code, entityCode: b.entity.code, name: b.name, operationalAddress: b.operationalAddress ?? "" })),
      locations: locations.map((l) => ({ code: l.code, businessCode: l.business.code, type: l.type, name: l.name, address: l.address ?? "", mapPin: l.mapPin ?? "" })),
      members: members.map((m) => ({ code: m.code, name: m.name, mobile: m.mobile ?? "", email: m.email ?? "", photoUrl: m.photoUrl ?? "" })),
      assignments: assignments.map((a) => ({ code: a.code, memberCode: a.member.code, businessCode: a.business.code, locationCode: a.location?.code ?? "", designation: a.designation, reportsToCode: a.reportsTo?.code ?? "" })),
      access: access.map((t) => ({ assignmentCode: t.assignment.code, tool: t.tool, view: t.canView, create: t.canCreate, edit: t.canEdit, approve: t.canApprove })),
    },
  };
}

/**
 * Validates the tables and, only if they pass, makes the database match them. Rows are matched by their
 * code (E001, B001…) and UPDATED, so a row keeps its database ID across saves; rows that are no longer in
 * the tables are removed. Everything happens in one transaction.
 */
export async function saveBusinessSetupAction(input: SetupData): Promise<SetupResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, errors: ["Admins only."] };
  const ownerId = admin.id;

  const { data, errors } = checkSetup(input ?? EMPTY_SETUP);
  if (errors.length) return { success: false, errors };

  // Members whose email matches an existing SupplyBase user are linked to that user. No user is created.
  const emails = [...new Set(data.members.map((m) => clean(m.email).toLowerCase()).filter(Boolean))];

  await db.$transaction(
    async (tx) => {
      const matched = emails.length ? await tx.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }) : [];
      const userByEmail = new Map(matched.map((u) => [u.email.toLowerCase(), u.id]));

      const ids = async (rows: Promise<{ id: string; code: string }[]>) => new Map((await rows).map((r) => [r.code, r.id]));
      const had = {
        entities: await ids(tx.businessEntity.findMany({ where: { ownerId }, select: { id: true, code: true } })),
        businesses: await ids(tx.business.findMany({ where: { ownerId }, select: { id: true, code: true } })),
        locations: await ids(tx.businessLocation.findMany({ where: { ownerId }, select: { id: true, code: true } })),
        members: await ids(tx.businessMember.findMany({ where: { ownerId }, select: { id: true, code: true } })),
        assignments: await ids(tx.businessAssignment.findMany({ where: { ownerId }, select: { id: true, code: true } })),
      };

      const entityId = new Map<string, string>();
      for (const e of data.entities) {
        const fields = { legalName: clean(e.legalName), gstin: orNull(e.gstin)?.toUpperCase() ?? null, registeredAddress: orNull(e.registeredAddress) };
        const id = had.entities.get(e.code) ?? randomUUID();
        if (had.entities.has(e.code)) await tx.businessEntity.update({ where: { id }, data: fields });
        else await tx.businessEntity.create({ data: { id, ownerId, code: e.code, ...fields } });
        entityId.set(e.code, id);
      }

      const businessId = new Map<string, string>();
      for (const b of data.businesses) {
        const fields = { entityId: entityId.get(b.entityCode)!, name: clean(b.name), operationalAddress: orNull(b.operationalAddress) };
        const id = had.businesses.get(b.code) ?? randomUUID();
        if (had.businesses.has(b.code)) await tx.business.update({ where: { id }, data: fields });
        else await tx.business.create({ data: { id, ownerId, code: b.code, ...fields } });
        businessId.set(b.code, id);
      }

      const memberId = new Map<string, string>();
      for (const m of data.members) {
        const fields = { userId: userByEmail.get(clean(m.email).toLowerCase()) ?? null, name: clean(m.name), mobile: orNull(m.mobile), email: orNull(m.email), photoUrl: orNull(m.photoUrl) };
        const id = had.members.get(m.code) ?? randomUUID();
        if (had.members.has(m.code)) await tx.businessMember.update({ where: { id }, data: fields });
        else await tx.businessMember.create({ data: { id, ownerId, code: m.code, ...fields } });
        memberId.set(m.code, id);
      }

      const locationId = new Map<string, string>();
      for (const l of data.locations) {
        const fields = { businessId: businessId.get(l.businessCode)!, type: l.type as "RETAIL_STORE" | "WAREHOUSE" | "OFFICE", name: clean(l.name), address: orNull(l.address), mapPin: orNull(l.mapPin) };
        const id = had.locations.get(l.code) ?? randomUUID();
        if (had.locations.has(l.code)) await tx.businessLocation.update({ where: { id }, data: fields });
        else await tx.businessLocation.create({ data: { id, ownerId, code: l.code, ...fields } });
        locationId.set(l.code, id);
      }

      const assignmentId = new Map<string, string>();
      for (const a of data.assignments) {
        const fields = {
          memberId: memberId.get(a.memberCode)!,
          businessId: businessId.get(a.businessCode)!,
          locationId: a.locationCode ? locationId.get(a.locationCode)! : null,
          designation: a.designation,
          reportsToMemberId: a.reportsToCode ? memberId.get(a.reportsToCode)! : null,
        };
        const id = had.assignments.get(a.code) ?? randomUUID();
        if (had.assignments.has(a.code)) await tx.businessAssignment.update({ where: { id }, data: fields });
        else await tx.businessAssignment.create({ data: { id, ownerId, code: a.code, ...fields } });
        assignmentId.set(a.code, id);
      }

      // Rows that are gone from the tables, children before parents so nothing is left pointing at a deleted row.
      const gone = (had: Map<string, string>, kept: Map<string, string>) => [...had].filter(([code]) => !kept.has(code)).map(([, id]) => id);
      await tx.businessAssignment.deleteMany({ where: { ownerId, id: { in: gone(had.assignments, assignmentId) } } });
      await tx.businessLocation.deleteMany({ where: { ownerId, id: { in: gone(had.locations, locationId) } } });
      await tx.business.deleteMany({ where: { ownerId, id: { in: gone(had.businesses, businessId) } } });
      await tx.businessEntity.deleteMany({ where: { ownerId, id: { in: gone(had.entities, entityId) } } });
      await tx.businessMember.deleteMany({ where: { ownerId, id: { in: gone(had.members, memberId) } } });

      // Tool access has no identity of its own: each kept assignment's rows are replaced.
      await tx.businessToolAccess.deleteMany({ where: { assignmentId: { in: [...assignmentId.values()] } } });
      await tx.businessToolAccess.createMany({
        data: data.access.map((t) => ({ assignmentId: assignmentId.get(t.assignmentCode)!, tool: t.tool, canView: t.view, canCreate: t.create, canEdit: t.edit, canApprove: t.approve })),
      });
    },
    { timeout: 20000 }
  );

  return { success: true, data };
}

export interface TeamDirectoryEntry {
  userId: string;
  name: string;
  email: string;
  roleName: string;
}

/** The people already in Team Management (active workspace members), so a business team can use the same people. */
export async function getTeamDirectoryAction(): Promise<{ success: true; data: TeamDirectoryEntry[] } | { success: false; error: string }> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const rows = await db.workspaceMember.findMany({
    where: { status: "ACTIVE", workspace: { members: { some: { userId: admin.id, isOwner: true } } } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return { success: true, data: rows.map((m) => ({ userId: m.user.id, name: m.user.name || m.user.email, email: m.user.email, roleName: m.roleName })) };
}


// ---------------------------------------------------------------- assigned business (buyers, suppliers, freelancers)
export type PartyActionResult<T> = { success: true; data: T } | { success: false; error: string };

const place = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(", ");

/** What a party is called and a short detail line, read from the table it lives in. Null if it no longer exists. */
async function describeParty(type: PartyType, id: string): Promise<{ name: string; detail: string } | null> {
  if (type === "BUYER") {
    const b = await db.buyer.findUnique({ where: { id }, include: { user: { select: { name: true, email: true } } } });
    return b ? { name: b.companyName || b.user.name || b.user.email, detail: place(b.city, b.country) } : null;
  }
  if (type === "SUPPLIER") {
    const s = await db.supplier.findUnique({ where: { id }, include: { user: { select: { name: true, email: true } } } });
    return s ? { name: s.companyName || s.user.name || s.user.email, detail: place(s.city, s.country) } : null;
  }
  if (type === "SUPPLIER_LISTING") {
    const l = await db.supplierListing.findUnique({ where: { id } });
    return l ? { name: l.companyName, detail: place(l.city, l.country) } : null;
  }
  const f = await db.freelancer.findUnique({ where: { id }, include: { user: { select: { name: true, email: true } } } });
  return f ? { name: f.user.name || f.user.email, detail: place(f.location, f.skills.slice(0, 3).join(" · ")) } : null;
}

async function ownedBusiness(ownerId: string, code: string) {
  return db.business.findFirst({ where: { ownerId, code }, select: { id: true } });
}

/** The team member (by code) if they are on this business's team, else null. */
async function teamMember(ownerId: string, businessId: string, code: string) {
  if (!code) return null;
  const member = await db.businessMember.findFirst({ where: { ownerId, code }, select: { id: true, code: true } });
  if (!member) return null;
  const onTeam = await db.businessAssignment.findFirst({ where: { ownerId, businessId, memberId: member.id }, select: { id: true } });
  return onTeam ? member : null;
}

type PartyRow = { businessId: string; partyType: string; partyId: string; partyName: string; responsibleMember: { code: string } | null; business: { code: string } };

/** Every party the admin has assigned, with names read live (the saved name is used if the party is gone). */
export async function getAssignedPartiesAction(): Promise<PartyActionResult<AssignedParty[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  const rows = (await db.businessAssignedParty.findMany({
    where: { ownerId: admin.id },
    orderBy: { createdAt: "asc" },
    include: { business: { select: { code: true } }, responsibleMember: { select: { code: true } } },
  })) as PartyRow[];
  const data: AssignedParty[] = [];
  for (const r of rows) {
    if (!isPartyType(r.partyType)) continue;
    const live = await describeParty(r.partyType, r.partyId);
    data.push({ businessCode: r.business.code, type: r.partyType, id: r.partyId, name: live?.name ?? r.partyName, detail: live?.detail ?? "", responsibleMemberCode: r.responsibleMember?.code ?? "" });
  }
  return { success: true, data };
}

/** People to choose from when assigning: up to 20 of one kind, matching the search text (all, newest names first, when it is empty). */
export async function searchPartiesAction(group: PartyGroup, query: string): Promise<PartyActionResult<PartyCandidate[]>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  if (!isPartyGroup(group)) return { success: false, error: "Choose buyers, suppliers or freelancers." };
  const q = String(query ?? "").trim().slice(0, 80);
  const like = { contains: q, mode: "insensitive" as const };
  const take = 20;

  if (group === "BUYER") {
    const rows = await db.buyer.findMany({ where: q ? { OR: [{ companyName: like }, { user: { name: like } }] } : {}, take, orderBy: { companyName: "asc" }, include: { user: { select: { name: true, email: true } } } });
    return { success: true, data: rows.map((b) => ({ type: "BUYER" as const, id: b.id, name: b.companyName || b.user.name || b.user.email, detail: place(b.city, b.country) })) };
  }
  if (group === "SUPPLIER") {
    const [suppliers, listings] = await Promise.all([
      db.supplier.findMany({ where: q ? { OR: [{ companyName: like }, { user: { name: like } }] } : {}, take, orderBy: { companyName: "asc" }, include: { user: { select: { name: true, email: true } } } }),
      db.supplierListing.findMany({ where: q ? { companyName: like } : {}, take, orderBy: { companyName: "asc" } }),
    ]);
    const data: PartyCandidate[] = [
      ...suppliers.map((s) => ({ type: "SUPPLIER" as const, id: s.id, name: s.companyName || s.user.name || s.user.email, detail: place(s.city, s.country) })),
      ...listings.map((l) => ({ type: "SUPPLIER_LISTING" as const, id: l.id, name: l.companyName, detail: place(l.city, l.country) })),
    ];
    return { success: true, data: data.sort((a, b) => a.name.localeCompare(b.name)).slice(0, take) };
  }
  const rows = await db.freelancer.findMany({ where: q ? { OR: [{ user: { name: like } }, { location: like }, { skills: { has: q } }] } : {}, take, orderBy: { createdAt: "asc" }, include: { user: { select: { name: true, email: true } } } });
  return { success: true, data: rows.map((f) => ({ type: "FREELANCER" as const, id: f.id, name: f.user.name || f.user.email, detail: place(f.location, f.skills.slice(0, 3).join(" · ")) })) };
}

/** Connects a buyer, supplier or freelancer to a business, with an optional responsible team member of that business. */
export async function assignPartyAction(input: { businessCode: string; type: PartyType; id: string; responsibleMemberCode?: string }): Promise<PartyActionResult<AssignedParty>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  if (!isPartyType(input?.type) || !input.id) return { success: false, error: "Choose who to assign." };
  const business = await ownedBusiness(admin.id, input.businessCode);
  if (!business) return { success: false, error: "Business not found. Save the business first." };
  const party = await describeParty(input.type, input.id);
  if (!party) return { success: false, error: "This buyer, supplier or freelancer no longer exists." };
  const responsible = await teamMember(admin.id, business.id, input.responsibleMemberCode ?? "");
  if (input.responsibleMemberCode && !responsible) return { success: false, error: "The responsible person must be on this business's team." };

  await db.businessAssignedParty.upsert({
    where: { businessId_partyType_partyId: { businessId: business.id, partyType: input.type, partyId: input.id } },
    create: { ownerId: admin.id, businessId: business.id, partyType: input.type, partyId: input.id, partyName: party.name, responsibleMemberId: responsible?.id ?? null },
    update: { partyName: party.name, ...(input.responsibleMemberCode !== undefined ? { responsibleMemberId: responsible?.id ?? null } : {}) },
  });
  return { success: true, data: { businessCode: input.businessCode, type: input.type, id: input.id, name: party.name, detail: party.detail, responsibleMemberCode: responsible?.code ?? "" } };
}

/** Changes (or clears) the team member responsible for an assigned party. */
export async function setPartyResponsibleAction(input: { businessCode: string; type: PartyType; id: string; responsibleMemberCode: string }): Promise<PartyActionResult<AssignedParty>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  if (!isPartyType(input?.type)) return { success: false, error: "Choose who to change." };
  const business = await ownedBusiness(admin.id, input.businessCode);
  if (!business) return { success: false, error: "Business not found." };
  const existing = await db.businessAssignedParty.findFirst({ where: { ownerId: admin.id, businessId: business.id, partyType: input.type, partyId: input.id } });
  if (!existing) return { success: false, error: "This party is not assigned to the business." };
  const responsible = await teamMember(admin.id, business.id, input.responsibleMemberCode);
  if (input.responsibleMemberCode && !responsible) return { success: false, error: "The responsible person must be on this business's team." };
  await db.businessAssignedParty.update({ where: { id: existing.id }, data: { responsibleMemberId: responsible?.id ?? null } });
  const live = await describeParty(input.type, input.id);
  return { success: true, data: { businessCode: input.businessCode, type: input.type, id: input.id, name: live?.name ?? existing.partyName, detail: live?.detail ?? "", responsibleMemberCode: responsible?.code ?? "" } };
}

/** Takes a party off a business. The buyer, supplier or freelancer themselves are not touched. */
export async function unassignPartyAction(input: { businessCode: string; type: PartyType; id: string }): Promise<PartyActionResult<null>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };
  if (!isPartyType(input?.type)) return { success: false, error: "Choose who to remove." };
  const business = await ownedBusiness(admin.id, input.businessCode);
  if (!business) return { success: false, error: "Business not found." };
  await db.businessAssignedParty.deleteMany({ where: { ownerId: admin.id, businessId: business.id, partyType: input.type, partyId: input.id } });
  return { success: true, data: null };
}

export interface AssignedBusinessData {
  buyers: Array<{ id: string; name: string; companyName?: string; location?: string }>;
  suppliers: Array<{ id: string; name: string; companyName?: string; location?: string }>;
  freelancers: Array<{ id: string; name: string; location?: string; skills?: string[] }>;
}

export async function getAssignedBusinessAction(): Promise<AssignedBusinessData> {
  const [buyers, supplierListings, suppliers, freelancers] = await Promise.all([
    db.buyer.findMany({ take: 20, include: { user: { select: { name: true, email: true } } } }),
    db.supplierListing.findMany({ take: 20 }),
    db.supplier.findMany({ take: 20, include: { user: { select: { name: true, email: true } } } }),
    db.freelancer.findMany({ take: 20, include: { user: { select: { name: true, email: true } } } }),
  ]);

  const mappedBuyers = buyers.map((b) => ({
    id: b.id,
    name: b.user.name || b.companyName || b.user.email,
    companyName: b.companyName,
    location: [b.city, b.country].filter(Boolean).join(", "),
  }));

  const mappedSuppliers = [
    ...suppliers.map((s) => ({
      id: s.id,
      name: s.companyName || s.user.name || s.user.email,
      companyName: s.companyName,
      location: [s.city, s.country].filter(Boolean).join(", "),
    })),
    ...supplierListings.map((sl) => ({
      id: sl.id,
      name: sl.companyName,
      companyName: sl.companyName,
      location: [sl.city, sl.country].filter(Boolean).join(", "),
    })),
  ];

  const mappedFreelancers = freelancers.map((f) => ({
    id: f.id,
    name: f.user.name || f.user.email,
    location: f.location ?? "",
    skills: f.skills,
  }));

  return {
    buyers: mappedBuyers,
    suppliers: mappedSuppliers,
    freelancers: mappedFreelancers,
  };
}

