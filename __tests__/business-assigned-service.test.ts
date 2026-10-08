import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory database: only the tables and queries the assigned-business actions use.
const session = vi.hoisted(() => ({ getUser: vi.fn() }));
const mem = vi.hoisted(() => {
  type Party = { id: string; ownerId: string; businessId: string; partyType: string; partyId: string; partyName: string; responsibleMemberId: string | null; createdAt: Date };
  const state = {
    businesses: [] as { id: string; ownerId: string; code: string }[],
    members: [] as { id: string; ownerId: string; code: string }[],
    assignments: [] as { id: string; ownerId: string; businessId: string; memberId: string }[],
    parties: [] as Party[],
    buyers: [] as { id: string; companyName: string; city: string | null; country: string | null; user: { name: string; email: string } }[],
    suppliers: [] as { id: string; companyName: string; city: string | null; country: string | null; user: { name: string; email: string } }[],
    listings: [] as { id: string; companyName: string; city: string; country: string }[],
    freelancers: [] as { id: string; location: string | null; skills: string[]; user: { name: string; email: string } }[],
    n: 0,
  };
  return state;
});

const buyerFind = vi.hoisted(() => vi.fn());
const supplierFind = vi.hoisted(() => vi.fn());
const listingFind = vi.hoisted(() => vi.fn());
const freelancerFind = vi.hoisted(() => vi.fn());
const helpers = vi.hoisted(() => ({ byId: <T extends { id: string }>(rows: () => T[]) => async ({ where }: { where: { id: string } }) => rows().find((r) => r.id === where.id) ?? null }));

type PartyRow = (typeof mem.parties)[number];

vi.mock("@/lib/session", () => ({ getUser: session.getUser }));
vi.mock("@/lib/db", () => ({
  db: {
    business: { findFirst: async ({ where }: { where: { ownerId: string; code: string } }) => mem.businesses.find((b) => b.ownerId === where.ownerId && b.code === where.code) ?? null },
    businessMember: { findFirst: async ({ where }: { where: { ownerId: string; code: string } }) => mem.members.find((m) => m.ownerId === where.ownerId && m.code === where.code) ?? null },
    businessAssignment: { findFirst: async ({ where }: { where: { ownerId: string; businessId: string; memberId: string } }) => mem.assignments.find((a) => a.ownerId === where.ownerId && a.businessId === where.businessId && a.memberId === where.memberId) ?? null },
    buyer: { findUnique: helpers.byId(() => mem.buyers), findMany: buyerFind },
    supplier: { findUnique: helpers.byId(() => mem.suppliers), findMany: supplierFind },
    supplierListing: { findUnique: helpers.byId(() => mem.listings), findMany: listingFind },
    freelancer: { findUnique: helpers.byId(() => mem.freelancers), findMany: freelancerFind },
    businessAssignedParty: {
      findMany: async ({ where }: { where: { ownerId: string } }) =>
        mem.parties
          .filter((p) => p.ownerId === where.ownerId)
          .map((p) => ({ ...p, business: { code: mem.businesses.find((b) => b.id === p.businessId)!.code }, responsibleMember: p.responsibleMemberId ? { code: mem.members.find((m) => m.id === p.responsibleMemberId)!.code } : null })),
      findFirst: async ({ where }: { where: { ownerId: string; businessId: string; partyType: string; partyId: string } }) =>
        mem.parties.find((p) => p.ownerId === where.ownerId && p.businessId === where.businessId && p.partyType === where.partyType && p.partyId === where.partyId) ?? null,
      upsert: async ({ where, create, update }: { where: { businessId_partyType_partyId: { businessId: string; partyType: string; partyId: string } }; create: Omit<PartyRow, "id" | "createdAt">; update: Partial<PartyRow> }) => {
        const k = where.businessId_partyType_partyId;
        const found = mem.parties.find((p) => p.businessId === k.businessId && p.partyType === k.partyType && p.partyId === k.partyId);
        if (found) return Object.assign(found, update);
        const row = { ...create, id: `bap-${++mem.n}`, createdAt: new Date(mem.n) };
        mem.parties.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<PartyRow> }) => Object.assign(mem.parties.find((p) => p.id === where.id)!, data),
      deleteMany: async ({ where }: { where: { ownerId: string; businessId: string; partyType: string; partyId: string } }) => {
        const before = mem.parties.length;
        mem.parties = mem.parties.filter((p) => !(p.ownerId === where.ownerId && p.businessId === where.businessId && p.partyType === where.partyType && p.partyId === where.partyId));
        return { count: before - mem.parties.length };
      },
    },
  },
}));

import { assignPartyAction, getAssignedPartiesAction, searchPartiesAction, setPartyResponsibleAction, unassignPartyAction } from "@/services/business-structure";

const ADMIN = { id: "admin-1", role: "ADMIN" };

