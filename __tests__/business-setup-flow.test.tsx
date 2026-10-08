// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BusinessSetup, type BusinessSetupActions } from "@/components/business-structure/BusinessSetup";
import { EMPTY_SETUP, registerBusiness, saveTeamMember, type SetupData } from "@/lib/business-structure";
import { ROLE_PRESETS } from "@/lib/team-permissions";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
// The real actions are server code; the screen is given fakes through its props.
vi.mock("@/services/business-structure", () => ({ saveBusinessSetupAction: vi.fn(), getTeamDirectoryAction: vi.fn() }));
vi.mock("@/services/team-management", () => ({ inviteTeamMemberAction: vi.fn() }));

afterEach(() => cleanup());

const GST = "27AAAAA0001A1Z1";
let actions: BusinessSetupActions & { save: ReturnType<typeof vi.fn>; invite: ReturnType<typeof vi.fn>; teamDirectory: ReturnType<typeof vi.fn> };

beforeEach(() => {
  actions = {
    save: vi.fn(async (s: SetupData) => ({ success: true as const, data: s })),
    teamDirectory: vi.fn(async () => ({ success: true as const, data: [{ userId: "u1", name: "Meera Shah", email: "meera@example.com", roleName: "Designer" }] })),
    invite: vi.fn(async () => ({ success: true as const, data: { token: "tok123", existingUser: false } })),
  };
});

/** Holds the saved setup the way the page does, so the screen updates after each save. */
function Harness({ initial }: { initial: SetupData }) {
  const [saved, setSaved] = useState(initial);
  return <BusinessSetup saved={saved} onSaved={setSaved} actions={actions} />;
}

function withBusiness(): SetupData {
  const r = registerBusiness(EMPTY_SETUP, { businessName: "Business 1", legalName: "", gstin: GST });
  if (!r.ok) throw new Error(r.error);
  return r.setup;
}
function withTeam(): SetupData {
  let s = withBusiness();
  for (const p of [{ name: "Asha", designation: "Director", reportsToCode: "", email: "", mobile: "" }, { name: "Ravi", designation: "Operations", reportsToCode: "M001", email: "ravi@example.com", mobile: "" }]) {
    const c = saveTeamMember(s, "B001", p);
    if (!c.ok) throw new Error(c.error);
    s = c.setup;
  }
  return s;
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("Business Setup — registering a business", () => {
  it("starts with nothing to select and a way to register the first business", () => {
    render(<Harness initial={EMPTY_SETUP} />);
    expect(screen.getByText("No business yet")).toBeTruthy();
    expect(screen.queryByRole("tablist", { name: "Setup steps" })).toBeNull();
  });

  it("registers a business: it becomes a card with its GST and is saved", async () => {
    render(<Harness initial={EMPTY_SETUP} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Register business/ })[0]);
    type("Business name", "Business 1");
    type("GSTIN", GST.toLowerCase());
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    await waitFor(() => expect(actions.save).toHaveBeenCalledTimes(1));
    const sent = actions.save.mock.calls[0][0] as SetupData;
    expect(sent.entities).toEqual([{ code: "E001", legalName: "Business 1", gstin: GST, registeredAddress: "" }]);
    expect(await screen.findByRole("button", { name: /Business 1/ })).toBeTruthy();
    expect(screen.getAllByText(`GST ${GST}`).length).toBeGreaterThan(0);
    expect(screen.getByRole("tablist", { name: "Setup steps" })).toBeTruthy();
  });

  it("a wrong GSTIN stays in the dialog with a message, and nothing is saved", async () => {
    render(<Harness initial={EMPTY_SETUP} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Register business/ })[0]);
    type("Business name", "Business 1");
    type("GSTIN", "12345");
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/15-character GSTIN/);
    expect(actions.save).not.toHaveBeenCalled();
  });

  it("shows the server's reasons when the save is refused", async () => {
    actions.save.mockResolvedValueOnce({ success: false, errors: ["Something is wrong."] });
    render(<Harness initial={EMPTY_SETUP} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Register business/ })[0]);
    type("Business name", "Business 1");
    fireEvent.click(screen.getByRole("button", { name: "Register" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Something is wrong.");
  });

  it("edits the business name and GST from the banner", async () => {
    render(<Harness initial={withBusiness()} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit business" }));
    type("Business name", "Business One");
    type("GSTIN", "29BBBBB0002B1Z2");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(actions.save).toHaveBeenCalled());
    const sent = actions.save.mock.calls[0][0] as SetupData;
    expect(sent.businesses[0].name).toBe("Business One");
    expect(sent.entities[0].gstin).toBe("29BBBBB0002B1Z2");
    // the card and the banner both show the new GST
    expect((await screen.findAllByText(/GST 29BBBBB0002B1Z2/, { selector: "small" })).length).toBe(2);
  });
});

