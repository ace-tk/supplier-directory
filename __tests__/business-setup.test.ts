import { describe, expect, it } from "vitest";
import { EMPTY_SETUP, checkSetup, nextCode, normalizeSetup, validateSetup, type SetupData } from "@/lib/business-structure";

/** A small, valid setup: one entity, one business, two locations, two members, two assignments. */
function validSetup(): SetupData {
  return {
    entities: [{ code: "E001", legalName: "STYLEIT Enterprises", gstin: "", registeredAddress: "" }],
    businesses: [{ code: "B001", entityCode: "E001", name: "RASA Fashion", operationalAddress: "" }],
    locations: [
      { code: "L001", businessCode: "B001", type: "WAREHOUSE", name: "Main warehouse", address: "", mapPin: "" },
      { code: "L002", businessCode: "B001", type: "RETAIL_STORE", name: "Store", address: "", mapPin: "" },
    ],
    members: [
      { code: "M001", name: "Mohit", mobile: "", email: "", photoUrl: "" },
      { code: "M002", name: "Asha", mobile: "", email: "", photoUrl: "" },
    ],
    assignments: [
      { code: "A001", memberCode: "M001", businessCode: "B001", locationCode: "L001", designation: "Director", reportsToCode: "" },
      { code: "A002", memberCode: "M002", businessCode: "B001", locationCode: "L002", designation: "Store Manager", reportsToCode: "M001" },
    ],
    access: [{ assignmentCode: "A002", tool: "Dashboard", view: true, create: false, edit: false, approve: false }],
  };
}

describe("validateSetup", () => {
  it("accepts a valid setup", () => {
    expect(validateSetup(validSetup())).toEqual([]);
  });

  it("reports a missing required field with the row number and ID", () => {
    const s = validSetup();
    s.entities[0].legalName = "  ";
    expect(validateSetup(s)).toContain("Legal Entities row 1 (E001): Legal name is required.");
  });

  it("reports duplicate and missing IDs", () => {
    const s = validSetup();
    s.members.push({ code: "M001", name: "Copy", mobile: "", email: "", photoUrl: "" });
    s.members.push({ code: "", name: "No id", mobile: "", email: "", photoUrl: "" });
    const errors = validateSetup(s);
    expect(errors).toContain("Members row 3 (M001): duplicate ID.");
    expect(errors).toContain("Members row 4 (no ID): ID is required.");
  });

  it("reports a link to a missing row, in the prototype's words", () => {
    const s = validSetup();
    s.businesses[0].entityCode = "E009";
    expect(validateSetup(s)).toContain("Businesses row 1 (B001): Entity ID E009 is not in Legal Entities.");
  });

  it("reports a location that belongs to a different business than the assignment", () => {
    const s = validSetup();
    s.businesses.push({ code: "B002", entityCode: "E001", name: "Other", operationalAddress: "" });
    s.assignments[1].businessCode = "B002";
    expect(validateSetup(s)).toContain("Assignments A002: location L002 belongs to a different business.");
  });

  it("refuses a member reporting to themselves", () => {
    const s = validSetup();
    s.assignments[0].reportsToCode = "M001";
    expect(validateSetup(s)).toContain("Assignments A001: a member cannot report to themselves.");
  });

  it("finds a reporting loop and names the assignments in it", () => {
    const s = validSetup();
    s.assignments[0].reportsToCode = "M002";
    expect(validateSetup(s)).toContain("Assignments: reporting loop in RASA Fashion between A001, A002. Someone must be at the top.");
  });

  it("accepts a chain of reports that ends at the top", () => {
    const s = validSetup();
    s.members.push({ code: "M003", name: "Ravi", mobile: "", email: "", photoUrl: "" });
    s.assignments.push({ code: "A003", memberCode: "M003", businessCode: "B001", locationCode: "L001", designation: "Designer", reportsToCode: "M002" });
    expect(validateSetup(s)).toEqual([]);
  });

  it("rejects a tool access row for an assignment that is gone", () => {
    const s = validSetup();
    s.access = [{ assignmentCode: "A009", tool: "Dashboard", view: true, create: false, edit: false, approve: false }];
    expect(validateSetup(s)).toContain("Tool Access row 1 (A009): Assignment ID A009 is not in Assignments.");
  });

  it("lists problems in the order of the tables", () => {
    const s = validSetup();
    s.entities[0].legalName = "";
    s.assignments[0].designation = "";
    const errors = validateSetup(s);
    expect(errors.indexOf("Legal Entities row 1 (E001): Legal name is required.")).toBeLessThan(errors.indexOf("Assignments row 1 (A001): Designation is required."));
  });
});

describe("normalizeSetup", () => {
  it("drops tool access rows with no level ticked", () => {
    const s = validSetup();
    s.access = [{ assignmentCode: "A001", tool: "Team", view: false, create: false, edit: false, approve: false }];
    expect(normalizeSetup(s).access).toEqual([]);
  });

  it("drops tool access rows whose assignment is gone", () => {
    const s = validSetup();
    s.access = [{ assignmentCode: "A009", tool: "Team", view: true, create: false, edit: false, approve: false }];
    expect(normalizeSetup(s).access).toEqual([]);
  });

  it("forces View on when another level is ticked, and clears the rest when View is off", () => {
    const s = validSetup();
    s.access = [
      { assignmentCode: "A001", tool: "Team", view: false, create: true, edit: false, approve: false },
      { assignmentCode: "A001", tool: "CRM", view: false, create: false, edit: true, approve: true },
    ];
    const out = normalizeSetup(s).access;
    expect(out[0].view).toBe(true);
    expect(out[0].create).toBe(true);
    expect(out[1].view).toBe(true);
    expect(out[1].edit).toBe(true);
  });

  it("checkSetup runs both steps", () => {
    const s = validSetup();
    s.access = [{ assignmentCode: "A001", tool: "Team", view: false, create: false, edit: false, approve: false }];
    expect(checkSetup(s)).toEqual({ data: { ...s, access: [] }, errors: [] });
  });
});

describe("nextCode", () => {
  it("returns the next zero-padded code after the highest one", () => {
    expect(nextCode("E", [])).toBe("E001");
    expect(nextCode("M", [{ code: "M001" }, { code: "M009" }, { code: "M003" }])).toBe("M010");
  });

  it("works on an empty setup", () => {
    expect(EMPTY_SETUP.members).toEqual([]);
  });
});
