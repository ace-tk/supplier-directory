"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getContentStorageUsageAction } from "@/services/content";
import { formatFileSize } from "@/lib/content-ui";
import { cn } from "@/lib/utils";

export function TemplateCategorySidebar({
  basePath,
  categories,
  selected,
  onSelect,
}: {
  basePath: string;
  categories: { label: string; count: number }[];
  selected: string;
  onSelect: (category: string) => void;
}) {
  const [usage, setUsage] = useState<{ totalBytes: number; fileCount: number } | null>(null);

  useEffect(() => {
    getContentStorageUsageAction().then((r) => {
      if (r.success) setUsage(r.data);
    });
  }, []);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2">Categories</p>
        <button
          onClick={() => onSelect("All")}
          className={cn(
            "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors",
            selected === "All" ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/60"
          )}
        >
          All Templates
          <span className="text-xs tabular-nums text-muted-foreground">{categories.reduce((sum, c) => sum + c.count, 0)}</span>
        </button>
        {categories.map((c) => (
          <button
            key={c.label}
            onClick={() => onSelect(c.label)}
            className={cn(
              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-sm transition-colors",
              selected === c.label ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted/60"
            )}
          >
            <span className="truncate">{c.label}</span>
            <span className="text-xs tabular-nums text-muted-foreground shrink-0 ml-2">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="pt-4 border-t border-border space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2">Create Your Own Template</p>
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 justify-start"
          render={<Link href={`${basePath}/new`} />}
          nativeButton={false}
        >
          <Plus className="h-3.5 w-3.5" /> New Template
        </Button>
      </div>

      {usage && usage.fileCount > 0 && (
        <div className="pt-4 border-t border-border space-y-1.5 px-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <HardDrive className="h-3 w-3" /> Storage Used
          </p>
          <p className="text-xs text-foreground font-medium">{formatFileSize(usage.totalBytes)}</p>
          <p className="text-[11px] text-muted-foreground">
            {usage.fileCount} file{usage.fileCount === 1 ? "" : "s"} attached across your content
          </p>
        </div>
      )}
    </div>
  );
}
