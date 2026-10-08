import { describe, expect, it } from "vitest";
import { EMPTY_SETUP, LOCATION_TYPE_LABEL, NO_ACCESS, reportingTree, toolsInUse, toolsOfMember, PLANNED_TOOLS, TOOLS, VERTICALS, membersWithTools, setToolAccess, toolAccessOf, assignMembers, checkSetup, isValidGstin, registerBusiness, removeLocation, removeTeamMember, saveLocation, saveTeamMember, teamOf, updateBusiness, type Change, type SetupData } from "@/lib/business-structure";

const GST1 = "27AAAAA0001A1Z1";
const GST2 = "29BBBBB0002B1Z2";

/** Unwraps a successful change. */
function done(change: Change): SetupData {
  if (!change.ok) throw new Error(change.error);
  return change.setup;
}
const err = (change: Change) => (change.ok ? "" : change.error);

function oneBusiness(): SetupData {
  return done(registerBusiness(EMPTY_SETUP, { businessName: "Business 1", legalName: "", gstin: GST1 }));
}
const person = (name: string, extra: Partial<Parameters<typeof saveTeamMember>[2]> = {}) => ({ name, designation: "Operations", reportsToCode: "", email: "", mobile: "", ...extra });

describe("GSTIN", () => {
  it("accepts the 15-character GST format, in any case, and rejects anything else", () => {
    expect(isValidGstin(GST1)).toBe(true);
    expect(isValidGstin(" 27aaaaa0001a1z1 ")).toBe(true);
    expect(isValidGstin("27AAAAA0001A1Z")).toBe(false);
    expect(isValidGstin("27AAAAA0001A1X1")).toBe(false);
    expect(isValidGstin("")).toBe(false);
  });
  it("saving the tables refuses a wrong GSTIN but allows a blank one", () => {
    const s = oneBusiness();
    expect(checkSetup(s).errors).toEqual([]);
    expect(checkSetup({ ...s, entities: [{ ...s.entities[0], gstin: "" }] }).errors).toEqual([]);
    expect(checkSetup({ ...s, entities: [{ ...s.entities[0], gstin: "12345" }] }).errors[0]).toMatch(/GSTIN must be 15 characters/);
  });
});

describe("register and edit a business", () => {
  it("makes the company and the business, with the next codes", () => {
    const s = oneBusiness();
    expect(s.entities).toEqual([{ code: "E001", legalName: "Business 1", gstin: GST1, registeredAddress: "" }]);
    expect(s.businesses).toEqual([{ code: "B001", entityCode: "E001", name: "Business 1", operationalAddress: "" }]);
  });
  it("two businesses with the same GST share one company; a different GST makes another", () => {
    let s = oneBusiness();
    s = done(registerBusiness(s, { businessName: "Business 2", legalName: "", gstin: GST1.toLowerCase() }));
    expect(s.entities).toHaveLength(1);
    expect(s.businesses.map((b) => b.entityCode)).toEqual(["E001", "E001"]);
    s = done(registerBusiness(s, { businessName: "Business 3", legalName: "Three Ltd", gstin: GST2 }));
    expect(s.entities.map((e) => [e.code, e.legalName])).toEqual([["E001", "Business 1"], ["E002", "Three Ltd"]]);
  });
  it("refuses a missing name, a duplicate name and a wrong GSTIN, and saves nothing", () => {
    const s = oneBusiness();
    expect(err(registerBusiness(s, { businessName: " ", legalName: "", gstin: "" }))).toBe("Enter the business name.");
    expect(err(registerBusiness(s, { businessName: "business 1", legalName: "", gstin: "" }))).toBe("A business with this name already exists.");
    expect(err(registerBusiness(s, { businessName: "X", legalName: "", gstin: "123" }))).toMatch(/15-character GSTIN/);
    expect(s.businesses).toHaveLength(1);
  });
  it("a business may be registered without a GST yet", () => {
    const s = done(registerBusiness(EMPTY_SETUP, { businessName: "Soon", legalName: "", gstin: "" }));
    expect(s.entities[0].gstin).toBe("");
  });
  it("changing the GST of the only business changes its company; a shared company is split; an existing GST is joined", () => {
    let s = oneBusiness();
    s = done(updateBusiness(s, "B001", { name: "Business One", gstin: GST2 }));
    expect(s.entities).toEqual([{ code: "E001", legalName: "Business 1", gstin: GST2, registeredAddress: "" }]);
    expect(s.businesses[0].name).toBe("Business One");

    // two businesses on one company: moving one to a new GST makes a new company for it
    s = done(registerBusiness(s, { businessName: "Business 2", legalName: "", gstin: GST2 }));
    s = done(updateBusiness(s, "B002", { name: "Business 2", gstin: GST1 }));
    expect(s.businesses.map((b) => b.entityCode)).toEqual(["E001", "E002"]);
    expect(s.entities.map((e) => e.gstin)).toEqual([GST2, GST1]);

    // moving it to the GST the other company already has joins that company; the empty one is dropped
    s = done(updateBusiness(s, "B002", { name: "Business 2", gstin: GST2 }));
    expect(s.businesses.map((b) => b.entityCode)).toEqual(["E001", "E001"]);
    expect(s.entities.map((e) => e.code)).toEqual(["E001"]);
  });
});

