// Business Structure — the read-only content from the prototype
// (reference-videos/supplybase-business-structure.html). Pure data: no DB,
// no network, so the page and any test share exactly the same text.

export type ModuleStatus = "built" | "partly" | "planned";

export const MODULE_GROUPS: { group: string; items: { name: string; description: string; status: ModuleStatus }[] }[] = [
  {
    group: "Overview",
    items: [
      { name: "Dashboard", description: "Business summary and shortcuts", status: "built" },
      { name: "Business setup", description: "Legal entity, businesses, locations", status: "partly" },
    ],
  },
  {
    group: "Team",
    items: [
      { name: "Team Management", description: "Invite members, roles, 33 permissions", status: "built" },
      { name: "Freelancers", description: "Freelancer profiles and work", status: "built" },
    ],
  },
  {
    group: "Projects & supply",
    items: [
      { name: "Project Management", description: "Projects with tasks inside", status: "built" },
      { name: "Supply Chain", description: "Milestones, timeline, board, calendar", status: "built" },
      { name: "Sampling", description: "Sample requests and approvals", status: "planned" },
    ],
  },
  {
    group: "Product",
    items: [
      { name: "Catalog Management", description: "Spreadsheet-style product catalog", status: "built" },
      { name: "Product", description: "Shared product records with images", status: "built" },
      { name: "Inventory", description: "By admin and by supplier", status: "built" },
    ],
  },
  {
    group: "Commerce",
    items: [
      { name: "Supplier Directory", description: "Verified suppliers", status: "built" },
      { name: "Buyer Directory", description: "Buyers and leads", status: "built" },
      { name: "Own Contacts & CRM Inbox", description: "Contacts and conversations", status: "built" },
      { name: "Shop", description: "Storefront for buyers", status: "built" },
      { name: "Retail POS", description: "Sell from a store's own stock", status: "planned" },
      { name: "Discounts & Offers", description: "Rules, coupons, rewards", status: "planned" },
      { name: "Deals", description: "Wholesale deals from brands, shown only to assigned buyers", status: "planned" },
    ],
  },
  {
    group: "Design Studio",
    items: [
      { name: "AI Garment Studio", description: "Garment, back design, repeat print, embroidery, pattern to garment", status: "built" },
      { name: "Pattern Print Studio", description: "Real-size pattern layout canvas (phase 1 of 4)", status: "partly" },
      { name: "Mood Board", description: "Visual boards for a project or client", status: "built" },
    ],
  },
  {
    group: "Marketing & content",
    items: [
      { name: "Marketing", description: "Email, WhatsApp, promotional, newsletter campaigns", status: "built" },
      { name: "Content Management", description: "Rich content and templates", status: "built" },
      { name: "Articles", description: "Published articles", status: "built" },
    ],
  },
  {
    group: "Money",
    items: [
      { name: "Invoice Management", description: "Sales, purchase, quotations, credit and debit notes", status: "built" },
      { name: "Expenses", description: "Expenses with categories and import", status: "built" },
      { name: "Reports", description: "Invoice and expense reports", status: "built" },
      { name: "Bank Statements", description: "Import and match statements", status: "planned" },
    ],
  },
];

export const MODULE_STATUS_LABEL: Record<ModuleStatus, string> = { built: "Built", partly: "Partly", planned: "Planned" };

export interface ConnectedFlow {
  title: string;
  steps: string[];
  /** Indexes of steps that are not built yet (shown in orange in the prototype). */
  notBuilt: number[];
}

export const CONNECTED_FLOWS: ConnectedFlow[] = [
  { title: "Product", steps: ["Product record", "Assign to business & location", "Inventory", "Shop & invoice lines"], notBuilt: [1] },
  { title: "Party", steps: ["Contact or CSV import", "Party profile", "Purchase or sales invoice", "Messages & notes", "History"], notBuilt: [] },
  { title: "Supply program", steps: ["Purchase order", "Raw material", "Sampling", "Manufacturing", "Quality check", "Receipt into a location"], notBuilt: [2, 5] },
  { title: "Design to product", steps: ["AI Garment Studio design", "Approve", "Attach to product record", "Shop"], notBuilt: [2] },
  { title: "Sale", steps: ["Inventory at a location", "Point of sale", "Invoice", "Stock goes down"], notBuilt: [1, 3] },
  { title: "Money", steps: ["Expense or invoice", "Payment", "Bank statement match"], notBuilt: [2] },
  { title: "Deal", steps: ["Brand sends stock sheet", "Create deal: images, voice note, terms", "Sheet analysed", "Assign buyers", "Approve", "Assigned buyers see the deal card", "Accepted or rejected"], notBuilt: [0, 1, 2, 3, 4, 5, 6] },
];

export interface PortalCard {
  name: string;
  initial: string;
  connection: string;
  description: string;
  insideStructure: boolean;
}

export const PORTALS: PortalCard[] = [
  { name: "Admin portal", initial: "A", connection: "Inside the structure", description: "The owner and invited team members.", insideStructure: true },
  { name: "Buyer portal", initial: "B", connection: "Connects to a business", description: "Wholesale buyers.", insideStructure: false },
  { name: "Supplier portal", initial: "S", connection: "Connects to a business", description: "Manufacturers and exporters.", insideStructure: false },
  { name: "Freelancer portal", initial: "F", connection: "Connects to a business", description: "Designers, photographers and other professionals.", insideStructure: false },
];

export const ROADMAP_PHASES: { label: string; title: string; points: string[]; gate?: { label: string; text: string }; current?: boolean }[] = [
  { label: "Phase 1 · today", title: "Web app", points: ["Admin, buyer, supplier and freelancer portals", "Works in any browser"], gate: { label: "Gate before phase 2", text: "Production ready: fast, secure, monitored." }, current: true },
  { label: "Phase 2", title: "Installable app", points: ["Add to the home screen", "Opens full screen, with notifications", "Same code as the website", "The smallest step"], gate: { label: "Gate before phase 3", text: "Backend ready for apps to connect to." } },
  { label: "Phase 3", title: "Mobile app", points: ["Android and iPhone", "For buyers, suppliers and the field team", "Orders, chat, approvals, camera upload", "A new build"], gate: { label: "Gate before phase 4", text: "Pattern Print Studio phases 2 to 4 complete." } },
  { label: "Phase 4", title: "Desktop app", points: ["Windows and Mac", "The design studio on large screens", "Pattern layout and AI tools", "A 163-inch canvas does not suit a phone"] },
];

export const ROADMAP_WORK: { no: number; work: string; size: string; why: string }[] = [
  { no: 1, work: "Production readiness: server next to the database, images out of the database, host the garment auto-select service", size: "Medium", why: "The live site is slow today" },
  { no: 2, work: "Legal entity and several businesses under it", size: "Large", why: "Top of the hierarchy; needs database changes" },
  { no: 3, work: "Locations linked to a business; members per business or location; permissions per business", size: "Medium", why: "Depends on step 2" },
  { no: 4, work: "Business switcher; every tool filtered by business and location", size: "Large", why: "Touches every module" },
  { no: 5, work: "Bank accounts and bank statement import", size: "Medium", why: "Completes the money flow" },
  { no: 6, work: "Sampling module, linked to Supply Chain", size: "Medium", why: "Fills the supply program gap" },
  { no: 7, work: "Retail point of sale", size: "Large", why: "Only if retail is in scope" },
  { no: 8, work: "Discounts and offers", size: "Medium", why: "Needs checkout or point of sale first" },
];
