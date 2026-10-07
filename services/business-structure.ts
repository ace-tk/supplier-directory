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
      assignments: assignments.map((a) => ({ code: a.code, memberCode: a.member.code, businessCode: a.business.code, locationCode: a.location.code, designation: a.designation, reportsToCode: a.reportsTo?.code ?? "" })),
      access: access.map((t) => ({ assignmentCode: t.assignment.code, tool: t.tool, view: t.canView, create: t.canCreate, edit: t.canEdit, approve: t.canApprove })),
    },
  };
}

/** Validates the tables and, only if they pass, replaces the admin's setup with them. */
export async function saveBusinessSetupAction(input: SetupData): Promise<SetupResult> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, errors: ["Admins only."] };
  const ownerId = admin.id;

  const { data, errors } = checkSetup(input ?? EMPTY_SETUP);
  if (errors.length) return { success: false, errors };

  // Members whose email matches an existing SupplyBase user are linked to that user. No user is created.
  const emails = [...new Set(data.members.map((m) => clean(m.email)).filter(Boolean))];

  await db.$transaction(
    async (tx) => {
      const matched = emails.length ? await tx.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true } }) : [];
      const userByEmail = new Map(matched.map((u) => [u.email, u.id]));

      // Children before parents, so nothing is left pointing at a deleted row.
      await tx.businessAssignment.deleteMany({ where: { ownerId } });
      await tx.businessLocation.deleteMany({ where: { ownerId } });
      await tx.business.deleteMany({ where: { ownerId } });
      await tx.businessEntity.deleteMany({ where: { ownerId } });
      await tx.businessMember.deleteMany({ where: { ownerId } });

      const entityId = new Map(data.entities.map((e) => [e.code, randomUUID()]));
      await tx.businessEntity.createMany({
        data: data.entities.map((e) => ({ id: entityId.get(e.code)!, ownerId, code: e.code, legalName: clean(e.legalName), gstin: orNull(e.gstin), registeredAddress: orNull(e.registeredAddress) })),
      });

      const businessId = new Map(data.businesses.map((b) => [b.code, randomUUID()]));
      await tx.business.createMany({
        data: data.businesses.map((b) => ({ id: businessId.get(b.code)!, ownerId, entityId: entityId.get(b.entityCode)!, code: b.code, name: clean(b.name), operationalAddress: orNull(b.operationalAddress) })),
      });

      const locationId = new Map(data.locations.map((l) => [l.code, randomUUID()]));
      await tx.businessLocation.createMany({
        data: data.locations.map((l) => ({ id: locationId.get(l.code)!, ownerId, businessId: businessId.get(l.businessCode)!, code: l.code, type: l.type as "RETAIL_STORE" | "WAREHOUSE" | "OFFICE", name: clean(l.name), address: orNull(l.address), mapPin: orNull(l.mapPin) })),
      });

      const memberId = new Map(data.members.map((m) => [m.code, randomUUID()]));
      await tx.businessMember.createMany({
        data: data.members.map((m) => ({
          id: memberId.get(m.code)!,
          ownerId,
          userId: userByEmail.get(clean(m.email)) ?? null,
          code: m.code,
          name: clean(m.name),
          mobile: orNull(m.mobile),
          email: orNull(m.email),
          photoUrl: orNull(m.photoUrl),
        })),
      });

      const assignmentId = new Map(data.assignments.map((a) => [a.code, randomUUID()]));
      await tx.businessAssignment.createMany({
        data: data.assignments.map((a) => ({
          id: assignmentId.get(a.code)!,
          ownerId,
          code: a.code,
          memberId: memberId.get(a.memberCode)!,
          businessId: businessId.get(a.businessCode)!,
          locationId: locationId.get(a.locationCode)!,
          designation: a.designation,
          reportsToMemberId: a.reportsToCode ? memberId.get(a.reportsToCode)! : null,
        })),
      });

      await tx.businessToolAccess.createMany({
        data: data.access.map((t) => ({ assignmentId: assignmentId.get(t.assignmentCode)!, tool: t.tool, canView: t.view, canCreate: t.create, canEdit: t.edit, canApprove: t.approve })),
      });
    },
    { timeout: 20000 }
  );

  return { success: true, data };
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