describe("team members", () => {
  it("a new person joins the team with no location and the next codes", () => {
    const s = done(saveTeamMember(oneBusiness(), "B001", person("Asha", { designation: "Director", email: "Asha@Example.com" })));
    expect(s.members).toEqual([{ code: "M001", name: "Asha", mobile: "", email: "asha@example.com", photoUrl: "" }]);
    expect(s.assignments).toEqual([{ code: "A001", memberCode: "M001", businessCode: "B001", locationCode: "", designation: "Director", reportsToCode: "" }]);
    expect(teamOf(s, "B001")).toEqual([{ memberCode: "M001", name: "Asha", email: "asha@example.com", mobile: "", designation: "Director", reportsToCode: "", locationCodes: [], assignmentCodes: ["A001"] }]);
    expect(checkSetup(s).errors).toEqual([]);
  });
  it("needs a name and a designation from the list", () => {
    const s = oneBusiness();
    expect(err(saveTeamMember(s, "B001", person(" ")))).toBe("Enter the member's name.");
    expect(err(saveTeamMember(s, "B001", person("A", { designation: "" })))).toBe("Choose a designation.");
    expect(err(saveTeamMember(s, "B001", person("A", { designation: "Wizard" })))).toBe("Choose a designation.");
    expect(err(saveTeamMember(s, "B001", person("A", { email: "nope" })))).toBe("Enter a valid email address.");
  });
  it("reporting: only to someone on the same team, never to oneself, never in a circle", () => {
    let s = done(saveTeamMember(oneBusiness(), "B001", person("Boss", { designation: "Director" })));
    s = done(saveTeamMember(s, "B001", person("Ravi", { reportsToCode: "M001" })));
    s = done(saveTeamMember(s, "B001", person("Sana", { reportsToCode: "M002" })));
    expect(teamOf(s, "B001").map((t) => [t.name, t.reportsToCode])).toEqual([["Boss", ""], ["Ravi", "M001"], ["Sana", "M002"]]);

    expect(err(saveTeamMember(s, "B001", { ...person("Boss", { designation: "Director" }), memberCode: "M001", reportsToCode: "M001" }))).toBe("A member cannot report to themselves.");
    // Boss reporting to Sana (who reports to Ravi, who reports to Boss) would be a loop
    expect(err(saveTeamMember(s, "B001", { ...person("Boss", { designation: "Director" }), memberCode: "M001", reportsToCode: "M003" }))).toBe("Reporting cannot create a circular hierarchy.");
    expect(err(saveTeamMember(s, "B001", person("New", { reportsToCode: "M099" })))).toBe("A person can only report to someone on this business's team.");
    expect(checkSetup(s).errors).toEqual([]);
  });
  it("editing changes the designation and reporting line on all of the person's locations in the business", () => {
    let s = done(saveTeamMember(oneBusiness(), "B001", person("Boss", { designation: "Director" })));
    s = done(saveTeamMember(s, "B001", person("Ravi")));
    // Ravi works at two locations (assigned in the next step)
    s = { ...s, locations: [{ code: "L001", businessCode: "B001", type: "WAREHOUSE", name: "W1", address: "", mapPin: "" }, { code: "L002", businessCode: "B001", type: "RETAIL_STORE", name: "S1", address: "", mapPin: "" }], assignments: s.assignments.filter((a) => a.memberCode !== "M002").concat([{ code: "A010", memberCode: "M002", businessCode: "B001", locationCode: "L001", designation: "Operations", reportsToCode: "" }, { code: "A011", memberCode: "M002", businessCode: "B001", locationCode: "L002", designation: "Operations", reportsToCode: "" }]) };
    s = done(saveTeamMember(s, "B001", { ...person("Ravi K", { designation: "Store Manager", reportsToCode: "M001" }), memberCode: "M002" }));
    expect(s.assignments.filter((a) => a.memberCode === "M002").map((a) => [a.designation, a.reportsToCode])).toEqual([["Store Manager", "M001"], ["Store Manager", "M001"]]);
    expect(s.members.find((m) => m.code === "M002")?.name).toBe("Ravi K");
    expect(teamOf(s, "B001").find((t) => t.memberCode === "M002")?.locationCodes).toEqual(["L001", "L002"]);
  });
  it("the same person (same email) is one member, and can be on the teams of two businesses", () => {
    let s = done(saveTeamMember(oneBusiness(), "B001", person("Asha", { email: "asha@example.com" })));
    expect(err(saveTeamMember(s, "B001", person("Asha again", { email: "ASHA@example.com" })))).toBe("Asha is already on this team.");
    s = done(registerBusiness(s, { businessName: "Business 2", legalName: "", gstin: GST2 }));
    s = done(saveTeamMember(s, "B002", person("Asha again", { email: "asha@example.com", designation: "Accounts" })));
    expect(s.members).toHaveLength(1);
    expect(teamOf(s, "B001")).toHaveLength(1);
    expect(teamOf(s, "B002")).toHaveLength(1);
    expect(s.assignments.map((a) => [a.businessCode, a.designation])).toEqual([["B001", "Operations"], ["B002", "Accounts"]]);
  });
  it("removing someone moves their reports to the top, takes their tool access, and drops them if they are on no other team", () => {
    let s = done(saveTeamMember(oneBusiness(), "B001", person("Boss", { designation: "Director" })));
    s = done(saveTeamMember(s, "B001", person("Ravi", { reportsToCode: "M001" })));
    s = { ...s, access: [{ assignmentCode: "A001", tool: "Inventory", view: true, create: false, edit: false, approve: false }, { assignmentCode: "A002", tool: "Inventory", view: true, create: false, edit: false, approve: false }] };
    const after = done(removeTeamMember(s, "B001", "M001"));
    expect(after.members.map((m) => m.code)).toEqual(["M002"]);
    expect(after.assignments).toEqual([{ code: "A002", memberCode: "M002", businessCode: "B001", locationCode: "", designation: "Operations", reportsToCode: "" }]);
    expect(after.access.map((a) => a.assignmentCode)).toEqual(["A002"]);
    expect(checkSetup(after).errors).toEqual([]);
    expect(err(removeTeamMember(after, "B001", "M001"))).toBe("This person is not on the team.");
  });
  it("a person on two teams stays in Members when removed from one", () => {
    let s = done(saveTeamMember(oneBusiness(), "B001", person("Asha", { email: "asha@example.com" })));
    s = done(registerBusiness(s, { businessName: "Business 2", legalName: "", gstin: GST2 }));
    s = done(saveTeamMember(s, "B002", person("Asha", { email: "asha@example.com" })));
    const after = done(removeTeamMember(s, "B001", "M001"));
    expect(after.members).toHaveLength(1);
    expect(teamOf(after, "B002")).toHaveLength(1);
    expect(teamOf(after, "B001")).toHaveLength(0);
  });
  it("a team member with no location passes the same checks as the setup tables", () => {
    const s = done(saveTeamMember(oneBusiness(), "B001", person("Asha")));
    expect(checkSetup(s).errors).toEqual([]);
    // a location that is given must still exist and belong to the business
    const bad = { ...s, assignments: [{ ...s.assignments[0], locationCode: "L099" }] };
    expect(checkSetup(bad).errors[0]).toMatch(/Location ID L099 is not in Locations/);
  });
});

