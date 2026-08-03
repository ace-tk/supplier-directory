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
} from "lucide-react";
import type { Role } from "@/types/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badge?: string;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  SUPPLIER: "Supplier",
  BUYER: "Buyer",
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
    group: "Commerce",
    items: [
      { label: "Supplier Directory", href: "/directory", icon: Building2 },
      { label: "Supplier Portal", href: "/supplier-portal", icon: Sparkles, badge: "New" },
      { label: "CRM Inbox", href: "/crm", icon: MessageSquare },
      { label: "Shop", href: "/shop", icon: ShoppingBag },
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
    group: "Team",
    items: [{ label: "Freelancers", href: "/freelancers", icon: Briefcase }],
  },
  {
    group: "Analytics",
    items: [{ label: "Reports", href: "/reports", icon: BarChart3 }],
  },
];

export const ADMIN_BOTTOM_ITEMS: NavItem[] = [
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Help & Support", href: "/help", icon: HelpCircle },
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
];

export const SUPPLIER_BOTTOM_ITEMS: NavItem[] = [
  { label: "Settings", href: "/supplier/settings", icon: Settings },
  { label: "Help & Support", href: "/help", icon: HelpCircle },
];

// ---------------------------------------------------------------------------
// Portal config lookup — keyed by a plain string so layouts (Server
// Components) can hand the Sidebar (a Client Component) just the key. The
// nav configs themselves carry icon *component references*, which can't be
// serialized across the server/client boundary as props — so this map is
// only ever read from inside sidebar.tsx, never passed in.
// ---------------------------------------------------------------------------
export type PortalKey = "admin" | "buyer" | "supplier";

export const PORTAL_CONFIG: Record<PortalKey, { navGroups: NavGroup[]; bottomItems: NavItem[]; label?: string }> = {
  admin: { navGroups: ADMIN_NAV_GROUPS, bottomItems: ADMIN_BOTTOM_ITEMS },
  buyer: { navGroups: BUYER_NAV_GROUPS, bottomItems: BUYER_BOTTOM_ITEMS, label: "Buyer Portal" },
  supplier: { navGroups: SUPPLIER_NAV_GROUPS, bottomItems: SUPPLIER_BOTTOM_ITEMS, label: "Supplier Portal" },
};
