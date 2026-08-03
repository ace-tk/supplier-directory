"use client";

import { useState } from "react";
import { Plus, Workflow } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { AnalyticsCards } from "./AnalyticsCards";
import { SupplyChainCard } from "./SupplyChainCard";
import { CreateSupplyChainModal } from "./CreateSupplyChainModal";
import type { SupplyChainRecord, SupplyChainAnalytics } from "@/types/supply-chain";

interface SupplyChainDashboardProps {
  chains: SupplyChainRecord[];
  analytics: SupplyChainAnalytics;
  basePath: string;
}

export function SupplyChainDashboard({ chains, analytics, basePath }: SupplyChainDashboardProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div>
      <PageHeader
        title="Supply Chain"
        description="Visually manage the lifecycle of every order, from confirmation to delivery."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create Supply Chain
          </Button>
        }
      />

      <div className="mb-8">
        <AnalyticsCards analytics={analytics} />
      </div>

      {chains.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chains.map((chain, i) => (
            <SupplyChainCard key={chain.id} chain={chain} basePath={basePath} index={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed border-border text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
            <Workflow className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1.5">No supply chains yet</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create your first supply chain to start tracking an order from confirmation through delivery.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> Create Supply Chain
          </Button>
        </div>
      )}

      <CreateSupplyChainModal open={createOpen} onOpenChange={setCreateOpen} basePath={basePath} />
    </div>
  );
}
