import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Building2,
  MessageSquare,
  ShoppingBag,
  BarChart3,
  Settings,
  HelpCircle,
  Sparkles,
  Bookmark,
  Handshake,
  Video,
  ClipboardList,
  Download,
  UserCircle,
  Package,
  PackagePlus,
  Inbox,
  Users,
  Warehouse,
  ClipboardCheck,
  Mail,
  MessageCircle,
  Megaphone,
  Newspaper,
  CalendarClock,
  PieChart,
  UserCheck,
  Factory,
  Briefcase,
  Users2,
  Workflow,
  FolderKanban,
  ListChecks,
  FileText,
  Image as ImageIcon,
  Bell,
  NotebookText,
  Table2,
  Receipt,
  BookOpen,
  UserSearch,
  Contact,
  Palette,
  Grid3x3,
  Shirt,
} from "lucide-react";
import type { Role } from "@/types/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
  /** No real page exists yet — rendered as a disabled, non-navigating item
   * instead of either a dead link or being silently omitted. */
  comingSoon?: boolean;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export function permissionForAdminHref(href: string): string | null {
  if (href === "/dashboard") return "dashboard.view";
  if (href.startsWith("/projects")) return "projects.view";
  if (href.startsWith("/supply-chain")) return "supplychain.view";
  if (href.startsWith("/freelancers")) return "freelancers.view";
  if (href.startsWith("/team")) return "team.view";
  if (href.startsWith("/content") || href.startsWith("/articles")) return "content.view";
  if (href.startsWith("/product")) return "product.view";
  if (href.startsWith("/catalog")) return "catalog.view";
  if (href.startsWith("/mood-board")) return "moodboard.view";
  if (href.startsWith("/crm") || href.startsWith("/buyer-directory") || href.startsWith("/directory")) return "crm.view";
  if (href.startsWith("/invoices/expenses")) return "expense.view";
  if (href.startsWith("/invoices")) return "invoice.view";
  if (href.startsWith("/inventory")) return "inventory.view";
  if (href.startsWith("/shop")) return "shop.view";
  if (href.startsWith("/marketing")) return "marketing.view";
  return null;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SUPPLIER: "Supplier",
  BUYER: "Buyer",
  FREELANCER: "Freelancer",
  TEAM_MEMBER: "Team Member",
};

/**
 * Where a role lands after login, and where a role gets redirected if it
 * tries to access a portal it doesn't own. Adding a new role (Sales,
 * Support, Logistics, Finance, Super Admin, ...) only needs a Prisma enum
 * value plus one entry here — no routing/guard code changes.
 */
export function roleHome(role: string): string {
  const map: Partial<Record<Role, string>> = {
    ADMIN: "/dashboard",
    BUYER: "/buyer",
    SUPPLIER: "/supplier",
    FREELANCER: "/freelancer/dashboard",
    TEAM_MEMBER: "/dashboard",
  };
  return map[role as Role] ?? "/login";
}

