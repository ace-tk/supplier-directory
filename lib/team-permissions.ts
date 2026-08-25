export const PERMISSION_GROUPS = [
  { label: "Dashboard", permissions: [["dashboard.view", "View dashboard"]] },
  { label: "Project Management", permissions: [["projects.view", "View assigned projects"], ["projects.manage", "Create and manage projects"], ["tasks.manage", "Manage and assign tasks"]] },
  { label: "Supply Chain", permissions: [["supplychain.view", "View assigned supply chains"], ["supplychain.manage", "Manage supply-chain workspaces"]] },
  { label: "Content Management", permissions: [["content.view", "View content"], ["content.edit", "Create and edit content"], ["content.publish", "Publish content"]] },
  { label: "Product & Catalog", permissions: [["product.view", "View products"], ["product.manage", "Manage products"], ["catalog.view", "View catalog"], ["catalog.edit", "Edit catalog"]] },
  { label: "Mood Board", permissions: [["moodboard.view", "View mood boards"], ["moodboard.edit", "Edit and export mood boards"]] },
  { label: "CRM", permissions: [["crm.view", "View contacts and conversations"], ["crm.manage", "Message and manage CRM"]] },
  { label: "Finance", permissions: [["invoice.view", "View invoices"], ["invoice.manage", "Create and edit invoices"], ["expense.view", "View expenses"], ["expense.manage", "Manage expenses"]] },
  { label: "Inventory & Shop", permissions: [["inventory.view", "View inventory"], ["inventory.manage", "Manage inventory"], ["shop.view", "View shop"], ["shop.manage", "Manage shop"]] },
  { label: "Marketing", permissions: [["marketing.view", "View campaigns"], ["marketing.manage", "Create and manage campaigns"]] },
  { label: "Freelancers", permissions: [["freelancers.view", "View freelancers"], ["freelancers.manage", "Manage freelancers"]] },
  { label: "Team & Settings", permissions: [["team.view", "View team"], ["team.invite", "Invite members"], ["team.manage", "Manage roles and access"], ["settings.manage", "Manage workspace settings"]] },
] as const;

export type TeamPermission = (typeof PERMISSION_GROUPS)[number]["permissions"][number][0];
export const ALL_TEAM_PERMISSIONS = PERMISSION_GROUPS.flatMap((group) => group.permissions.map(([key]) => key)) as TeamPermission[];

export const ROLE_PRESETS = {
  OWNER: { name: "Owner / Admin", department: "Leadership", permissions: ALL_TEAM_PERMISSIONS },
  PROJECT_MANAGER: { name: "Project Manager", department: "Operations", permissions: ["dashboard.view", "projects.view", "projects.manage", "tasks.manage", "supplychain.view", "supplychain.manage", "content.view", "moodboard.view", "crm.view"] },
  FRONTEND_DEVELOPER: { name: "Frontend Developer", department: "Engineering", permissions: ["dashboard.view", "projects.view", "tasks.manage", "content.view", "product.view", "catalog.view"] },
  BACKEND_DEVELOPER: { name: "Backend Developer", department: "Engineering", permissions: ["dashboard.view", "projects.view", "tasks.manage", "product.view", "catalog.view"] },
  DESIGNER: { name: "Designer", department: "Design", permissions: ["dashboard.view", "projects.view", "tasks.manage", "moodboard.view", "moodboard.edit", "product.view", "catalog.view"] },
  CONTENT_MANAGER: { name: "Content Manager", department: "Content", permissions: ["dashboard.view", "projects.view", "content.view", "content.edit", "content.publish", "product.view", "catalog.view"] },
  MARKETING: { name: "Marketing", department: "Marketing", permissions: ["dashboard.view", "content.view", "content.edit", "crm.view", "marketing.view", "marketing.manage"] },
  SALES_CRM: { name: "Sales / CRM", department: "Sales", permissions: ["dashboard.view", "crm.view", "crm.manage", "invoice.view", "product.view"] },
  ACCOUNTS: { name: "Accounts / Finance", department: "Finance", permissions: ["dashboard.view", "crm.view", "invoice.view", "invoice.manage", "expense.view", "expense.manage"] },
  INVENTORY_MANAGER: { name: "Inventory Manager", department: "Operations", permissions: ["dashboard.view", "supplychain.view", "product.view", "catalog.view", "catalog.edit", "inventory.view", "inventory.manage", "shop.view"] },
  VIEWER: { name: "Viewer", department: "General", permissions: ["dashboard.view", "projects.view", "content.view", "product.view", "catalog.view", "shop.view"] },
} as const;

export type TeamRoleKey = keyof typeof ROLE_PRESETS;

export function isPermission(value: string): value is TeamPermission {
  return (ALL_TEAM_PERMISSIONS as string[]).includes(value);
}

export function cleanPermissions(values: string[]): TeamPermission[] {
  return [...new Set(values.filter(isPermission))];
}
