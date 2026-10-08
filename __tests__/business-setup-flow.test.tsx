// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BusinessSetup, type BusinessSetupActions } from "@/components/business-structure/BusinessSetup";
import { EMPTY_SETUP, assignMembers, registerBusiness, saveLocation, saveTeamMember, type SetupData } from "@/lib/business-structure";
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


describe("Business Setup — verticals & locations", () => {
  const openStep2 = () => fireEvent.click(screen.getByRole("tab", { name: /02 · Verticals & locations/ }));

  it("shows the three verticals with the GST, and a way to add each kind of location", () => {
    render(<Harness initial={withTeam()} />);
    openStep2();
    expect(screen.getByText("Three verticals. One GST.")).toBeTruthy();
    for (const name of ["Warehouses", "Retail Stores", "Back Offices"]) expect(screen.getByRole("region", { name })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add Warehouse/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add Retail Store/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add Back Office/ })).toBeTruthy();
  });

  it("adds a warehouse with a suggested name and an address; it shows under Warehouses with the business GST", async () => {
    render(<Harness initial={withTeam()} />);
    openStep2();
    fireEvent.click(screen.getByRole("button", { name: /Add Warehouse/ }));
    expect((screen.getByLabelText("Location name") as HTMLInputElement).value).toBe("Warehouse 1");
    type("Address", "Plot 4, Bhiwandi");
    fireEvent.click(screen.getByRole("button", { name: "Add Warehouse" }));
    const card = await screen.findByRole("article", { name: "Warehouse 1" });
    expect(within(card).getByText("Plot 4, Bhiwandi")).toBeTruthy();
    expect(within(card).getByText(GST)).toBeTruthy();
    expect(within(card).getByText("No members assigned")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Warehouses" })).getByRole("article", { name: "Warehouse 1" })).toBeTruthy();
    const sent = actions.save.mock.calls[0][0] as SetupData;
    expect(sent.locations).toEqual([{ code: "L001", businessCode: "B001", type: "WAREHOUSE", name: "Warehouse 1", address: "Plot 4, Bhiwandi", mapPin: "" }]);
    // the live panel counts it, with the new Back Office name
    expect(within(screen.getByLabelText("Live structure")).getByText("Back Office")).toBeTruthy();
  });

  it("a second warehouse is suggested as Warehouse 2; a duplicate name is refused", async () => {
    let s = withTeam();
    const c = saveLocation(s, "B001", { type: "WAREHOUSE", name: "Warehouse 1", address: "" });
    if (!c.ok) throw new Error(c.error);
    s = c.setup;
    render(<Harness initial={s} />);
    openStep2();
    fireEvent.click(screen.getByRole("button", { name: /Add Warehouse/ }));
    expect((screen.getByLabelText("Location name") as HTMLInputElement).value).toBe("Warehouse 2");
    type("Location name", "warehouse 1");
    fireEvent.click(screen.getByRole("button", { name: "Add Warehouse" }));
    expect((await screen.findByRole("alert")).textContent).toBe("A location with this name already exists.");
    expect(actions.save).not.toHaveBeenCalled();
  });

  it("assigns team members to a location: the card lists them and the member card shows the location", async () => {
    const c = saveLocation(withTeam(), "B001", { type: "RETAIL_STORE", name: "Store 1", address: "" });
    if (!c.ok) throw new Error(c.error);
    render(<Harness initial={c.setup} />);
    openStep2();
    fireEvent.click(screen.getByRole("button", { name: "Assign members" }));
    fireEvent.click(screen.getByLabelText(/Ravi/));
    fireEvent.click(screen.getByRole("button", { name: "Save assignments" }));
    await waitFor(() => expect(within(screen.getByRole("article", { name: "Store 1" })).getByText("Ravi")).toBeTruthy());
    const sent = actions.save.mock.calls[0][0] as SetupData;
    expect(sent.assignments.find((a) => a.memberCode === "M002")?.locationCode).toBe("L001");
    // step 01 now shows the store on Ravi's card
    fireEvent.click(screen.getByRole("tab", { name: /01 · Team members/ }));
    expect(within(screen.getByRole("article", { name: "Ravi" })).getByText("Store 1")).toBeTruthy();
    expect(within(screen.getByLabelText("Live structure")).getByText("1 assigned to locations")).toBeTruthy();
  });

  it("the assign dialog starts with the people already there, and unticking removes them", async () => {
    const s = saveLocation(withTeam(), "B001", { type: "WAREHOUSE", name: "Warehouse 1", address: "" });
    if (!s.ok) throw new Error(s.error);
    const a = assignMembers(s.setup, "B001", "L001", ["M001", "M002"]);
    if (!a.ok) throw new Error(a.error);
    render(<Harness initial={a.setup} />);
    openStep2();
    fireEvent.click(screen.getByRole("button", { name: "Assign members" }));
    expect((screen.getByLabelText(/Asha/) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText(/Ravi/) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText(/Ravi/));
    fireEvent.click(screen.getByRole("button", { name: "Save assignments" }));
    await waitFor(() => expect(within(screen.getByRole("article", { name: "Warehouse 1" })).queryByText("Ravi")).toBeNull());
    expect(within(screen.getByRole("article", { name: "Warehouse 1" })).getByText("Asha")).toBeTruthy();
  });

  it("without a team it says so and points to step 01", () => {
    render(<Harness initial={withBusiness()} />);
    openStep2();
    fireEvent.click(screen.getByRole("button", { name: "Add team members first" }));
    expect(screen.getByText("Start with your people")).toBeTruthy();
  });

  it("edits a location (its type stays) and deletes it after confirming; the people stay on the team", async () => {
    const s = saveLocation(withTeam(), "B001", { type: "OFFICE", name: "Head office", address: "" });
    if (!s.ok) throw new Error(s.error);
    const a = assignMembers(s.setup, "B001", "L001", ["M001"]);
    if (!a.ok) throw new Error(a.error);
    render(<Harness initial={a.setup} />);
    openStep2();
    fireEvent.click(within(screen.getByRole("article", { name: "Head office" })).getByRole("button", { name: "Edit" }));
    type("Location name", "Registered office");
    type("Address", "Mumbai");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const card = await screen.findByRole("article", { name: "Registered office" });
    expect(within(screen.getByRole("region", { name: "Back Offices" })).getByRole("article", { name: "Registered office" })).toBeTruthy();
    expect(within(card).getByText("Mumbai")).toBeTruthy();

    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(within(card).getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete location" }));
    await waitFor(() => expect(screen.queryByRole("article", { name: "Registered office" })).toBeNull());
    expect(confirm).toHaveBeenCalled();
    confirm.mockRestore();
    fireEvent.click(screen.getByRole("tab", { name: /01 · Team members/ }));
    expect(within(screen.getByRole("article", { name: "Asha" })).getByText("Unassigned")).toBeTruthy();
  });

  it("only the selected business's locations are shown", () => {
    const c = saveLocation(withTeam(), "B001", { type: "WAREHOUSE", name: "Warehouse 1", address: "" });
    if (!c.ok) throw new Error(c.error);
    const b2 = registerBusiness(c.setup, { businessName: "Business 2", legalName: "", gstin: "29BBBBB0002B1Z2" });
    if (!b2.ok) throw new Error(b2.error);
    render(<Harness initial={b2.setup} />);
    openStep2();
    expect(screen.getByRole("article", { name: "Warehouse 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Business 2/ }));
    expect(screen.queryByRole("article", { name: "Warehouse 1" })).toBeNull();
  });
});

describe("Business Setup — tool access", () => {
  const openStep3 = () => fireEvent.click(screen.getByRole("tab", { name: /03 · Tool access/ }));
  const lastSaved = () => actions.save.mock.calls.at(-1)![0] as SetupData;

  it("without a team it says so and points to step 01", () => {
    render(<Harness initial={withBusiness()} />);
    openStep3();
    expect(screen.getByText("Add your team before assigning tools.", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go to team members" }));
    expect(screen.getByText("Start with your people")).toBeTruthy();
  });

  it("shows the selected member, their locations and every tool switched off", () => {
    render(<Harness initial={withTeam()} />);
    openStep3();
    expect((screen.getByLabelText("Select team member") as HTMLSelectElement).value).toBe("M001");
    expect(screen.getByText("Locations: Not assigned yet")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("0 of 22 tools on");
    expect((screen.getByLabelText("Inventory") as HTMLInputElement).checked).toBe(false);
    // Create / Edit / Approve are behind "Advanced"
    expect(screen.queryByLabelText("Inventory create")).toBeNull();
  });

  it("a switch saves at once, for the selected member only; Live structure counts them", async () => {
    render(<Harness initial={withTeam()} />);
    openStep3();
    fireEvent.change(screen.getByLabelText("Select team member"), { target: { value: "M002" } });
    fireEvent.click(screen.getByLabelText("Inventory"));
    await waitFor(() => expect((screen.getByLabelText("Inventory") as HTMLInputElement).checked).toBe(true));
    expect(lastSaved().access).toEqual([{ assignmentCode: "A002", tool: "Inventory", view: true, create: false, edit: false, approve: false }]);
    expect(screen.getByRole("status").textContent).toBe("1 of 22 tools on");
    expect(within(screen.getByLabelText("Live structure")).getByText("1 member with tool access")).toBeTruthy();
    // another person is unaffected
    fireEvent.change(screen.getByLabelText("Select team member"), { target: { value: "M001" } });
    expect((screen.getByLabelText("Inventory") as HTMLInputElement).checked).toBe(false);
    // and it can be switched off again
    fireEvent.change(screen.getByLabelText("Select team member"), { target: { value: "M002" } });
    fireEvent.click(screen.getByLabelText("Inventory"));
    await waitFor(() => expect((screen.getByLabelText("Inventory") as HTMLInputElement).checked).toBe(false));
    expect(lastSaved().access).toEqual([]);
  });

  it("Advanced shows Create, Edit and Approve; ticking one turns View on", async () => {
    render(<Harness initial={withTeam()} />);
    openStep3();
    fireEvent.click(screen.getByLabelText("Advanced: Create, Edit, Approve"));
    fireEvent.click(screen.getByLabelText("Catalog approve"));
    await waitFor(() => expect((screen.getByLabelText("Catalog") as HTMLInputElement).checked).toBe(true));
    expect((screen.getByLabelText("Catalog approve") as HTMLInputElement).checked).toBe(true);
    expect(lastSaved().access).toEqual([{ assignmentCode: "A001", tool: "Catalog", view: true, create: false, edit: false, approve: true }]);
    // switching View off clears the rest
    fireEvent.click(screen.getByLabelText("Catalog"));
    await waitFor(() => expect((screen.getByLabelText("Catalog approve") as HTMLInputElement).checked).toBe(false));
  });

  it("marks the tools that have no module yet", () => {
    render(<Harness initial={withTeam()} />);
    openStep3();
    expect(screen.getAllByText("Not built yet")).toHaveLength(3);
    for (const t of ["Retail POS", "Purchases", "Banking"]) expect(screen.getByLabelText(t)).toBeTruthy();
  });

  it("if the save is refused the switch does not move and the reason is shown", async () => {
    render(<Harness initial={withTeam()} />);
    openStep3();
    actions.save.mockResolvedValueOnce({ success: false, errors: ["Not allowed right now."] });
    fireEvent.click(screen.getByLabelText("Inventory"));
    expect((await screen.findByRole("alert")).textContent).toBe("Not allowed right now.");
    expect((screen.getByLabelText("Inventory") as HTMLInputElement).checked).toBe(false);
  });

  it("tools survive a trip to the locations step and back", async () => {
    render(<Harness initial={withTeam()} />);
    openStep3();
    fireEvent.click(screen.getByLabelText("Banking"));
    await waitFor(() => expect((screen.getByLabelText("Banking") as HTMLInputElement).checked).toBe(true));
    fireEvent.click(screen.getByRole("tab", { name: /01 · Team members/ }));
    openStep3();
    expect((screen.getByLabelText("Banking") as HTMLInputElement).checked).toBe(true);
  });
});
