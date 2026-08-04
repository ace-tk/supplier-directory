// Server-safe counterpart to EmptyState (which is "use client" for its
// framer-motion entrance animation and can't accept a raw icon *component*
// passed down from a Server Component across the RSC boundary). Use this
// version when rendering an empty state directly from a server page.

import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateStaticProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyStateStatic({ icon: Icon, title, description, className }: EmptyStateStaticProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-16 px-6", className)}>
      {Icon && (
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted mb-4">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
    </div>
  );
}
