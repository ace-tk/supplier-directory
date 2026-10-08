"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun, Coffee } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "warm", label: "Warm", icon: Coffee },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

/**
 * Three-way theme switcher (Light / Warm / Dark). next-themes persists the
 * choice in localStorage, follows the system preference until the user picks,
 * and sets the class on <html> in a pre-paint inline script (no flash).
 * A short `theme-transition` class fades background/color/border for 200ms.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  // false on the server and during hydration, true afterwards (no setState-in-effect)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Before mount the real theme is unknown: render the same markup the server did.
  const active = mounted ? (theme === "system" ? resolvedTheme : theme) : undefined;

  function choose(value: string) {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    setTheme(value);
    window.setTimeout(() => root.classList.remove("theme-transition"), 250);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex items-center gap-0.5 rounded-full bg-soft p-0.5", className)}
    >
      {THEMES.map(({ value, label, icon: Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            onClick={() => choose(value)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full outline-none transition-[transform,background-color] active:scale-95 focus-visible:ring-2 focus-visible:ring-ring",
              selected
                ? "bg-surface text-pri-text shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
