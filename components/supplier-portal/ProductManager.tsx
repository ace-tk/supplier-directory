"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Package, ChevronDown, ChevronUp, Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { type PortalProductInput, type PortalFormState, PORTAL_CATEGORIES } from "@/types/portal";
import { ImageUploader } from "./ImageUploader";

interface ProductManagerProps {
  state: PortalFormState;
  onChange: (partial: Partial<PortalFormState>) => void;
}

function emptyProduct(): PortalProductInput {
  return { name: "", category: "", moq: "", priceRange: "", description: "", images: [] };
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-foreground">
        {label}{required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full h-9 px-3 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground resize-none",
        "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all",
        className
      )}
      {...props}
    />
  );
}

export function ProductManager({ state, onChange }: ProductManagerProps) {
  const products = state.products;
  const [expanded, setExpanded] = useState<number | null>(0);

  function update(idx: number, partial: Partial<PortalProductInput>) {
    const next = products.map((p, i) => i === idx ? { ...p, ...partial } : p);
    onChange({ products: next, isDirty: true });
  }

  function add() {
    const next = [...products, emptyProduct()];
    onChange({ products: next, isDirty: true });
    setExpanded(next.length - 1);
  }

  function remove(idx: number) {
    const next = products.filter((_, i) => i !== idx);
    onChange({ products: next, isDirty: true });
    setExpanded(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add the products you supply. Each listing will appear on your profile.
        </p>
        <motion.button
          type="button"
          onClick={add}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Product
        </motion.button>
      </div>

      {products.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-dashed border-border rounded-xl p-10 flex flex-col items-center gap-3 text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No products yet</p>
            <p className="text-xs text-muted-foreground mt-0.5">Click &ldquo;Add Product&rdquo; to get started</p>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {products.map((product, idx) => (
          <motion.div
            key={idx}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -20, height: 0 }}
            transition={{ duration: 0.2 }}
            className="border border-border rounded-xl overflow-hidden bg-card"
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setExpanded(expanded === idx ? null : idx)}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {product.name || `Product ${idx + 1}`}
                  </p>
                  {product.category && (
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(idx); }}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                {expanded === idx ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>

            {/* Expanded body */}
            <AnimatePresence>
              {expanded === idx && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-5 pt-1 border-t border-border space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Product Name" required>
                        <Input
                          placeholder="e.g. Organic Cotton T-Shirts"
                          value={product.name}
                          onChange={(e) => update(idx, { name: e.target.value })}
                        />
                      </Field>
                      <Field label="Category" required>
                        <select
                          value={product.category}
                          onChange={(e) => update(idx, { category: e.target.value })}
                          className="w-full h-9 px-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all appearance-none"
                        >
                          <option value="">Select category…</option>
                          {PORTAL_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Minimum Order Quantity">
                        <Input
                          placeholder="e.g. 500 pieces"
                          value={product.moq}
                          onChange={(e) => update(idx, { moq: e.target.value })}
                        />
                      </Field>
                      <Field label="Price Range">
                        <Input
                          placeholder="e.g. $2–$5 per piece"
                          value={product.priceRange}
                          onChange={(e) => update(idx, { priceRange: e.target.value })}
                        />
                      </Field>
                    </div>
                    <Field label="Description">
                      <Textarea
                        rows={2}
                        placeholder="Brief description of this product…"
                        value={product.description}
                        onChange={(e) => update(idx, { description: e.target.value })}
                      />
                    </Field>
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-2">Product Images</label>
                      <ImageUploader
                        images={product.images}
                        onChange={(imgs) => update(idx, { images: imgs })}
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