// ---------------------------------------------------------------------------
// Admin — unchanged from the original single shared sidebar.
// ---------------------------------------------------------------------------
export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    group: "Team",
    items: [
      { label: "Freelancers", href: "/freelancers", icon: Briefcase },
      { label: "Team Management", href: "/team", icon: Users },
    ],
  },
  {
    group: "Project Management",
    items: [{ label: "Project Management", href: "/projects", icon: FolderKanban, badge: "New" }],
  },
  {
    group: "Supply Chain",
    items: [{ label: "Supply Chain", href: "/supply-chain", icon: Workflow, badge: "New" }],
  },
  {
    group: "Product",
    items: [
      { label: "Add Product", href: "/product/new", icon: PackagePlus },
      { label: "Catalog Management", href: "/catalog", icon: Table2 },
      { label: "Product", href: "/product", icon: Package },
    ],
  },
  {
    group: "Shop",
    items: [
      { label: "Shop", href: "/shop", icon: ShoppingBag },
      { label: "Mood Board", href: "/mood-board", icon: Palette },
    ],
  },
  {
    group: "Design Studio",
    items: [
      { label: "Repeat Print Maker", href: "/design-studio/repeat-print", icon: Grid3x3 },
      { label: "AI Garment Studio", href: "/design-studio/garment", icon: Shirt },
    ],
  },
  {
    group: "Commerce",
    items: [
      { label: "Supplier Directory", href: "/directory", icon: Building2 },
      { label: "Buyer Directory", href: "/buyer-directory", icon: UserSearch },
      { label: "Own Contacts", href: "/crm", icon: Contact },
      { label: "CRM Inbox", href: "/crm", icon: MessageSquare },
      { label: "Supplier Portal", href: "/supplier-portal", icon: Sparkles, badge: "New" },
      { label: "Buyer Leads", href: "/buyer-leads", icon: Users2 },
    ],
  },
  {
    group: "Inventory",
    items: [
      { label: "Inventory by Admin", href: "/inventory/admin", icon: Warehouse },
      { label: "Inventory by Supplier", href: "/inventory/supplier", icon: ClipboardCheck },
    ],
  },
  {
    group: "Marketing",
    items: [
      { label: "Email Campaigns", href: "/marketing/email-campaigns", icon: Mail },
      { label: "WhatsApp Campaigns", href: "/marketing/whatsapp-campaigns", icon: MessageCircle },
      { label: "Promotional Campaigns", href: "/marketing/promotional-campaigns", icon: Megaphone },
      { label: "Newsletter", href: "/marketing/newsletter", icon: Newspaper },
      { label: "Scheduled Campaigns", href: "/marketing/scheduled-campaigns", icon: CalendarClock },
      { label: "Campaign Analytics", href: "/marketing/analytics", icon: PieChart },
      { label: "Buyer Campaigns", href: "/marketing/buyer-campaigns", icon: UserCheck },
      { label: "Supplier Campaigns", href: "/marketing/supplier-campaigns", icon: Factory },
    ],
  },
  {
    group: "Resources",
    items: [
      { label: "Content Management", href: "/content", icon: NotebookText },
      { label: "Articles", href: "/articles", icon: BookOpen },
    ],
  },
  {
    group: "Commercials Management",
    items: [
      { label: "Invoice Management", href: "/invoices", icon: Receipt },
      { label: "Expenses", href: "/invoices/expenses", icon: Receipt },
    ],
  },
  {
    group: "Analytics",
    items: [{ label: "Reports", href: "/invoices/reports", icon: BarChart3 }],
  },
];

export const ADMIN_BOTTOM_ITEMS: NavItem[] = [
  { label: "Settings", href: "#", icon: Settings, comingSoon: true },
  { label: "Help & Support", href: "#", icon: HelpCircle, comingSoon: true },
];

// ---------------------------------------------------------------------------
// Buyer Portal
// ---------------------------------------------------------------------------
export const BUYER_NAV_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard", href: "/buyer", icon: LayoutDashboard },
      { label: "Supply Chain", href: "/buyer/supply-chain", icon: Workflow, badge: "New" },
    ],
  },
  {
    group: "Discover",
    items: [
      { label: "Browse Suppliers", href: "/buyer/suppliers", icon: Building2 },
      { label: "Shop", href: "/buyer/shop", icon: ShoppingBag },
      { label: "Mood Board", href: "/buyer/mood-board", icon: Palette },
    ],
  },
  {
    group: "My Activity",
    items: [
      { label: "Saved Suppliers", href: "/buyer/saved", icon: Bookmark },
      { label: "Counter Offers", href: "/buyer/counter-offers", icon: Handshake },
      { label: "Video Requests", href: "/buyer/video-requests", icon: Video },
      { label: "Messages", href: "/buyer/messages", icon: MessageSquare },
      { label: "Orders", href: "/buyer/orders", icon: ClipboardList },
      { label: "Downloads", href: "/buyer/downloads", icon: Download },
    ],
  },
  {
    group: "Workspace",
    items: [
      { label: "Content Management", href: "/buyer/content", icon: NotebookText },
      { label: "Catalog Management", href: "/buyer/catalog", icon: Table2 },
      { label: "Product", href: "/buyer/product", icon: Package },
      { label: "Invoice Management", href: "/buyer/invoices", icon: Receipt },
      { label: "Articles", href: "/buyer/articles", icon: BookOpen },
    ],
  },
];

export const BUYER_BOTTOM_ITEMS: NavItem[] = [
  { label: "Settings", href: "/buyer/settings", icon: Settings },
  { label: "Help & Support", href: "/help", icon: HelpCircle },
];

