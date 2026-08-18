"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, ChevronLeft, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { initials } from "@/utils/format";
import { PORTAL_CONFIG, ROLE_LABELS, type PortalKey } from "@/lib/roles";
import { useAuth } from "@/hooks/use-session";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { SessionUser } from "@/types/auth";

interface SidebarProps {
  user?: SessionUser | null;
  portal?: PortalKey;
}

export function Sidebar({ user, portal = "admin" }: SidebarProps) {
  const pathname = usePathname();
  const { navGroups, bottomItems, label: portalLabel } = PORTAL_CONFIG[portal];
  const { logout, isLoggingOut } = useAuth();
  const [collapsed, setCollapsed] = useLocalStorage("sidebar-collapsed", false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-screen bg-sidebar border-r border-sidebar-border transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center gap-2.5 h-16 border-b border-sidebar-border shrink-0", collapsed ? "justify-center px-2" : "px-5")}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
          <span className="text-primary-foreground font-bold text-sm">S</span>
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <span className="block font-semibold text-sidebar-foreground tracking-tight leading-tight">
              SupplyBase
            </span>
            {portalLabel && (
              <span className="block text-[10px] text-muted-foreground leading-tight truncate">
                {portalLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn("flex-1 overflow-y-auto scrollbar-thin py-4 space-y-6", collapsed ? "px-2" : "px-3")}>
        {navGroups.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="px-2 mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                {group.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = !item.comingSoon && (pathname === item.href || pathname.startsWith(item.href + "/"));

                if (item.comingSoon) {
                  const disabledItem = (
                    <div
                      className={cn(
                        "relative flex items-center gap-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/40 cursor-not-allowed select-none",
                        collapsed ? "px-2.5 justify-center" : "px-2.5"
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="flex-1">{item.label}</span>}
                      {!collapsed && (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium border-0">
                          Soon
                        </Badge>
                      )}
                    </div>
                  );
                  return (
                    <li key={item.label}>
                      <Tooltip>
                        <TooltipTrigger render={disabledItem} />
                        <TooltipContent side="right">{item.label} — Coming soon</TooltipContent>
                      </Tooltip>
                    </li>
                  );
                }

                const link = (
                  <Link
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      collapsed ? "px-2.5 justify-center" : "px-2.5",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute inset-0 rounded-lg bg-sidebar-accent"
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                      />
                    )}
                    <item.icon
                      className={cn(
                        "relative z-10 h-4 w-4 shrink-0",
                        isActive ? "text-sidebar-primary" : "text-current"
                      )}
                    />
                    {!collapsed && <span className="relative z-10 flex-1">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <Badge
                        variant="secondary"
                        className="relative z-10 h-4 px-1.5 text-[10px] font-medium bg-primary/10 text-primary border-0"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
                return (
                  <li key={item.label}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger render={link} />
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom items */}
      <div className={cn("py-4 border-t border-sidebar-border space-y-0.5 shrink-0", collapsed ? "px-2" : "px-3")}>
        {bottomItems.map((item) => {
          if (item.comingSoon) {
            const disabled = (
              <div
                className={cn(
                  "flex items-center gap-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/40 cursor-not-allowed select-none",
                  collapsed ? "px-2.5 justify-center" : "px-2.5"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span className="flex-1">{item.label}</span>}
                {!collapsed && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium border-0">
                    Soon
                  </Badge>
                )}
              </div>
            );
            return (
              <div key={item.label}>
                <Tooltip>
                  <TooltipTrigger render={disabled} />
                  <TooltipContent side="right">{item.label} — Coming soon</TooltipContent>
                </Tooltip>
              </div>
            );
          }

          const link = (
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150",
                collapsed ? "px-2.5 justify-center" : "px-2.5"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
          return (
            <div key={item.label}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger render={link} />
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </div>
          );
        })}

        {/* User avatar */}
        {user &&
          (collapsed ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <div className="flex items-center justify-center py-2 mt-2 rounded-lg hover:bg-sidebar-accent transition-all duration-150 cursor-pointer">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                      {initials(user.name)}
                    </div>
                  </div>
                }
              />
              <TooltipContent side="right">{user.name}</TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-2.5 px-2.5 py-2 mt-2 rounded-lg hover:bg-sidebar-accent transition-all duration-150 cursor-pointer group">
              <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/20 text-primary text-xs font-semibold shrink-0">
                {initials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{user.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[user.role]}</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={logout}
                  disabled={isLoggingOut}
                  className="flex w-full items-center justify-center py-2 mt-1 rounded-lg text-sm font-medium text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-all duration-150 disabled:opacity-50"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                </button>
              }
            />
            <TooltipContent side="right">{isLoggingOut ? "Signing out…" : "Logout"}</TooltipContent>
          </Tooltip>
        ) : (
          <button
            type="button"
            onClick={logout}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2.5 px-2.5 py-2 mt-1 rounded-lg text-sm font-medium text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-all duration-150 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {isLoggingOut ? "Signing out…" : "Logout"}
          </button>
        )}

        {/* Collapse / expand toggle — deliberately small and subtle, not a
            normal nav item, per the "swipe-style" collapse spec. */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-2 py-1.5 mt-2 rounded-lg text-muted-foreground/60 hover:text-muted-foreground hover:bg-sidebar-accent/50 transition-all duration-150 text-xs",
            collapsed ? "justify-center px-2.5" : "px-2.5"
          )}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
