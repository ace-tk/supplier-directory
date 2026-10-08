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
import { checkSetup, EMPTY_SETUP, type SetupData } from "@/lib/business-structure";

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