beforeEach(() => {
  session.getUser.mockResolvedValue(ADMIN);
  mem.businesses = [{ id: "b1", ownerId: "admin-1", code: "B001" }, { id: "b9", ownerId: "someone-else", code: "B001" }];
  mem.members = [{ id: "m1", ownerId: "admin-1", code: "M001" }, { id: "m2", ownerId: "admin-1", code: "M002" }];
  mem.assignments = [{ id: "a1", ownerId: "admin-1", businessId: "b1", memberId: "m1" }];
  mem.parties = [];
  mem.n = 0;
  mem.buyers = [{ id: "buy1", companyName: "Zara Retail", city: "Mumbai", country: "India", user: { name: "Zara Khan", email: "z@x.com" } }];
  mem.suppliers = [{ id: "sup1", companyName: "Fabric Co", city: "Surat", country: "India", user: { name: "F", email: "f@x.com" } }];
  mem.listings = [{ id: "lst1", companyName: "Directory Mills", city: "Tirupur", country: "India" }];
  mem.freelancers = [{ id: "fre1", location: "Pune", skills: ["Pattern making", "Grading", "Tech packs", "CAD"], user: { name: "Meera Shah", email: "m@x.com" } }];
  for (const fn of [buyerFind, supplierFind, listingFind, freelancerFind]) fn.mockReset();
});

const assign = (over: Partial<Parameters<typeof assignPartyAction>[0]> = {}) => assignPartyAction({ businessCode: "B001", type: "BUYER", id: "buy1", ...over });

describe("assigning buyers, suppliers and freelancers to a business", () => {
  it("only an admin can use any of it", async () => {
    session.getUser.mockResolvedValue({ id: "u", role: "BUYER" });
    const refused = { success: false, error: "Admins only." };
    expect(await getAssignedPartiesAction()).toEqual(refused);
    expect(await searchPartiesAction("BUYER", "")).toEqual(refused);
    expect(await assign()).toEqual(refused);
    expect(await setPartyResponsibleAction({ businessCode: "B001", type: "BUYER", id: "buy1", responsibleMemberCode: "" })).toEqual(refused);
    expect(await unassignPartyAction({ businessCode: "B001", type: "BUYER", id: "buy1" })).toEqual(refused);
    expect(mem.parties).toEqual([]);
  });

  it("assigns each kind, reading the name and detail from where the party lives", async () => {
    expect(await assign()).toEqual({ success: true, data: { businessCode: "B001", type: "BUYER", id: "buy1", name: "Zara Retail", detail: "Mumbai, India", responsibleMemberCode: "" } });
    expect((await assign({ type: "SUPPLIER", id: "sup1" })).success).toBe(true);
    expect(await assign({ type: "SUPPLIER_LISTING", id: "lst1" })).toMatchObject({ success: true, data: { name: "Directory Mills", detail: "Tirupur, India" } });
    // a freelancer's detail is their place and their first three skills
    expect(await assign({ type: "FREELANCER", id: "fre1" })).toMatchObject({ success: true, data: { name: "Meera Shah", detail: "Pune, Pattern making · Grading · Tech packs" } });
    expect(mem.parties.map((p) => [p.partyType, p.partyName])).toEqual([["BUYER", "Zara Retail"], ["SUPPLIER", "Fabric Co"], ["SUPPLIER_LISTING", "Directory Mills"], ["FREELANCER", "Meera Shah"]]);
    expect(mem.parties.every((p) => p.ownerId === "admin-1" && p.businessId === "b1")).toBe(true);
  });

  it("assigning the same party again does not duplicate it, and keeps who is responsible unless told otherwise", async () => {
    await assign({ responsibleMemberCode: "M001" });
    await assign();
    expect(mem.parties).toHaveLength(1);
    expect(mem.parties[0].responsibleMemberId).toBe("m1");
    await assign({ responsibleMemberCode: "" });
    expect(mem.parties[0].responsibleMemberId).toBeNull();
  });

  it("refuses an unknown business, a missing party and a bad type; one admin's business is not another's", async () => {
    expect(await assign({ businessCode: "B099" })).toEqual({ success: false, error: "Business not found. Save the business first." });
    session.getUser.mockResolvedValue({ id: "someone-else", role: "ADMIN" });
    expect(await assign()).toMatchObject({ success: true }); // their own B001
    expect(mem.parties[0].businessId).toBe("b9");
    session.getUser.mockResolvedValue(ADMIN);
    expect(await assign({ id: "gone" })).toEqual({ success: false, error: "This buyer, supplier or freelancer no longer exists." });
    expect(await assign({ type: "ROBOT" as never })).toEqual({ success: false, error: "Choose who to assign." });
  });

  it("the responsible person must be on this business's team", async () => {
    expect(await assign({ responsibleMemberCode: "M002" })).toEqual({ success: false, error: "The responsible person must be on this business's team." });
    expect(await assign({ responsibleMemberCode: "M404" })).toEqual({ success: false, error: "The responsible person must be on this business's team." });
    expect(mem.parties).toEqual([]);
    expect(await assign({ responsibleMemberCode: "M001" })).toMatchObject({ success: true, data: { responsibleMemberCode: "M001" } });
  });

  it("changes and clears the responsible person", async () => {
    await assign();
    const key = { businessCode: "B001", type: "BUYER" as const, id: "buy1" };
    expect(await setPartyResponsibleAction({ ...key, responsibleMemberCode: "M001" })).toMatchObject({ success: true, data: { responsibleMemberCode: "M001", name: "Zara Retail" } });
    expect(await setPartyResponsibleAction({ ...key, responsibleMemberCode: "M002" })).toEqual({ success: false, error: "The responsible person must be on this business's team." });
    expect(mem.parties[0].responsibleMemberId).toBe("m1");
    expect(await setPartyResponsibleAction({ ...key, responsibleMemberCode: "" })).toMatchObject({ success: true, data: { responsibleMemberCode: "" } });
    expect(mem.parties[0].responsibleMemberId).toBeNull();
    expect(await setPartyResponsibleAction({ ...key, id: "nobody", responsibleMemberCode: "" })).toEqual({ success: false, error: "This party is not assigned to the business." });
  });

  it("removing takes only that party off that business", async () => {
    await assign();
    await assign({ type: "SUPPLIER", id: "sup1" });
    expect(await unassignPartyAction({ businessCode: "B001", type: "BUYER", id: "buy1" })).toEqual({ success: true, data: null });
    expect(mem.parties.map((p) => p.partyType)).toEqual(["SUPPLIER"]);
    expect(await unassignPartyAction({ businessCode: "B404", type: "BUYER", id: "buy1" })).toEqual({ success: false, error: "Business not found." });
    expect(mem.buyers).toHaveLength(1); // the buyer themselves is untouched
  });

  it("lists everything assigned with names read live, and falls back to the saved name when the party is gone", async () => {
    await assign({ responsibleMemberCode: "M001" });
    await assign({ type: "FREELANCER", id: "fre1" });
    mem.buyers[0].companyName = "Zara Retail Pvt Ltd";
    const live = (await getAssignedPartiesAction()) as { success: true; data: unknown[] };
    expect(live.success).toBe(true);
    expect(live.data).toEqual([
      { businessCode: "B001", type: "BUYER", id: "buy1", name: "Zara Retail Pvt Ltd", detail: "Mumbai, India", responsibleMemberCode: "M001" },
      { businessCode: "B001", type: "FREELANCER", id: "fre1", name: "Meera Shah", detail: "Pune, Pattern making · Grading · Tech packs", responsibleMemberCode: "" },
    ]);
    mem.buyers = [];
    const gone = (await getAssignedPartiesAction()) as { data: { name: string; detail: string }[] };
    expect(gone.data[0]).toMatchObject({ name: "Zara Retail", detail: "" });
  });
});

