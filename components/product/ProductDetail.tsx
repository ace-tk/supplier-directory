"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Pencil, PenLine, Factory, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProductMediaViewer } from "./ProductMediaViewer";
import { CounterOfferDialog } from "./CounterOfferDialog";
import { formatMoney } from "@/lib/invoicing/ui";
import type { CatalogRowRecord } from "@/types/catalog";

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

/**
 * Premium fashion-commerce-style Product Detail — the entry point into
 * "Design Your Own" and "Manufacture Your Own", each its own route (not a
 * tab/modal). Operates on the exact same CatalogRowRecord Catalog
 * Management, the Product Add/Edit form, and Invoice line items all share.
 */
export function ProductDetail({ basePath, row }: { basePath: string; row: CatalogRowRecord }) {
  const router = useRouter();
  const [counterOfferOpen, setCounterOfferOpen] = useState(false);
  const [viewOfferOpen, setViewOfferOpen] = useState(false);

  const locationLabel = row.warehouseName ?? row.retailStoreName ?? null;
  const locationTypeLabel = row.locationType === "WAREHOUSE" ? "Warehouse" : row.locationType === "RETAIL_STORE" ? "Retail Store" : null;

  const infoItems: { label: string; value: string }[] = [
    row.category && { label: "Category", value: row.category },
    row.brandName && { label: "Brand", value: row.brandName },
    row.color && { label: "Color", value: row.color },
    row.sizes.length > 0 && { label: "Sizes", value: row.sizes.join(", ") },
    row.gender && { label: "Gender", value: row.gender },
    row.moq != null && { label: "MOQ", value: String(row.moq) },
    { label: "Stock", value: String(row.quantity) },
    { label: "Price", value: formatMoney(String(row.priceAfterGst), row.currency) },
    { label: "GST", value: `${row.gstPercent}%` },
    row.hsnCode && { label: "HSN Code", value: row.hsnCode },
    locationLabel && locationTypeLabel && { label: locationTypeLabel, value: locationLabel },
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  return (
    <div className="space-y-6">
      <PageHeader
        title={row.productName}
        breadcrumbs={[{ label: "Product", href: basePath }, { label: row.productName }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => router.push(basePath)}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              render={<Link href={`${basePath}/${row.id}/edit`} />}
              nativeButton={false}
            >
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        }
      />

      {/* Two prominent, separate-route actions — never tabs/modals */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href={`${basePath}/${row.id}/design`}
          className="group rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/50 hover:shadow-card transition-all"
        >
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary shrink-0">
            <PenLine className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Design Your Own</p>
            <p className="text-xs text-muted-foreground">Customize this product for your brand</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>

        <Link
          href={`${basePath}/${row.id}/manufacture`}
          className="group rounded-2xl border border-border bg-card p-5 flex items-center gap-4 hover:border-primary/50 hover:shadow-card transition-all"
        >
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary shrink-0">
            <Factory className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Manufacture Your Own</p>
            <p className="text-xs text-muted-foreground">Create a bulk production requirement</p>
          </div>
          <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="rounded-2xl border border-border bg-card p-5">
          <ProductMediaViewer productId={row.id} productName={row.productName} images={row.images} />
        </div>

        <div className="space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Product Information</h2>
            {row.description && <p className="text-sm text-muted-foreground">{row.description}</p>}
            <div className="grid grid-cols-2 gap-2">
              {infoItems.map((item) => (
                <InfoItem key={item.label} label={item.label} value={item.value} />
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setViewOfferOpen(true)}>
              <Wallet className="h-3.5 w-3.5" /> View Offer
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setCounterOfferOpen(true)}>
              Counter Offer
            </Button>
          </div>
        </div>
      </div>

      <CounterOfferDialog open={counterOfferOpen} onOpenChange={setCounterOfferOpen} productId={row.id} productName={row.productName} />

      <Dialog open={viewOfferOpen} onOpenChange={setViewOfferOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Current Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground">Price Before GST</span>
              <span className="font-medium tabular-nums">{formatMoney(String(row.priceBeforeGst), row.currency)}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground">GST</span>
              <span className="font-medium tabular-nums">{row.gstPercent}%</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-border/40">
              <span className="text-muted-foreground">Final Price</span>
              <span className="font-semibold tabular-nums">{formatMoney(String(row.priceAfterGst), row.currency)}</span>
            </div>
            {row.moq != null && (
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground">MOQ</span>
                <span className="font-medium tabular-nums">{row.moq}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-muted-foreground">Available Stock</span>
              <span className="font-medium tabular-nums">{row.quantity}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
