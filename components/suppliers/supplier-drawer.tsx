"use client";

import { useState } from "react";
import {
  MapPin,
  Star,
  Globe,
  Mail,
  Phone,
  MessageCircle,
  Link2,
  BadgeCheck,
  Edit2,
  Trash2,
  Package,
  FileText,
  ExternalLink,
  History,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatLocation } from "@/lib/geo";
import { type Supplier } from "@/types/supplier";
import { DeleteDialog } from "./delete-dialog";
import { SupplierForm } from "./supplier-form";
import { CommunicationHistoryModal } from "./communication-history-modal";
import { type SupplierFormValues } from "@/lib/validations/supplier";
import Link from "next/link";

interface SupplierDrawerProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (id: string, values: SupplierFormValues) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function InfoRow({ icon: Icon, label, value, href }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted shrink-0 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-0.5">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline underline-offset-4 flex items-center gap-1"
          >
            {value}
            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
          </a>
        ) : (
          <p className="text-xs text-foreground font-medium">{value}</p>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
      {children}
    </h3>
  );
}

const ACTIVITY_ITEMS = [
  { time: "Just now", text: "Supplier profile viewed" },
  { time: "2 days ago", text: "Added to directory" },
  { time: "1 week ago", text: "Verification badge granted" },
  { time: "3 weeks ago", text: "Initial outreach sent via email" },
];

export function SupplierDrawer({
  supplier,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: SupplierDrawerProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (!supplier) return null;

  async function handleEdit(values: SupplierFormValues) {
    await onUpdate(supplier!.id, values);
    setEditOpen(false);
  }

  async function handleDelete() {
    await onDelete(supplier!.id);
    onOpenChange(false);
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full sm:max-w-[520px] p-0 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex-none border-b border-border">
            {/* Color bar */}
            <div
              className="h-1.5 w-full"
              style={{ backgroundColor: supplier.logoColor }}
            />

            <div className="p-5">
              <div className="flex items-start gap-4">
                {/* Logo */}
                <div
                  className="flex items-center justify-center w-14 h-14 rounded-xl text-white font-bold text-lg shrink-0 shadow-sm"
                  style={{ backgroundColor: supplier.logoColor }}
                >
                  {supplier.initials}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-base font-semibold text-foreground leading-snug">
                        {supplier.companyName}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {supplier.verified && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <BadgeCheck className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                        <Badge variant="secondary" className="text-[11px] h-4 px-1.5">
                          {supplier.supplierType}
                        </Badge>
                        <span
                          className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${supplier.logoColor}18`,
                            color: supplier.logoColor,
                          }}
                        >
                          {supplier.industry}
                        </span>
                      </div>
                    </div>
                    <SheetClose render={<Button variant="ghost" size="icon-sm" />}>
                      <X className="h-4 w-4" />
                    </SheetClose>
                  </div>

                  {/* Rating */}
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={cn(
                            "h-3 w-3",
                            s <= Math.floor(supplier.rating)
                              ? "fill-amber-400 text-amber-400"
                              : "fill-muted text-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-medium">{supplier.rating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">
                      ({supplier.reviewCount} reviews)
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs flex-1"
                  onClick={() => setEditOpen(true)}
                >
                  <Edit2 className="h-3 w-3" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </Button>
                <Button size="sm" className="gap-1.5 h-7 text-xs flex-1" onClick={() => setHistoryOpen(true)}>
                  <History className="h-3 w-3" />
                  History
                </Button>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-6">
              {/* Description */}
              {supplier.description && (
                <section>
                  <SectionTitle>About</SectionTitle>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {supplier.description}
                  </p>
                </section>
              )}

              {/* Products */}
              {supplier.products.length > 0 && (
                <section>
                  <SectionTitle>
                    <Package className="h-3 w-3" />
                    Products
                  </SectionTitle>
                  <div className="flex flex-wrap gap-1.5">
                    {supplier.products.map((p) => (
                      <span
                        key={p}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/60"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Location */}
              <section>
                <SectionTitle>
                  <MapPin className="h-3 w-3" />
                  Location
                </SectionTitle>
                <div className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2.5">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <p className="text-xs font-medium text-foreground">
                    {formatLocation(supplier.city, supplier.country)}
                  </p>
                </div>
              </section>

              {/* Contact */}
              <section>
                <SectionTitle>
                  <Mail className="h-3 w-3" />
                  Contact
                </SectionTitle>
                <div className="rounded-lg border border-border/60 overflow-hidden divide-y divide-border/40">
                  <InfoRow
                    icon={Mail}
                    label="Email"
                    value={supplier.email}
                    href={supplier.email ? `mailto:${supplier.email}` : undefined}
                  />
                  <InfoRow icon={Phone} label="Phone" value={supplier.phone} />
                  <InfoRow
                    icon={Globe}
                    label="Website"
                    value={supplier.website}
                    href={supplier.website ? `https://${supplier.website}` : undefined}
                  />
                  <InfoRow
                    icon={MessageCircle}
                    label="WhatsApp"
                    value={supplier.whatsapp}
                    href={
                      supplier.whatsapp
                        ? `https://wa.me/${supplier.whatsapp.replace(/\D/g, "")}`
                        : undefined
                    }
                  />
                  <InfoRow
                    icon={Link2}
                    label="LinkedIn"
                    value={supplier.linkedin}
                    href={supplier.linkedin ? `https://${supplier.linkedin}` : undefined}
                  />
                </div>
              </section>

              {/* Notes */}
              {supplier.notes && (
                <section>
                  <SectionTitle>
                    <FileText className="h-3 w-3" />
                    Internal Notes
                  </SectionTitle>
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3">
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {supplier.notes}
                    </p>
                  </div>
                </section>
              )}

              {/* Activity timeline */}
              <section>
                <SectionTitle>Recent Activity</SectionTitle>
                <div className="space-y-0">
                  {ACTIVITY_ITEMS.map((item, i) => (
                    <div key={i} className="flex gap-3 relative">
                      {i < ACTIVITY_ITEMS.length - 1 && (
                        <div className="absolute left-[11px] top-6 bottom-0 w-px bg-border/60" />
                      )}
                      <div className="w-5.5 h-5.5 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5 z-10">
                        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                      </div>
                      <div className="pb-4 flex-1">
                        <p className="text-xs text-foreground">{item.text}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          {/* Footer contact strip */}
          <div className="flex-none border-t border-border p-4 flex items-center gap-2">
            <Link
              href={"/crm?supplierId=" + supplier.id}
              className="flex flex-1 items-center justify-center gap-1.5 h-8 text-xs rounded-lg border border-border bg-background hover:bg-muted hover:text-foreground transition-colors font-medium"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-500" />
              WhatsApp
            </Link>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs">
              <Mail className="h-3.5 w-3.5 text-blue-500" />
              Email
            </Button>
            <Button variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs">
              <Phone className="h-3.5 w-3.5 text-violet-500" />
              Call
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit form */}
      <SupplierForm
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        defaultValues={supplier}
        mode="edit"
      />

      {/* Delete confirm */}
      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        companyName={supplier.companyName}
        onConfirm={handleDelete}
      />

      {/* Communication history */}
      <CommunicationHistoryModal
        supplierId={supplier.id}
        companyName={supplier.companyName}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}