// ---------------------------------------------------------------------------
// Supplier Portal
// ---------------------------------------------------------------------------
export const SUPPLIER_NAV_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    items: [
      { label: "Dashboard", href: "/supplier", icon: LayoutDashboard },
      { label: "Supply Chain", href: "/supplier/supply-chain", icon: Workflow, badge: "New" },
    ],
  },
  {
    group: "Business",
    items: [
      { label: "Company Profile", href: "/supplier/profile", icon: UserCircle },
      { label: "Products", href: "/supplier/products", icon: Package },
      { label: "Add Product", href: "/supplier/products/add", icon: PackagePlus },
    ],
  },
  {
    group: "Sales",
    items: [
      { label: "Orders", href: "/supplier/orders", icon: ClipboardList },
      { label: "Buyer Enquiries", href: "/supplier/enquiries", icon: Inbox },
      { label: "Video Requests", href: "/supplier/video-requests", icon: Video },
      { label: "Counter Offers", href: "/supplier/counter-offers", icon: Handshake },
      { label: "Analytics", href: "/supplier/analytics", icon: BarChart3 },
    ],
  },
  {
    group: "Team",
    items: [
      { label: "Messages", href: "/supplier/messages", icon: MessageSquare },
      { label: "Team Members", href: "/supplier/team", icon: Users },
    ],
  },
  {
    group: "Workspace",
    items: [
      { label: "Content Management", href: "/supplier/content", icon: NotebookText },
      { label: "Catalog Management", href: "/supplier/catalog", icon: Table2 },
      { label: "Product", href: "/supplier/product", icon: Package },
      { label: "Invoice Management", href: "/supplier/invoices", icon: Receipt },
      { label: "Articles", href: "/supplier/articles", icon: BookOpen },
    ],
  },
];

export const SUPPLIER_BOTTOM_ITEMS: NavItem[] = [
  { label: "Settings", href: "/supplier/settings", icon: Settings },
  { label: "Help & Support", href: "/help", icon: HelpCircle },
];

// ---------------------------------------------------------------------------
// Freelancer Portal
// ---------------------------------------------------------------------------
export const FREELANCER_NAV_GROUPS: NavGroup[] = [
  {
    group: "Overview",
    items: [{ label: "Dashboard", href: "/freelancer/dashboard", icon: LayoutDashboard }],
  },
  {
    group: "Work",
    items: [
      { label: "Projects", href: "/freelancer/projects", icon: FolderKanban },
      { label: "Tasks", href: "/freelancer/tasks", icon: ListChecks },
      { label: "Proposals", href: "/freelancer/proposals", icon: FileText },
    ],
  },
  {
    group: "Profile",
    items: [
      { label: "My Portfolio", href: "/freelancer/portfolio", icon: ImageIcon },
      { label: "Messages", href: "/freelancer/messages", icon: MessageSquare },
      { label: "Notifications", href: "/freelancer/notifications", icon: Bell },
      { label: "Profile", href: "/freelancer/profile", icon: UserCircle },
    ],
  },
  {
    group: "Workspace",
    items: [
      { label: "Content Management", href: "/freelancer/content", icon: NotebookText },
      { label: "Catalog Management", href: "/freelancer/catalog", icon: Table2 },
      { label: "Product", href: "/freelancer/product", icon: Package },
      { label: "Invoice Management", href: "/freelancer/invoices", icon: Receipt },
      { label: "Articles", href: "/freelancer/articles", icon: BookOpen },
    ],
  },
];

export const FREELANCER_BOTTOM_ITEMS: NavItem[] = [
  { label: "Settings", href: "/freelancer/settings", icon: Settings },
  { label: "Help & Support", href: "/help", icon: HelpCircle },
];

// ---------------------------------------------------------------------------
// Portal config lookup — keyed by a plain string so layouts (Server
// Components) can hand the Sidebar (a Client Component) just the key. The
// nav configs themselves carry icon *component references*, which can't be
// serialized across the server/client boundary as props — so this map is
// only ever read from inside sidebar.tsx, never passed in.
// ---------------------------------------------------------------------------
export type PortalKey = "admin" | "buyer" | "supplier" | "freelancer";

export const PORTAL_CONFIG: Record<PortalKey, { navGroups: NavGroup[]; bottomItems: NavItem[]; label?: string }> = {
  admin: { navGroups: ADMIN_NAV_GROUPS, bottomItems: ADMIN_BOTTOM_ITEMS },
  buyer: { navGroups: BUYER_NAV_GROUPS, bottomItems: BUYER_BOTTOM_ITEMS, label: "Buyer Portal" },
  supplier: { navGroups: SUPPLIER_NAV_GROUPS, bottomItems: SUPPLIER_BOTTOM_ITEMS, label: "Supplier Portal" },
  freelancer: { navGroups: FREELANCER_NAV_GROUPS, bottomItems: FREELANCER_BOTTOM_ITEMS, label: "Freelancer Portal" },
};