describe("searching who can be assigned", () => {
  it("buyers: up to 20, matched on company or contact name; an empty search lists them all", async () => {
    buyerFind.mockResolvedValue(mem.buyers);
    expect(await searchPartiesAction("BUYER", "  zar ")).toEqual({ success: true, data: [{ type: "BUYER", id: "buy1", name: "Zara Retail", detail: "Mumbai, India" }] });
    const call = buyerFind.mock.calls[0][0];
    expect(call.take).toBe(20);
    expect(call.where).toEqual({ OR: [{ companyName: { contains: "zar", mode: "insensitive" } }, { user: { name: { contains: "zar", mode: "insensitive" } } }] });
    await searchPartiesAction("BUYER", "");
    expect(buyerFind.mock.calls[1][0].where).toEqual({});
  });

  it("suppliers: registered suppliers and directory listings together, by name", async () => {
    supplierFind.mockResolvedValue(mem.suppliers);
    listingFind.mockResolvedValue(mem.listings);
    expect(await searchPartiesAction("SUPPLIER", "")).toEqual({
      success: true,
      data: [
        { type: "SUPPLIER_LISTING", id: "lst1", name: "Directory Mills", detail: "Tirupur, India" },
        { type: "SUPPLIER", id: "sup1", name: "Fabric Co", detail: "Surat, India" },
      ],
    });
  });

  it("freelancers: matched on name, place or an exact skill", async () => {
    freelancerFind.mockResolvedValue(mem.freelancers);
    expect(await searchPartiesAction("FREELANCER", "grading")).toMatchObject({ success: true, data: [{ type: "FREELANCER", id: "fre1", name: "Meera Shah" }] });
    expect(freelancerFind.mock.calls[0][0].where.OR).toEqual([{ user: { name: { contains: "grading", mode: "insensitive" } } }, { location: { contains: "grading", mode: "insensitive" } }, { skills: { has: "grading" } }]);
  });

  it("refuses a kind that does not exist", async () => {
    expect(await searchPartiesAction("ROBOT" as never, "")).toEqual({ success: false, error: "Choose buyers, suppliers or freelancers." });
  });
});
