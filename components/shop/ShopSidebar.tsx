"use client";

import { useState } from "react";
import {
  Home,
  Flame,
  Clapperboard,
  Heart,
  History,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type ShopSidebarView = "explore" | "trending" | "video" | "saved" | "recent";

const NAV_ITEMS: { view: ShopSidebarView; label: string; icon: typeof Home }[] = [
  { view: "explore", label: "Explore", icon: Home },
  { view: "trending", label: "Trending", icon: Flame },
  { view: "video", label: "Video Products", icon: Clapperboard },
  { view: "saved", label: "Saved", icon: Heart },
  { view: "recent", label: "Recently Viewed", icon: History },
];

interface ShopSidebarProps {
  activeView: ShopSidebarView;
  onSelectView: (view: ShopSidebarView) => void;
  onOpenFilters: () => void;
  filtersActive: boolean;
  filterCount: number;
}

function NavButton({
  icon: Icon,
  label,
  active,
  collapsed,
  badge,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  collapsed: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full",
        collapsed && "justify-center px-0 w-11 h-11",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform", !active && "group-hover:scale-110")} />
      {!collapsed && <span className="truncate">{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full text-[10px] font-semibold",
            collapsed
              ? "absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground"
              : "ml-auto w-4 h-4 bg-primary text-primary-foreground",
            active && !collapsed && "bg-primary-foreground/20 text-primary-foreground"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function SidebarContent({
  activeView,
  onSelectView,
  onOpenFilters,
  filtersActive,
  filterCount,
  collapsed,
}: ShopSidebarProps & { collapsed: boolean }) {
  return (
    <nav className="flex flex-col gap-1 p-2">
      {NAV_ITEMS.map((item) => (
        <NavButton
          key={item.view}
          icon={item.icon}
          label={item.label}
          active={activeView === item.view}
          collapsed={collapsed}
          onClick={() => onSelectView(item.view)}
        />
      ))}
      <div className={cn("my-1 border-t border-border", collapsed ? "mx-1" : "mx-1")} />
      <NavButton
        icon={SlidersHorizontal}
        label="Filters"
        active={filtersActive}
        collapsed={collapsed}
        badge={filterCount}
        onClick={onOpenFilters}
      />
    </nav>
  );
}

export function ShopSidebar(props: ShopSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop — fixed/sticky column */}
      <aside
        className={cn(
          "hidden lg:flex sticky top-6 lg:top-8 self-start shrink-0 flex-col rounded-2xl border border-border bg-card/60 backdrop-blur-sm shadow-card transition-[width] duration-300 ease-out",
          collapsed ? "w-[64px]" : "w-[220px]"
        )}
      >
        <SidebarContent {...props} collapsed={collapsed} />
        <div className="mt-auto border-t border-border p-2">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-2 w-full rounded-xl px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              collapsed && "justify-center px-0 w-11 h-11 mx-auto"
            )}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Mobile / tablet — floating trigger + slide-out drawer */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setMobileOpen(true)}
        aria-label="Open shop navigation"
        className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-40 h-12 w-12 rounded-full shadow-elevated bg-card"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="px-4 pt-4 pb-0">
            <SheetTitle className="text-base">Browse Shop</SheetTitle>
          </SheetHeader>
          <SidebarContent
            {...props}
            collapsed={false}
            onSelectView={(view) => {
              props.onSelectView(view);
              setMobileOpen(false);
            }}
            onOpenFilters={() => {
              setMobileOpen(false);
              props.onOpenFilters();
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