// ---------------------------------------------------------------- verticals & locations

function team3(): SetupData {
  let s = done(saveTeamMember(oneBusiness(), "B001", person("Asha", { designation: "Director" })));
  s = done(saveTeamMember(s, "B001", person("Ravi", { designation: "Warehouse Manager", reportsToCode: "M001" })));
  s = done(saveTeamMember(s, "B001", person("Sana", { designation: "Store Manager", reportsToCode: "M001" })));
  return s;
}
const loc = (type: "WAREHOUSE" | "RETAIL_STORE" | "OFFICE", name: string, address = "") => ({ type, name, address });

describe("verticals and locations", () => {
  it("the three verticals are Warehouse, Retail Store and Back Office", () => {
    expect(VERTICALS.map((t) => LOCATION_TYPE_LABEL[t])).toEqual(["Warehouse", "Retail Store", "Back Office"]);
  });
  it("adds many locations of each type, with the next codes; names are unique within a business", () => {
    let s = oneBusiness();
    s = done(saveLocation(s, "B001", loc("WAREHOUSE", "Warehouse 1")));
    s = done(saveLocation(s, "B001", loc("WAREHOUSE", "Warehouse 2", "Plot 4, Bhiwandi")));
    s = done(saveLocation(s, "B001", loc("RETAIL_STORE", "Store 1")));
    s = done(saveLocation(s, "B001", loc("OFFICE", "Head office")));
    expect(s.locations.map((l) => [l.code, l.type, l.name])).toEqual([["L001", "WAREHOUSE", "Warehouse 1"], ["L002", "WAREHOUSE", "Warehouse 2"], ["L003", "RETAIL_STORE", "Store 1"], ["L004", "OFFICE", "Head office"]]);
    expect(s.locations[1].address).toBe("Plot 4, Bhiwandi");
    expect(err(saveLocation(s, "B001", loc("RETAIL_STORE", " warehouse 1 ")))).toBe("A location with this name already exists.");
    expect(err(saveLocation(s, "B001", loc("RETAIL_STORE", " ")))).toBe("Enter the location name.");
    expect(checkSetup(s).errors).toEqual([]);
  });
  it("the same name may be used by another business", () => {
    let s = done(saveLocation(oneBusiness(), "B001", loc("WAREHOUSE", "Main")));
    s = done(registerBusiness(s, { businessName: "Business 2", legalName: "", gstin: GST2 }));
    s = done(saveLocation(s, "B002", loc("WAREHOUSE", "Main")));
    expect(s.locations.map((l) => l.businessCode)).toEqual(["B001", "B002"]);
  });
  it("editing changes the name and address but never the type", () => {
    let s = done(saveLocation(oneBusiness(), "B001", loc("WAREHOUSE", "Warehouse 1")));
    s = done(saveLocation(s, "B001", { locationCode: "L001", ...loc("OFFICE", "Main warehouse", "Pune") }));
    expect(s.locations[0]).toMatchObject({ code: "L001", type: "WAREHOUSE", name: "Main warehouse", address: "Pune" });
    expect(err(saveLocation(s, "B001", { locationCode: "L099", ...loc("WAREHOUSE", "X") }))).toBe("Location not found.");
  });
  it("assigning: a person with no location gets it, a person elsewhere gets an extra assignment with the same designation, reporting line and tool access", () => {
    let s = team3();
    s = done(saveLocation(s, "B001", loc("WAREHOUSE", "Warehouse 1")));
    s = done(saveLocation(s, "B001", loc("RETAIL_STORE", "Store 1")));
    s = { ...s, access: [{ assignmentCode: "A002", tool: "Inventory", view: true, create: true, edit: false, approve: false }] };
    s = done(assignMembers(s, "B001", "L001", ["M001", "M002"]));
    expect(s.assignments.map((a) => [a.code, a.memberCode, a.locationCode])).toEqual([["A001", "M001", "L001"], ["A002", "M002", "L001"], ["A003", "M003", ""]]);
    // Ravi also works at the store
    s = done(assignMembers(s, "B001", "L002", ["M002", "M003"]));
    expect(s.assignments.map((a) => [a.code, a.memberCode, a.locationCode, a.designation, a.reportsToCode])).toEqual([
      ["A001", "M001", "L001", "Director", ""],
      ["A002", "M002", "L001", "Warehouse Manager", "M001"],
      ["A003", "M003", "L002", "Store Manager", "M001"],
      ["A004", "M002", "L002", "Warehouse Manager", "M001"],
    ]);
    expect(s.access.map((t) => [t.assignmentCode, t.tool, t.create])).toEqual([["A002", "Inventory", true], ["A004", "Inventory", true]]);
    expect(teamOf(s, "B001").find((t) => t.memberCode === "M002")?.locationCodes).toEqual(["L001", "L002"]);
    expect(checkSetup(s).errors).toEqual([]);
  });
  it("unticking takes a person off a location; their last location leaves them on the team, unassigned, with their tool access", () => {
    let s = team3();
    s = done(saveLocation(s, "B001", loc("WAREHOUSE", "Warehouse 1")));
    s = done(saveLocation(s, "B001", loc("RETAIL_STORE", "Store 1")));
    s = done(assignMembers(s, "B001", "L001", ["M002"]));
    s = { ...s, access: [{ assignmentCode: "A002", tool: "Inventory", view: true, create: false, edit: false, approve: false }] };
    s = done(assignMembers(s, "B001", "L002", ["M002"])); // second location → A004 with copied access
    s = done(assignMembers(s, "B001", "L001", []));
    expect(s.assignments.filter((a) => a.memberCode === "M002").map((a) => [a.code, a.locationCode])).toEqual([["A004", "L002"]]);
    expect(s.access.map((t) => t.assignmentCode)).toEqual(["A004"]);
    s = done(assignMembers(s, "B001", "L002", []));
    expect(teamOf(s, "B001").find((t) => t.memberCode === "M002")).toMatchObject({ locationCodes: [], designation: "Warehouse Manager" });
    expect(s.access.map((t) => t.assignmentCode)).toEqual(["A004"]);
  });
  it("only people on this business's team can be assigned, and only to its own locations", () => {
    let s = team3();
    s = done(saveLocation(s, "B001", loc("WAREHOUSE", "Warehouse 1")));
    expect(err(assignMembers(s, "B001", "L001", ["M099"]))).toBe("Only people on this business's team can be assigned.");
    expect(err(assignMembers(s, "B001", "L099", ["M001"]))).toBe("Location not found.");
    s = done(registerBusiness(s, { businessName: "Business 2", legalName: "", gstin: GST2 }));
    expect(err(assignMembers(s, "B002", "L001", []))).toBe("Location not found.");
  });
  it("deleting a location leaves its people on the team, unassigned", () => {
    let s = team3();
    s = done(saveLocation(s, "B001", loc("WAREHOUSE", "Warehouse 1")));
    s = done(assignMembers(s, "B001", "L001", ["M001", "M002"]));
    s = done(removeLocation(s, "L001"));
    expect(s.locations).toEqual([]);
    expect(teamOf(s, "B001").map((t) => t.locationCodes)).toEqual([[], [], []]);
    expect(checkSetup(s).errors).toEqual([]);
    expect(err(removeLocation(s, "L001"))).toBe("Location not found.");
  });
});

