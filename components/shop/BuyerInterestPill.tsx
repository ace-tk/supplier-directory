"use client";

import { Globe2, TrendingUp, Flame, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Product } from "@/types/product";
import {
  getProductViews,
  formatViews,
  getTopMarkets,
  getViewsTrendPercent,
  getTrendingMarket,
  getUpdatedMinutesAgo,
} from "@/lib/product-engagement";

export function BuyerInterestPill({ product }: { product: Product }) {
  const totalViews = getProductViews(product);
  const markets = getTopMarkets(product, totalViews);
  const trendPercent = getViewsTrendPercent(product);
  const trendingMarket = getTrendingMarket(product, totalViews);
  const updatedMinutesAgo = getUpdatedMinutesAgo(product);

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        closeDelay={100}
        render={
          <button
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 hover:bg-muted hover:text-foreground transition-colors"
          />
        }
      >
        <Globe2 className="w-3 h-3 text-sky-500" />
        <span className="font-medium">{formatViews(totalViews)}</span>
        <span className="hidden sm:inline">Global Buyer Interest</span>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        className="w-72 p-4 space-y-3.5"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-sky-500/10 shrink-0">
            <Globe2 className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Global Buyer Interest</p>
            <p className="text-[11px] text-muted-foreground">Total Views</p>
          </div>
        </div>

        <p className="text-2xl font-bold text-foreground tabular-nums">{totalViews.toLocaleString()}</p>

        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2">Top Buyer Markets</p>
          <div className="space-y-2">
            {markets.map((m) => (
              <div key={m.code}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <span>{m.flag}</span> {m.country}
                  </span>
                  <span className="text-muted-foreground">{m.percent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-300"
                    style={{ width: `${m.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 text-emerald-500 font-medium">
            <TrendingUp className="w-3 h-3" /> +{trendPercent}% this week
          </span>
          <span className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" /> Trending in {trendingMarket}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> Updated {updatedMinutesAgo}m ago
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
