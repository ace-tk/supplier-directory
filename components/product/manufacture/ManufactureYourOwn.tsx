"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Send,
  CheckCircle2,
  Plus,
  X,
  FileText,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateDocument } from "@/lib/file-validation";
import { formatFileSize } from "@/lib/content-ui";
import { submitManufacturingRequestAction, addManufacturingRequestAttachmentAction } from "@/services/manufacturing";
import { SupplierMatchList } from "./SupplierMatchList";
import { cn } from "@/lib/utils";
import type { CatalogRowRecord } from "@/types/catalog";
import type { ProductDesignRecord, DesignSpecification, DesignAttachmentEntry, ManufacturingRequestRecord } from "@/types/design";

const STEPS = [
  { key: "product", label: "Product" },
  { key: "specs", label: "Materials & Specs" },
  { key: "quantity", label: "Quantity & Pricing" },
  { key: "delivery", label: "Delivery" },
  { key: "review", label: "Review" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

interface PendingAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

const CURRENCIES = ["INR", "USD", "EUR", "GBP"];

/**
 * A structured B2B sourcing workflow — deliberately not styled like Design
 * Your Own. Pre-fills from a saved ProductDesign (via ?designId=) when the
 * buyer arrived from "Manufacture This Design"; works identically when
 * opened directly from Product Detail with no design at all.
 */
export function ManufactureYourOwn({
  basePath,
  row,
  initialDesign,
}: {
  basePath: string;
  row: CatalogRowRecord;
  initialDesign: ProductDesignRecord | null;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const [spec, setSpec] = useState<DesignSpecification>(() => initialDesign?.specification ?? {});
  const [quantity, setQuantity] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [sampleRequired, setSampleRequired] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState("");
  const [requiredBy, setRequiredBy] = useState("");
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<DesignAttachmentEntry[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ManufacturingRequestRecord | null>(null);
  const [showMatches, setShowMatches] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function patchSpec(p: Partial<DesignSpecification>) {
    setSpec((s) => ({ ...s, ...p }));
  }

  function goTo(index: number) {
    if (index > maxReached) return;
    setStepIndex(index);
  }
  function next() {
    const i = Math.min(stepIndex + 1, STEPS.length - 1);
    setStepIndex(i);
    setMaxReached((m) => Math.max(m, i));
  }
  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function handleFileAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validateDocument(file.type, file.size, file.name);
    if (!v.valid) return toast.error(v.error);
    const dataUrl = await fileToDataUrl(file);
    setPendingAttachments((a) => [...a, { fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl }]);
  }
  function handleRemovePending(index: number) {
    setPendingAttachments((a) => a.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (!quantity || Number(quantity) < 1) {
      toast.error("Enter a required quantity.");
      setStepIndex(2);
      return;
    }
    setSubmitting(true);
    const result = await submitManufacturingRequestAction({
      productId: row.id,
      designId: initialDesign?.id,
      specification: spec,
      quantity: Number(quantity),
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      currency,
      sampleRequired,
      deliveryLocation: deliveryLocation || undefined,
      requiredBy: requiredBy || undefined,
      notes: notes || undefined,
    });
    if (!result.success) {
      setSubmitting(false);
      toast.error(result.error);
      return;
    }
    for (const pending of pendingAttachments) {
      const att = await addManufacturingRequestAttachmentAction(result.data.id, pending);
      if (att.success) setAttachments((a) => [...a, att.data]);
    }
    setPendingAttachments([]);
    setSubmitting(false);
    setSubmitted(result.data);
    toast.success("Manufacturing request submitted");
  }

  const activeKey: StepKey = STEPS[stepIndex].key;
  const specItems: { label: string; value: string }[] = [
    spec.fabric && { label: "Fabric / Material", value: spec.fabric },
    spec.color && { label: "Color", value: spec.color },
    spec.fit && { label: "Fit", value: spec.fit },
    spec.sizes && spec.sizes.length > 0 && { label: "Sizes", value: spec.sizes.join(", ") },
    spec.labels && { label: "Labels", value: spec.labels },
    spec.packaging && { label: "Packaging", value: spec.packaging },
    spec.otherDetails && { label: "Special Instructions", value: spec.otherDetails },
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  if (submitted) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Manufacture Your Own"
          description={row.productName}
          breadcrumbs={[{ label: "Product", href: basePath }, { label: row.productName, href: `${basePath}/${row.id}` }, { label: "Manufacture" }]}
        />
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center text-center gap-3">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-base font-semibold text-foreground">Manufacturing Request Created</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Request for {submitted.quantity} units of {row.productName} has been submitted.
          </p>
          {!showMatches && (
            <Button className="gap-1.5 mt-2" onClick={() => setShowMatches(true)}>
              <Users className="h-3.5 w-3.5" /> Find Matching Suppliers
            </Button>
          )}
        </div>

        {showMatches && (
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Matching Suppliers</h2>
            <SupplierMatchList category={row.category ?? ""} basePath={basePath} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manufacture Your Own"
        description={row.productName}
        breadcrumbs={[{ label: "Product", href: basePath }, { label: row.productName, href: `${basePath}/${row.id}` }, { label: "Manufacture" }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={`${basePath}/${row.id}`} />} nativeButton={false}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Product
          </Button>
        }
      />

      {initialDesign && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-foreground">
          Pre-filled from your saved design <span className="font-semibold">&quot;{initialDesign.name}&quot;</span>.
        </div>
      )}

      {/* Horizontal stepper — a structured sourcing process, not a
          configurator, so it reads differently from Design Your Own. */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-2">
        {STEPS.map((step, i) => (
          <button
            key={step.key}
            type="button"
            onClick={() => goTo(i)}
            disabled={i > maxReached}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              i === stepIndex ? "bg-primary text-primary-foreground" : i > maxReached ? "text-muted-foreground opacity-50 cursor-not-allowed" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-semibold",
                i === stepIndex ? "bg-primary-foreground text-primary" : i < maxReached ? "bg-primary text-primary-foreground" : "border border-current"
              )}
            >
              {i < maxReached ? <Check className="h-2.5 w-2.5" /> : i + 1}
            </span>
            {step.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        {activeKey === "product" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Product Reference</h2>
            <div className="flex items-center gap-4">
              <div className="w-24 h-24 rounded-lg border border-border bg-muted/40 overflow-hidden shrink-0">
                {row.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.images[0].dataUrl} alt={row.productName} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-foreground">{row.productName}</p>
                {row.category && <p className="text-xs text-muted-foreground">Category: {row.category}</p>}
                {row.brandName && <p className="text-xs text-muted-foreground">Brand: {row.brandName}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reference / Tech Pack Files</Label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full"
              >
                <Plus className="h-3.5 w-3.5" /> Attach a file (tech pack, PDF, drawing, spec sheet)
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAdd} />
              {pendingAttachments.length > 0 && (
                <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                  {pendingAttachments.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{a.fileName}</span>
                      <span className="text-[10px] text-muted-foreground">{formatFileSize(a.sizeBytes)}</span>
                      <button type="button" onClick={() => handleRemovePending(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeKey === "specs" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Materials & Specs</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Fabric / Material</Label>
                <Input value={spec.fabric ?? ""} onChange={(e) => patchSpec({ fabric: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <Input value={spec.color ?? ""} onChange={(e) => patchSpec({ color: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fit</Label>
                <Input value={spec.fit ?? ""} onChange={(e) => patchSpec({ fit: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sizes</Label>
                <Input
                  value={(spec.sizes ?? []).join(", ")}
                  onChange={(e) => patchSpec({ sizes: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="e.g. S, M, L"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Labels</Label>
                <Input value={spec.labels ?? ""} onChange={(e) => patchSpec({ labels: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Packaging</Label>
                <Input value={spec.packaging ?? ""} onChange={(e) => patchSpec({ packaging: e.target.value })} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Special Instructions</Label>
              <Textarea rows={2} value={spec.otherDetails ?? ""} onChange={(e) => patchSpec({ otherDetails: e.target.value })} placeholder="Optional" />
            </div>
          </div>
        )}

        {activeKey === "quantity" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quantity & Pricing</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Required Quantity</Label>
                <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 500" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Target Price / Budget</Label>
                <Input type="number" min={0} value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sample Required</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSampleRequired(true)}
                    className={cn("rounded-lg border px-3 py-2 text-xs font-medium", sampleRequired ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setSampleRequired(false)}
                    className={cn("rounded-lg border px-3 py-2 text-xs font-medium", !sampleRequired ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground")}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeKey === "delivery" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Delivery</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Delivery Location</Label>
                <Input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} placeholder="Optional" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Required By</Label>
                <Input type="date" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Additional Notes</Label>
              <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
          </div>
        )}

        {activeKey === "review" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Manufacturing Brief</h2>
            <div className="rounded-lg border border-border divide-y divide-border overflow-hidden text-xs">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Product</span>
                <span className="font-medium text-foreground">{row.productName}</span>
              </div>
              {specItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between px-3 py-2 gap-4">
                  <span className="text-muted-foreground shrink-0">{item.label}</span>
                  <span className="font-medium text-foreground text-right">{item.value}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Quantity</span>
                <span className="font-medium text-foreground">{quantity || "—"}</span>
              </div>
              {targetPrice && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">Target Price</span>
                  <span className="font-medium text-foreground">{targetPrice} {currency}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Sample Required</span>
                <span className="font-medium text-foreground">{sampleRequired ? "Yes" : "No"}</span>
              </div>
              {deliveryLocation && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">Delivery Location</span>
                  <span className="font-medium text-foreground">{deliveryLocation}</span>
                </div>
              )}
              {requiredBy && (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">Required By</span>
                  <span className="font-medium text-foreground">{requiredBy}</span>
                </div>
              )}
              {notes && (
                <div className="flex items-center justify-between px-3 py-2 gap-4">
                  <span className="text-muted-foreground shrink-0">Notes</span>
                  <span className="font-medium text-foreground text-right">{notes}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-muted-foreground">Files</span>
                <span className="font-medium text-foreground">{attachments.length + pendingAttachments.length}</span>
              </div>
            </div>
            <Button className="w-full gap-1.5" disabled={submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Request Manufacturing Quote
            </Button>
          </div>
        )}

        {activeKey !== "review" && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <Button variant="ghost" size="sm" disabled={stepIndex === 0} onClick={back}>
              Back
            </Button>
            <Button size="sm" className="gap-1.5" onClick={next}>
              Next <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