// ---------------------------------------------------------------- tool access

describe("tool access", () => {
  const view = { ...NO_ACCESS, view: true };
  it("the tool list now has Retail POS, Purchases and Banking, marked as not built yet", () => {
    for (const t of PLANNED_TOOLS) expect(TOOLS as readonly string[]).toContain(t);
    expect(PLANNED_TOOLS).toEqual(["Retail POS", "Purchases", "Banking"]);
    expect(new Set(TOOLS).size).toBe(TOOLS.length);
  });
  it("switching a tool on gives View; it is stored on every location the person works at", () => {
    let s = team3();
    s = done(saveLocation(s, "B001", loc("WAREHOUSE", "Warehouse 1")));
    s = done(saveLocation(s, "B001", loc("RETAIL_STORE", "Store 1")));
    s = done(assignMembers(s, "B001", "L001", ["M002"]));
    s = done(assignMembers(s, "B001", "L002", ["M002"]));
    s = done(setToolAccess(s, "B001", "M002", "Inventory", view));
    expect(s.access.map((t) => [t.assignmentCode, t.tool, t.view]).sort()).toEqual([["A002", "Inventory", true], ["A004", "Inventory", true]]);
    expect(toolAccessOf(s, "B001", "M002").get("Inventory")).toEqual(view);
    expect(checkSetup(s).errors).toEqual([]);
  });
  it("Create, Edit or Approve turn View on; View off clears the rest; no level removes the tool", () => {
    let s = team3();
    s = done(setToolAccess(s, "B001", "M002", "Catalog", { ...NO_ACCESS, edit: true }));
    expect(toolAccessOf(s, "B001", "M002").get("Catalog")).toEqual({ view: true, create: false, edit: true, approve: false });
    s = done(setToolAccess(s, "B001", "M002", "Catalog", { view: false, create: true, edit: true, approve: true }));
    expect(toolAccessOf(s, "B001", "M002").get("Catalog")).toEqual({ view: true, create: true, edit: true, approve: true });
    s = done(setToolAccess(s, "B001", "M002", "Catalog", NO_ACCESS));
    expect(toolAccessOf(s, "B001", "M002").size).toBe(0);
    expect(s.access).toEqual([]);
  });
  it("tools are per person: one person's switches never touch another's", () => {
    let s = team3();
    s = done(setToolAccess(s, "B001", "M002", "Inventory", view));
    s = done(setToolAccess(s, "B001", "M003", "Banking", view));
    expect([...toolAccessOf(s, "B001", "M002").keys()]).toEqual(["Inventory"]);
    expect([...toolAccessOf(s, "B001", "M003").keys()]).toEqual(["Banking"]);
    expect(membersWithTools(s, "B001")).toBe(2);
    s = done(setToolAccess(s, "B001", "M003", "Banking", NO_ACCESS));
    expect(membersWithTools(s, "B001")).toBe(1);
  });
  it("refuses a tool that is not in the list and a person who is not on the team", () => {
    const s = team3();
    expect(err(setToolAccess(s, "B001", "M002", "Time travel", view))).toBe("Choose a tool from the list.");
    expect(err(setToolAccess(s, "B001", "M099", "Inventory", view))).toBe("This person is not on the team.");
  });
  it("a person with no location can have tools; they stay when a location is added", () => {
    let s = team3();
    s = done(saveLocation(s, "B001", loc("WAREHOUSE", "Warehouse 1")));
    s = done(setToolAccess(s, "B001", "M002", "Inventory", view));
    s = done(assignMembers(s, "B001", "L001", ["M002"]));
    expect(toolAccessOf(s, "B001", "M002").get("Inventory")).toEqual(view);
  });
});


