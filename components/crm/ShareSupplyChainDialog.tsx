"use client";

import { useEffect, useState } from "react";
import { Workflow, X, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { listSupplyChainsForShareAction, type SupplyChainSummary } from "@/services/supply-chain";

interface ShareSupplyChainDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (chain: SupplyChainSummary) => void;
}

export function ShareSupplyChainDialog({ open, onClose, onSelect }: ShareSupplyChainDialogProps) {
  const [chains, setChains] = useState<SupplyChainSummary[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) listSupplyChainsForShareAction().then(setChains);
  }, [open]);

  const filtered = chains.filter((c) =>
    `${c.name} ${c.orderNumber}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/30"
          />
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm bg-card rounded-2xl shadow-xl border border-border overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-lav-ink" />
                <h3 className="text-sm font-bold text-foreground">Share a Supply Chain</h3>
              </div>
              <button onClick={onClose} className="p-1 text-muted-foreground hover:text-muted-foreground rounded-full hover:bg-soft">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search supply chains..."
                  className="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-lav-ink/20 text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-6">No supply chains found.</p>
              )}
              {filtered.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => onSelect(chain)}
                  className="w-full flex flex-col items-start gap-0.5 px-3 py-2 rounded-xl text-left hover:bg-lav transition-colors"
                >
                  <span className="text-sm font-semibold text-foreground">{chain.name}</span>
                  <span className="text-[11px] text-muted-foreground">{chain.orderNumber} · {chain.status.replace("_", " ")}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
