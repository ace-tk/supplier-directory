"use client";

import { Eye } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Product } from "@/types/product";
import { getProductViews, formatViews, getViewsByCountry } from "@/lib/product-engagement";

export function ViewsPopover({ product }: { product: Product }) {
  const totalViews = getProductViews(product);
  const countries = getViewsByCountry(product, totalViews);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          />
        }
      >
        <Eye className="w-3 h-3" /> {formatViews(totalViews)} Views
      </PopoverTrigger>
      <PopoverContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        className="w-64 p-4 space-y-3"
      >
        <div>
          <p className="text-xs font-semibold text-foreground">Buyer Interest by Country</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatViews(totalViews)} total views
          </p>
        </div>
        <div className="space-y-2.5">
          {countries.map((c) => (
            <div key={c.code}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="flex items-center gap-1.5 text-foreground">
                  <span>{c.flag}</span> {c.country}
                </span>
                <span className="text-muted-foreground">
                  {c.views.toLocaleString()} · {c.percent}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${c.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
