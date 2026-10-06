// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SetupTables } from "@/components/business-structure/SetupTables";
import { EMPTY_SETUP, type SetupData } from "@/lib/business-structure";

const save = vi.hoisted(() => ({ saveBusinessSetupAction: vi.fn() }));
vi.mock("@/services/business-structure", () => ({ saveBusinessSetupAction: save.saveBusinessSetupAction }));

afterEach(() => cleanup());
beforeEach(() => vi.clearAllMocks());

function withEntity(): SetupData {
  return { ...EMPTY_SETUP, entities: [{ code: "E001", legalName: "STYLEIT Enterprises", gstin: "", registeredAddress: "" }] };
}

describe("SetupTables", () => {
  it("adds a row with the next code and shows the required marker", () => {
    render(<SetupTables initial={EMPTY_SETUP} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Row" }));
    expect((screen.getByLabelText("Legal Entities row 1 ID") as HTMLInputElement).value).toBe("E001");
    expect(screen.getByText("Legal name")).toBeTruthy();
  });

  it("lists the problems and does not save or report success when validation fails", async () => {
    save.saveBusinessSetupAction.mockResolvedValue({ success: false, errors: ["Legal Entities row 1 (E001): Legal name is required."] });
    const onSaved = vi.fn();
    render(<SetupTables initial={EMPTY_SETUP} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Row" }));
    fireEvent.click(screen.getByRole("button", { name: "Validate & Save" }));

    expect(await screen.findByText("1 thing to fix before saving")).toBeTruthy();
    expect(screen.getByText("Legal Entities row 1 (E001): Legal name is required.")).toBeTruthy();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("caps the error list at 30 and says how many more there are", async () => {
    const errors = Array.from({ length: 33 }, (_, i) => `Problem ${i + 1}`);
    save.saveBusinessSetupAction.mockResolvedValue({ success: false, errors });
    render(<SetupTables initial={withEntity()} onSaved={() => {}} />);
    fireEvent.change(screen.getByLabelText("Legal Entities row 1 Legal name"), { target: { value: "Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate & Save" }));
    expect(await screen.findByText("33 things to fix before saving")).toBeTruthy();
    expect(screen.getByText("Problem 30")).toBeTruthy();
    expect(screen.queryByText("Problem 31")).toBeNull();
    expect(screen.getByText("…and 3 more.")).toBeTruthy();
  });

  it("saves, reports the new hierarchy, and passes the saved setup up", async () => {
    const saved = withEntity();
    save.saveBusinessSetupAction.mockResolvedValue({ success: true, data: saved });
    const onSaved = vi.fn();
    render(<SetupTables initial={EMPTY_SETUP} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Row" }));
    fireEvent.change(screen.getByLabelText("Legal Entities row 1 Legal name"), { target: { value: "STYLEIT Enterprises" } });
    fireEvent.click(screen.getByRole("button", { name: "Validate & Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  });

  it("clears the location when the business changes, and only offers locations of the chosen business", () => {
    const s: SetupData = {
      ...EMPTY_SETUP,
      businesses: [
        { code: "B001", entityCode: "", name: "RASA", operationalAddress: "" },
        { code: "B002", entityCode: "", name: "STYLEIT", operationalAddress: "" },
      ],
      locations: [
        { code: "L001", businessCode: "B001", type: "WAREHOUSE", name: "Main", address: "", mapPin: "" },
        { code: "L002", businessCode: "B002", type: "OFFICE", name: "Head office", address: "", mapPin: "" },
      ],
      members: [{ code: "M001", name: "Mohit", mobile: "", email: "", photoUrl: "" }],
      assignments: [{ code: "A001", memberCode: "M001", businessCode: "B001", locationCode: "L001", designation: "Director", reportsToCode: "" }],
    };
    render(<SetupTables initial={s} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Assignments \(1\)$/ }));
    const location = screen.getByLabelText("Assignments row 1 Location ID") as HTMLSelectElement;
    expect(Array.from(location.options).map((o) => o.value)).toEqual(["", "L001"]);

    fireEvent.change(screen.getByLabelText("Assignments row 1 Business ID"), { target: { value: "B002" } });
    expect((screen.getByLabelText("Assignments row 1 Location ID") as HTMLSelectElement).value).toBe("");
    expect(Array.from((screen.getByLabelText("Assignments row 1 Location ID") as HTMLSelectElement).options).map((o) => o.value)).toEqual(["", "L002"]);
  });

  it("ticking Create turns View on; unticking View clears the other levels", () => {
    const s: SetupData = {
      ...EMPTY_SETUP,
      assignments: [{ code: "A001", memberCode: "", businessCode: "", locationCode: "", designation: "", reportsToCode: "" }],
      access: [{ assignmentCode: "A001", tool: "Team", view: false, create: false, edit: false, approve: false }],
    };
    render(<SetupTables initial={s} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Tool Access \(1\)$/ }));
    fireEvent.click(screen.getByLabelText("Tool Access row 1 Create"));
    expect((screen.getByLabelText("Tool Access row 1 View") as HTMLInputElement).checked).toBe(true);

    fireEvent.click(screen.getByLabelText("Tool Access row 1 Edit"));
    fireEvent.click(screen.getByLabelText("Tool Access row 1 View"));
    expect((screen.getByLabelText("Tool Access row 1 Create") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Tool Access row 1 Edit") as HTMLInputElement).checked).toBe(false);
  });

  it("shows the unsaved-changes note after an edit", () => {
    render(<SetupTables initial={EMPTY_SETUP} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Add Row" }));
    expect(screen.getByText("Unsaved changes.")).toBeTruthy();
  });
});
