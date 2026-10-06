// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Hierarchy } from "@/components/business-structure/Hierarchy";
import { EMPTY_SETUP, type SetupData } from "@/lib/business-structure";

afterEach(() => cleanup());

const saved: SetupData = {
  entities: [{ code: "E001", legalName: "STYLEIT Enterprises", gstin: "", registeredAddress: "" }],
  businesses: [{ code: "B001", entityCode: "E001", name: "RASA Fashion", operationalAddress: "" }],
  locations: [{ code: "L001", businessCode: "B001", type: "WAREHOUSE", name: "Main warehouse", address: "", mapPin: "" }],
  members: [
    { code: "M001", name: "Mohit", mobile: "", email: "mohit@example.com", photoUrl: "" },
    { code: "M002", name: "Asha", mobile: "", email: "", photoUrl: "" },
  ],
  assignments: [
    { code: "A001", memberCode: "M001", businessCode: "B001", locationCode: "L001", designation: "Director", reportsToCode: "" },
    { code: "A002", memberCode: "M002", businessCode: "B001", locationCode: "L001", designation: "Operations", reportsToCode: "M001" },
  ],
  access: [{ assignmentCode: "A002", tool: "Inventory", view: true, create: true, edit: false, approve: false }],
};

describe("Hierarchy", () => {
  it("draws the organisation and the reporting chart from the saved setup", () => {
    render(<Hierarchy saved={saved} onEdit={() => {}} />);
    expect(screen.getByText("STYLEIT Enterprises")).toBeTruthy();
    expect(screen.getByText("Reporting · RASA Fashion")).toBeTruthy();
    // Asha reports to Mohit, so she sits under him in the chart.
    const chart = screen.getByText("Reporting · RASA Fashion").closest("div[class*='rounded']")!.parentElement!;
    expect(within(chart).getByText("Asha")).toBeTruthy();
  });

  it("shows a member's assignments, reporting line and tool access when clicked", () => {
    const onEdit = vi.fn();
    render(<Hierarchy saved={saved} onEdit={onEdit} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Asha" })[0]);
    expect(screen.getByText("Operations · RASA Fashion")).toBeTruthy();
    expect(screen.getByText(/reports to Mohit/)).toBeTruthy();
    expect(screen.getByText("Inventory")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit in Setup Tables" }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("explains that nothing is saved yet", () => {
    render(<Hierarchy saved={EMPTY_SETUP} onEdit={() => {}} />);
    expect(screen.getByText("Nothing to show yet. Save the setup tables and the hierarchy is generated from them.")).toBeTruthy();
  });
});
