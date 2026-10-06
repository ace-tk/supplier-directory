// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { BusinessStructureTabs } from "@/components/business-structure/BusinessStructureTabs";
import { permissionForAdminHref } from "@/lib/roles";
import { MODULE_GROUPS, ROADMAP_PHASES, CONNECTED_FLOWS, PORTALS } from "@/lib/business-structure-content";
import { EMPTY_SETUP } from "@/lib/business-structure";

afterEach(() => cleanup());

describe("Business Structure sidebar access", () => {
  it("is admin only: the mapping requires '*', which only ADMIN holds", () => {
    expect(permissionForAdminHref("/business-structure")).toBe("*");
  });
});

describe("Business Structure content (from the prototype)", () => {
  it("has the prototype's four portals, seven flows and four roadmap phases", () => {
    expect(PORTALS.map((p) => p.name)).toEqual(["Admin portal", "Buyer portal", "Supplier portal", "Freelancer portal"]);
    expect(CONNECTED_FLOWS).toHaveLength(7);
    expect(ROADMAP_PHASES).toHaveLength(4);
  });

  it("lists the prototype's modules with the same status counts", () => {
    const all = MODULE_GROUPS.flatMap((g) => g.items);
    const count = (s: string) => all.filter((m) => m.status === s).length;
    expect(all).toHaveLength(count("built") + count("partly") + count("planned"));
    expect(count("built")).toBe(20);
    expect(count("partly")).toBe(2);
    expect(count("planned")).toBe(5);
  });
});

describe("BusinessStructureTabs", () => {
  it("shows all eight tabs, with Overview first", () => {
    render(<BusinessStructureTabs initialSetup={EMPTY_SETUP} />);
    const labels = screen.getAllByRole("tab").map((t) => t.textContent);
    expect(labels).toEqual(["Overview", "Setup Tables", "Hierarchy", "Portals", "Modules", "Connected Flows", "Deals", "App Roadmap"]);
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
  });

  it("opens every tab and shows its content", () => {
    render(<BusinessStructureTabs initialSetup={EMPTY_SETUP} />);
    const panel = () => screen.getByRole("tabpanel");

    fireEvent.click(screen.getByRole("tab", { name: "Overview" }));
    expect(within(panel()).getByText("Businesses under your organization")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Setup Tables" }));
    expect(within(panel()).getByText("Legal Entities")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Hierarchy" }));
    expect(within(panel()).getByText("Nothing to show yet. Save the setup tables and the hierarchy is generated from them.")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Portals" }));
    expect(within(panel()).getByText("Freelancer portal")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Modules" }));
    expect(within(panel()).getByText("Team Management")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Connected Flows" }));
    expect(within(panel()).getByText("Deal")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Deals" }));
    expect(within(panel()).getByText("Deals")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "App Roadmap" }));
    expect(within(panel()).getByText("What needs building, in order")).toBeTruthy();
  });

  it("filters modules by status", () => {
    render(<BusinessStructureTabs initialSetup={EMPTY_SETUP} />);
    fireEvent.click(screen.getByRole("tab", { name: "Modules" }));
    fireEvent.click(screen.getByRole("button", { name: /^Planned \(5\)$/ }));
    expect(screen.getByText("Sampling")).toBeTruthy();
    expect(screen.queryByText("Team Management")).toBeNull();
  });
});