describe("Business Setup — team members", () => {
  it("shows the cards of the selected business with designation, reporting line and no location yet", () => {
    render(<Harness initial={withTeam()} />);
    const ravi = screen.getByRole("article", { name: "Ravi" });
    expect(within(ravi).getByText("Operations")).toBeTruthy();
    expect(within(ravi).getByText("Reports to Asha")).toBeTruthy();
    expect(within(ravi).getByText("Unassigned")).toBeTruthy();
    expect(screen.getByText("2 team members")).toBeTruthy();
    expect(within(screen.getByLabelText("Live structure")).getByText("2 people in this business")).toBeTruthy();
  });

  it("searches by name or designation", () => {
    render(<Harness initial={withTeam()} />);
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "direct" } });
    expect(screen.queryByRole("article", { name: "Ravi" })).toBeNull();
    expect(screen.getByRole("article", { name: "Asha" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search members"), { target: { value: "zzz" } });
    expect(screen.getByText("No matching members.")).toBeTruthy();
  });

  it("adds a member with a designation and a manager; the card appears and the setup is saved", async () => {
    render(<Harness initial={withTeam()} />);
    fireEvent.click(screen.getByRole("button", { name: /Add member/ }));
    type("Member name", "Sana");
    type("Designation", "Accounts");
    type("Reports to", "M002");
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByRole("article", { name: "Sana" })).toBeTruthy();
    const sent = actions.save.mock.calls[0][0] as SetupData;
    expect(sent.assignments.at(-1)).toMatchObject({ memberCode: "M003", businessCode: "B001", locationCode: "", designation: "Accounts", reportsToCode: "M002" });
    expect(within(screen.getByRole("article", { name: "Sana" })).getByText("Reports to Ravi")).toBeTruthy();
  });

  it("asks for a name and a designation, and refuses a circular reporting line", async () => {
    render(<Harness initial={withTeam()} />);
    fireEvent.click(screen.getByRole("button", { name: /Add member/ }));
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Enter the member's name.");
    cleanup();
    render(<Harness initial={withTeam()} />);
    fireEvent.click(within(screen.getByRole("article", { name: "Asha" })).getByRole("button", { name: "Edit profile" }));
    type("Reports to", "M002"); // Asha → Ravi, but Ravi already reports to Asha
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Reporting cannot create a circular hierarchy.");
    expect(actions.save).not.toHaveBeenCalled();
  });

  it("edits a member and removes one from the business", async () => {
    render(<Harness initial={withTeam()} />);
    fireEvent.click(within(screen.getByRole("article", { name: "Ravi" })).getByRole("button", { name: "Edit profile" }));
    type("Designation", "Store Manager");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(within(screen.getByRole("article", { name: "Ravi" })).getByText("Store Manager")).toBeTruthy());

    fireEvent.click(within(screen.getByRole("article", { name: "Ravi" })).getByRole("button", { name: "Edit profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from this business" }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Ravi" })).toBeNull());
    expect(screen.getByText("1 team member")).toBeTruthy();
  });

  it("each business has its own team", () => {
    const b2 = registerBusiness(withTeam(), { businessName: "Business 2", legalName: "", gstin: "29BBBBB0002B1Z2" });
    if (!b2.ok) throw new Error(b2.error);
    render(<Harness initial={b2.setup} />);
    expect(screen.getByText("2 team members")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Business 2/ }));
    expect(screen.getByText("No team members yet. Add the first person to start.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Business 1/ }));
    expect(screen.getByRole("article", { name: "Asha" })).toBeTruthy();
  });
});

