export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  body: string;
  keywords: string[];
  popular?: boolean;
}

export interface HelpCategory {
  id: string;
  label: string;
  description: string;
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: "getting-started", label: "Getting Started", description: "The basics of navigating SupplyBase." },
  { id: "suppliers-buyers", label: "Suppliers & Buyers", description: "Directories, profiles and leads." },
  { id: "shop-catalog", label: "Shop & Catalog", description: "Products, catalogs and the storefront." },
  { id: "crm", label: "CRM", description: "Contacts, conversations and tasks." },
  { id: "projects", label: "Project Management", description: "Projects, milestones and assignments." },
  { id: "team", label: "Team Management", description: "Members, roles and workspace access." },
  { id: "invoices-expenses", label: "Invoices & Expenses", description: "Billing records and spend tracking." },
  { id: "marketing", label: "Marketing", description: "Campaigns across email and WhatsApp." },
  { id: "design-studio", label: "Design Studio", description: "AI Garment Studio and Repeat Print Maker." },
  { id: "mood-board", label: "Mood Board", description: "Visual collections for a project or client." },
  { id: "account-settings", label: "Account & Settings", description: "Workspace, security and preferences." },
];

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "getting-started-overview",
    category: "getting-started",
    title: "Finding your way around the Admin dashboard",
    body: "The left sidebar groups every module by function — Team, Product, Shop, Design Studio, Commerce, Marketing and more. Click the collapse arrow at the top of the sidebar to switch to icon-only mode on smaller screens. Your account menu, in the sidebar footer, shows your name and role.",
    keywords: ["dashboard", "sidebar", "navigation", "layout"],
    popular: false,
  },
  {
    id: "getting-started-roles",
    category: "getting-started",
    title: "Understanding roles: Admin, Team Member, Buyer, Supplier, Freelancer",
    body: "Every account has one platform role. Admins see the full Admin dashboard. Team Members are invited into an Admin's workspace with a specific set of module permissions. Buyers, Suppliers and Freelancers each have their own dedicated portal tailored to their workflow.",
    keywords: ["role", "admin", "team member", "buyer", "supplier", "freelancer", "portal"],
  },
  {
    id: "supplier-directory-add",
    category: "suppliers-buyers",
    title: "Adding a supplier",
    body: "Open Supplier Directory from the Commerce group in the sidebar, then use the add-supplier action to record a new company profile — name, location, and contact details. Once saved, the supplier appears in the directory and can be linked into supply-chain and CRM workflows.",
    keywords: ["supplier", "add", "directory", "onboard"],
    popular: true,
  },
  {
    id: "buyer-directory-overview",
    category: "suppliers-buyers",
    title: "Working with the Buyer Directory and Buyer Leads",
    body: "Buyer Directory lists buyer accounts and their activity. Buyer Leads captures inbound requirements submitted by buyers, which you can review and convert into CRM conversations or supply-chain workspaces.",
    keywords: ["buyer", "leads", "directory", "requirement"],
  },
  {
    id: "freelancers-add",
    category: "suppliers-buyers",
    title: "Adding a freelancer",
    body: "From the Freelancers page, use Add Freelancer to create their profile and account in one step — the platform generates a secure one-time activation link since no email delivery is configured yet. Share that link with the freelancer so they can set their own password and sign in.",
    keywords: ["freelancer", "add", "invite", "activation"],
    popular: true,
  },
  {
    id: "shop-catalog-overview",
    category: "shop-catalog",
    title: "Managing products and catalogs",
    body: "Add Product creates a new listing; Catalog Management groups products into shareable catalogs; the Product page is your master list. The Shop module is the buyer-facing storefront view of published products.",
    keywords: ["product", "catalog", "shop", "listing"],
  },
  {
    id: "crm-contacts",
    category: "crm",
    title: "Managing CRM contacts and conversations",
    body: "Own Contacts holds the people and companies you're building relationships with. CRM Inbox is where conversations, notes and tasks tied to those contacts live — use it to keep every buyer/supplier interaction in one thread instead of scattered emails.",
    keywords: ["crm", "contact", "conversation", "inbox", "note"],
    popular: true,
  },
  {
    id: "projects-create",
    category: "projects",
    title: "Creating a project",
    body: "Project Management lets you create a project, set a head and members, and build out a timeline of milestones. Tasks can be assigned to specific team members or freelancers, and progress is tracked per milestone.",
    keywords: ["project", "create", "milestone", "task", "assign"],
    popular: true,
  },
  {
    id: "team-invite",
    category: "team",
    title: "Inviting a team member",
    body: "Open Team Management and choose Invite Member. Pick a role preset (or a custom role) to pre-fill their permissions, then send the invite — since email delivery isn't configured, you'll get a secure one-time link to share with them directly. They set their own password when they accept.",
    keywords: ["team", "invite", "member", "role", "permission"],
    popular: true,
  },
  {
    id: "team-permissions",
    category: "team",
    title: "Managing roles and permissions",
    body: "Each team member's access is a set of module-level permissions (e.g. crm.manage, invoice.view). Role presets like Project Manager or Designer pre-fill a sensible set, and any member's permissions can be fully customized from Edit role & access. The workspace Owner's access can't be reduced or removed.",
    keywords: ["role", "permission", "access", "manage"],
    popular: true,
  },
  {
    id: "invoices-create",
    category: "invoices-expenses",
    title: "Creating an invoice",
    body: "Invoice Management lets you create an invoice against a buyer or supplier counterparty, record line items, and track payments as they come in. Expenses (under the same group) tracks your own outgoing spend, with optional custom categories.",
    keywords: ["invoice", "create", "expense", "payment"],
    popular: true,
  },
  {
    id: "marketing-campaigns",
    category: "marketing",
    title: "Running Email and WhatsApp campaigns",
    body: "Marketing includes Email Campaigns, WhatsApp Campaigns, Promotional Campaigns, Newsletter and Scheduled Campaigns, with Campaign Analytics to review performance. Note: outbound email/WhatsApp delivery is not yet connected to a live provider in this environment — campaigns are composed and scheduled, but sending is currently mocked.",
    keywords: ["marketing", "campaign", "email", "whatsapp", "newsletter"],
  },
  {
    id: "design-studio-repeat-print",
    category: "design-studio",
    title: "Using Repeat Print Maker",
    body: "Repeat Print Maker turns an uploaded motif into a seamless, tileable repeat pattern. Upload your artwork, choose a repeat style, and generate variations — the original artwork is preserved alongside each generated repeat.",
    keywords: ["repeat print", "pattern", "design", "seamless"],
    popular: true,
  },
  {
    id: "design-studio-garment",
    category: "design-studio",
    title: "Using AI Garment Studio",
    body: "AI Garment Studio generates garment visualizations from your inputs using AI image generation. Use the editor sidebar to adjust prompts and options, then generate and refine results.",
    keywords: ["garment", "ai", "design studio", "generate"],
    popular: true,
  },
  {
    id: "mood-board-overview",
    category: "mood-board",
    title: "Building a Mood Board",
    body: "Mood Board is a visual canvas for collecting reference images, colors and notes for a project or client pitch. Assets can be arranged freely and exported or shared once a board is ready.",
    keywords: ["mood board", "visual", "reference", "export"],
  },
  {
    id: "account-settings-general",
    category: "account-settings",
    title: "Updating workspace and company settings",
    body: "Settings → General covers your workspace's display name, business contact details, timezone, currency and date format. Settings → Company Profile covers legal/registration details like business type, tax ID and addresses. Changes save immediately to your workspace record.",
    keywords: ["settings", "workspace", "company", "profile", "general"],
  },
  {
    id: "account-settings-security",
    category: "account-settings",
    title: "Changing your password",
    body: "Settings → Security lets you change your password (you'll need your current password) and review your account information. Signing out from there ends your session on this device immediately.",
    keywords: ["password", "security", "sign out", "logout"],
  },
  {
    id: "account-settings-permissions-manage",
    category: "account-settings",
    title: "Managing permissions from Settings",
    body: "Settings → Roles & Permissions shows the same role presets and permission groups Team Management uses. To actually change a member's access, use the \"Manage in Team Management\" link — Settings intentionally doesn't duplicate that editor.",
    keywords: ["permission", "role", "manage", "settings"],
    popular: true,
  },
];

export function searchHelpArticles(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELP_ARTICLES;
  return HELP_ARTICLES.filter((article) =>
    article.title.toLowerCase().includes(q) ||
    article.body.toLowerCase().includes(q) ||
    article.keywords.some((keyword) => keyword.toLowerCase().includes(q))
  );
}
