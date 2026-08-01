"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/utils/format";
import { PORTAL_CONFIG, ROLE_LABELS, type PortalKey } from "@/lib/roles";
import { useAuth } from "@/hooks/use-session";
import type { SessionUser } from "@/types/auth";

interface SidebarProps {
  user?: SessionUser | null;
  portal?: PortalKey;
}

export function Sidebar({ user, portal = "admin" }: SidebarProps) {
  const pathname = usePathname();
  const { navGroups, bottomItems, label: portalLabel } = PORTAL_CONFIG[portal];
  const { logout, isLoggingOut } = useAuth();

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 h-screen bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
          <span className="text-primary-foreground font-bold text-sm">S</span>
        </div>
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
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.group}>
            <p className="px-2 mb-1.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {group.group}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-150",
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
                      <span className="relative z-10 flex-1">{item.label}</span>
                      {item.badge && (
                        <Badge
                          variant="secondary"
                          className="relative z-10 h-4 px-1.5 text-[10px] font-medium bg-primary/10 text-primary border-0"
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-0.5">
        {bottomItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-150"
          >
            <item.icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        ))}

        {/* User avatar */}
        {user && (
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
        )}

        <button
          type="button"
          onClick={logout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-2.5 px-2.5 py-2 mt-1 rounded-lg text-sm font-medium text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-all duration-150 disabled:opacity-50"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {isLoggingOut ? "Signing out…" : "Logout"}
        </button>
      </div>
    </aside>
  );
}