describe("Business Setup — logins (Team Management)", () => {
  it("lists the people who already have a login, and picking one fills the form", async () => {
    render(<Harness initial={withBusiness()} />);
    fireEvent.click(screen.getByRole("button", { name: /Add member/ }));
    const pick = (await screen.findByLabelText("Pick from Team Management (optional)")) as HTMLSelectElement;
    fireEvent.change(pick, { target: { value: "u1" } });
    expect((screen.getByLabelText("Member name") as HTMLInputElement).value).toBe("Meera Shah");
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("meera@example.com");
    expect(screen.getByText(/already has a SupplyBase login/)).toBeTruthy();
  });

  it("a member whose email has a login shows its role on the card", async () => {
    const c = saveTeamMember(withBusiness(), "B001", { name: "Meera Shah", designation: "Designer", reportsToCode: "", email: "meera@example.com", mobile: "" });
    if (!c.ok) throw new Error(c.error);
    render(<Harness initial={c.setup} />);
    expect(await screen.findByText("Login · Designer")).toBeTruthy();
  });

  it("giving a login needs an email; then it creates the invitation with the role's permissions and shows the link", async () => {
    render(<Harness initial={withBusiness()} />);
    fireEvent.click(screen.getByRole("button", { name: /Add member/ }));
    type("Member name", "Kiran");
    type("Designation", "Accounts");
    const box = screen.getByLabelText("Give this person a SupplyBase login") as HTMLInputElement;
    expect(box.disabled).toBe(true);
    type("Email", "kiran@example.com");
    expect(box.disabled).toBe(false);
    fireEvent.click(box);
    type("Role", "ACCOUNTS");
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));

    await waitFor(() => expect(actions.invite).toHaveBeenCalledTimes(1));
    expect(actions.invite).toHaveBeenCalledWith({ name: "Kiran", email: "kiran@example.com", roleKey: "ACCOUNTS", roleName: ROLE_PRESETS.ACCOUNTS.name, department: ROLE_PRESETS.ACCOUNTS.department, permissions: [...ROLE_PRESETS.ACCOUNTS.permissions] });
    // the member is saved first, then the login is made
    expect(actions.save.mock.invocationCallOrder[0]).toBeLessThan(actions.invite.mock.invocationCallOrder[0]);
    expect(await screen.findByText("Login created for Kiran")).toBeTruthy();
    expect(screen.getByText(`${window.location.origin}/reset-password?token=tok123`)).toBeTruthy();
  });

  it("if the login cannot be made the member is still saved, and the reason is shown", async () => {
    const { toast } = await import("sonner");
    actions.invite.mockResolvedValueOnce({ success: false, error: "Seat limit reached (10)." });
    render(<Harness initial={withBusiness()} />);
    fireEvent.click(screen.getByRole("button", { name: /Add member/ }));
    type("Member name", "Kiran");
    type("Designation", "Accounts");
    type("Email", "kiran@example.com");
    fireEvent.click(screen.getByLabelText("Give this person a SupplyBase login"));
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));
    expect(await screen.findByRole("article", { name: "Kiran" })).toBeTruthy();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Member saved, but the login could not be created: Seat limit reached (10)."));
    expect(screen.queryByText("Login created for Kiran")).toBeNull();
  });
});
