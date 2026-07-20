"use client";

import { motion } from "framer-motion";
import {
  MapPin, Globe, Phone, Mail, MessageCircle, Link,
  Package, FileText, BadgeCheck, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type PortalFormState, DOCUMENT_TYPES } from "@/types/portal";

const CATEGORY_ICONS: Record<string, string> = {
  Men: "👔", Women: "👗", Kids: "🧒", Footwear: "👟", Bags: "👜",
  Accessories: "💍", Electronics: "📱", Furniture: "🛋️", Food: "🍎",
  Medical: "🏥", Industrial: "🏭", Packaging: "📦", Agriculture: "🌾",
  Beauty: "💄", Sports: "⚽",
};

interface ProfilePreviewProps {
  state: PortalFormState;
  supplierCode?: string | null;
}

export function ProfilePreview({ state, supplierCode }: ProfilePreviewProps) {
  const logo = state.documents["logo"];
  const cover = state.documents["cover"];
  const uploadedDocs = DOCUMENT_TYPES.filter((d) => d.key !== "logo" && d.key !== "cover" && !!state.documents[d.key]);

  const initials = state.companyName
    ? state.companyName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "SB";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        This is how your supplier profile will appear to buyers on SupplyBase.
      </p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border overflow-hidden bg-card shadow-sm"
      >
        {/* Cover */}
        <div className="relative h-32 bg-gradient-to-br from-primary/20 via-primary/10 to-muted">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover.fileUrl} alt="Cover" className="w-full h-full object-cover" />
          )}
          {supplierCode && (
            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs font-mono font-semibold px-2.5 py-1 rounded-full">
              {supplierCode}
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          {/* Logo + name */}
          <div className="flex items-end gap-4 -mt-8 mb-4">
            <div className="w-16 h-16 rounded-xl border-4 border-background bg-primary/10 flex items-center justify-center overflow-hidden shadow-md">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo.fileUrl} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-bold text-primary">{initials}</span>
              )}
            </div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  {state.companyName || "Your Company Name"}
                </h2>
                {state.businessType && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    {state.businessType}
                  </span>
                )}
              </div>
              {state.industry && (
                <p className="text-sm text-primary font-medium mt-0.5">{state.industry}</p>
              )}
            </div>
          </div>

          {/* Location + verified */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            {(state.city || state.country) && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {[state.city, state.country].filter(Boolean).join(", ")}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              <BadgeCheck className="h-3.5 w-3.5" />
              Verified Supplier
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              New Listing
            </span>
          </div>

          {/* Description */}
          {state.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-4 border-b border-border pb-4">
              {state.description}
            </p>
          )}

          {/* Categories */}
          {state.categories.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Categories</h4>
              <div className="flex flex-wrap gap-2">
                {state.categories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                  >
                    {CATEGORY_ICONS[cat] && <span>{CATEGORY_ICONS[cat]}</span>}
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {state.products.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Products ({state.products.length})
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {state.products.slice(0, 4).map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-xl border border-border p-3 bg-muted/30"
                  >
                    {p.images[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0].preview ?? p.images[0].url}
                        alt={p.name}
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <Package className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{p.name || "Unnamed Product"}</p>
                      {p.category && <p className="text-xs text-primary">{p.category}</p>}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {p.moq && <span className="text-[11px] text-muted-foreground">MOQ: {p.moq}</span>}
                        {p.priceRange && <span className="text-[11px] font-medium text-foreground">{p.priceRange}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {state.products.length > 4 && (
                <p className="text-xs text-muted-foreground mt-2">
                  +{state.products.length - 4} more products
                </p>
              )}
            </div>
          )}

          {/* Contact & Social */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 border-t border-border pt-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact</h4>
              <div className="space-y-1.5">
                {state.contactName && (
                  <p className="text-sm font-medium text-foreground">{state.contactName}</p>
                )}
                {state.email && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mail className="h-3 w-3" />{state.email}
                  </div>
                )}
                {state.phone && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />{state.phone}
                  </div>
                )}
                {state.whatsapp && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <MessageCircle className="h-3 w-3" />{state.whatsapp}
                  </div>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Online</h4>
              <div className="space-y-1.5">
                {state.website && (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Globe className="h-3 w-3" />{state.website}
                  </div>
                )}
                {state.linkedin && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link className="h-3 w-3" />{state.linkedin}
                  </div>
                )}
                {state.instagram && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Link className="h-3 w-3" />@{state.instagram}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Documents */}
          {uploadedDocs.length > 0 && (
            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Documents ({uploadedDocs.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {uploadedDocs.map((d) => (
                  <span
                    key={d.key}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border",
                      "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    <FileText className="h-3 w-3" />{d.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
