"use client";

import { Search, Menu, Settings, LogOut, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SearchBar } from "@/components/shared/search-bar";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-session";
import { initials } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types/auth";

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-orange-500/20 text-orange-500",
  SUPPLIER: "bg-blue-500/20 text-blue-500",
  BUYER: "bg-emerald-500/20 text-emerald-500",
  FREELANCER: "bg-purple-500/20 text-purple-500",
};

interface TopNavbarProps {
  user?: SessionUser | null;
}

export function TopNavbar({ user }: TopNavbarProps) {
  const { logout, isLoggingOut } = useAuth();

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40">
      {/* Mobile menu trigger */}
      <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
        <Menu className="h-4 w-4" />
      </Button>

      {/* Search */}
      <div className="hidden md:flex flex-1 max-w-md">
        <SearchBar placeholder="Search suppliers, contacts, orders..." className="w-full" />
      </div>

      {/* Mobile search icon */}
      <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
        <Search className="h-4 w-4" />
      </Button>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <NotificationBell />

        <ThemeToggle />

        {/* Profile menu */}
        {user && (
          <>
            <Separator orientation="vertical" className="h-5 mx-1" />
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span />
                </button>
              }>
                <div className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold",
                  ROLE_COLORS[user.role] ?? "bg-primary/20 text-primary"
                )}>
                  {initials(user.name)}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-medium text-foreground leading-none">{user.name.split(" ")[0]}</p>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{user.role}</p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="pb-1">
                    <p className="font-medium text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground font-normal truncate">{user.email}</p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2">
                  <User className="h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                  onClick={logout}
                  disabled={isLoggingOut}
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>
    </header>
  );
}