// ---------------------------------------------------------------- structure overview
describe("reporting tree and tools overview", () => {
  const tree = (s: SetupData) => reportingTree(teamOf(s, "B001")).map(function walk(n): unknown {
    return n.children.length ? { [n.member.name]: n.children.map(walk) } : n.member.name;
  });

  it("people with no manager are the top; everyone else hangs under whoever they report to", () => {
    let s = done(saveTeamMember(oneBusiness(), "B001", person("Asha", { designation: "Director" })));
    s = done(saveTeamMember(s, "B001", person("Ravi", { reportsToCode: "M001" })));
    s = done(saveTeamMember(s, "B001", person("Sana", { reportsToCode: "M001" })));
    s = done(saveTeamMember(s, "B001", person("Kiran", { reportsToCode: "M002" })));
    s = done(saveTeamMember(s, "B001", person("Meera")));
    expect(tree(s)).toEqual([{ Asha: [{ Ravi: ["Kiran"] }, "Sana"] }, "Meera"]);
  });
  it("an empty team has no tree", () => {
    expect(reportingTree([])).toEqual([]);
  });
  it("a loop in old data cannot hide anyone: they are all still shown, once", () => {
    const team = [
      { memberCode: "M001", name: "A", email: "", mobile: "", designation: "Director", reportsToCode: "M002", locationCodes: [], assignmentCodes: [] },
      { memberCode: "M002", name: "B", email: "", mobile: "", designation: "Director", reportsToCode: "M001", locationCodes: [], assignmentCodes: [] },
      { memberCode: "M003", name: "C", email: "", mobile: "", designation: "Director", reportsToCode: "M003", locationCodes: [], assignmentCodes: [] },
    ];
    const names: string[] = [];
    const walk = (nodes: ReturnType<typeof reportingTree>) => nodes.forEach((n) => (names.push(n.member.name), walk(n.children)));
    walk(reportingTree(team));
    expect(names.sort()).toEqual(["A", "B", "C"]);
  });
  it("tools of a member are in the order of the tool list; tools in use counts different tools across the team", () => {
    let s = team3();
    s = done(setToolAccess(s, "B001", "M002", "Banking", { ...NO_ACCESS, view: true }));
    s = done(setToolAccess(s, "B001", "M002", "Dashboard", { ...NO_ACCESS, view: true }));
    s = done(setToolAccess(s, "B001", "M003", "Banking", { ...NO_ACCESS, view: true }));
    expect(toolsOfMember(s, "B001", "M002").map((t) => t.tool)).toEqual(["Dashboard", "Banking"]);
    expect(toolsOfMember(s, "B001", "M001")).toEqual([]);
    expect(toolsInUse(s, "B001")).toBe(2);
  });
});
