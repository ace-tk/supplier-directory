"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Save, Factory, Plus, X, FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TextCombobox } from "@/components/product/TextCombobox";
import { fileToDataUrl } from "@/lib/file-to-data-url";
import { validateDocument } from "@/lib/file-validation";
import { formatFileSize } from "@/lib/content-ui";
import { FABRIC_OPTIONS, FIT_OPTIONS, SIZE_OPTIONS } from "@/lib/catalog-ui";
import { saveDesignAction, addDesignAttachmentAction, removeDesignAttachmentAction } from "@/services/design";
import { cn } from "@/lib/utils";
import type { CatalogRowRecord } from "@/types/catalog";
import type { ProductDesignRecord, DesignSpecification, DesignAttachmentEntry } from "@/types/design";

const STEPS = [
  { key: "fabric", label: "Fabric" },
  { key: "color", label: "Color" },
  { key: "fit", label: "Fit" },
  { key: "size", label: "Size" },
  { key: "details", label: "Details" },
  { key: "review", label: "Review" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

interface PendingAttachment {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

function specFromDesign(design: ProductDesignRecord | null): DesignSpecification {
  return design?.specification ?? {};
}

/**
 * A visual product configurator, not an admin form — one step's fields at
 * a time behind a clear vertical stepper, the base product image kept
 * visible throughout (no fake AI-generated renders), and a Review step
 * that either saves the design or hands it straight to "Manufacture This
 * Design" (which pre-fills /manufacture via ?designId=).
 */
export function DesignYourOwn({
  basePath,
  row,
  initialDesign,
}: {
  basePath: string;
  row: CatalogRowRecord;
  initialDesign: ProductDesignRecord | null;
}) {
  const router = useRouter();
  const [designId, setDesignId] = useState<string | null>(initialDesign?.id ?? null);
  const [stepIndex, setStepIndex] = useState(0);
  // A loaded design already has data for every step (that's what "loaded"
  // means here), so all steps start reachable — otherwise returning to a
  // saved design would force re-clicking through 1-5 just to reach Review.
  const [maxReached, setMaxReached] = useState(initialDesign ? STEPS.length - 1 : 0);
  const [name, setName] = useState(initialDesign?.name ?? `${row.productName} — Custom Design`);
  const [spec, setSpec] = useState<DesignSpecification>(() => specFromDesign(initialDesign));
  const [notes, setNotes] = useState(initialDesign?.notes ?? "");
  const [attachments, setAttachments] = useState<DesignAttachmentEntry[]>(initialDesign?.attachments ?? []);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [saving, setSaving] = useState<"save" | "manufacture" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function patchSpec(p: Partial<DesignSpecification>) {
    setSpec((s) => ({ ...s, ...p }));
  }

  function toggleSize(size: string) {
    const sizes = spec.sizes ?? [];
    patchSpec({ sizes: sizes.includes(size) ? sizes.filter((s) => s !== size) : [...sizes, size] });
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
    const payload = { fileName: file.name, mimeType: file.type, sizeBytes: file.size, dataUrl };
    if (designId) {
      const result = await addDesignAttachmentAction(designId, payload);
      if (!result.success) return toast.error(result.error);
      setAttachments((a) => [...a, result.data]);
    } else {
      setPendingAttachments((a) => [...a, payload]);
    }
  }

  async function handleRemoveAttachment(id: string) {
    const result = await removeDesignAttachmentAction(id);
    if (!result.success) return toast.error(result.error);
    setAttachments((a) => a.filter((x) => x.id !== id));
  }

  function handleRemovePending(index: number) {
    setPendingAttachments((a) => a.filter((_, i) => i !== index));
  }

  async function saveDesign(): Promise<ProductDesignRecord | null> {
    const result = await saveDesignAction({ id: designId ?? undefined, productId: row.id, name, specification: spec, notes: notes || undefined });
    if (!result.success) {
      toast.error(result.error);
      return null;
    }
    setDesignId(result.data.id);
    // Reflect the saved design's id in the URL (?edit=<id>) — without this,
    // a reload re-requests the bare /design route with no way to know
    // which saved design to load, and the whole configuration is lost.
    router.replace(`${basePath}/${row.id}/design?edit=${result.data.id}`, { scroll: false });
    for (const pending of pendingAttachments) {
      const att = await addDesignAttachmentAction(result.data.id, pending);
      if (att.success) setAttachments((a) => [...a, att.data]);
    }
    setPendingAttachments([]);
    return result.data;
  }

  async function handleSaveDesign() {
    setSaving("save");
    const saved = await saveDesign();
    setSaving(null);
    if (saved) toast.success("Design saved");
  }

  async function handleManufactureThisDesign() {
    setSaving("manufacture");
    const saved = await saveDesign();
    setSaving(null);
    if (!saved) return;
    router.push(`${basePath}/${row.id}/manufacture?designId=${saved.id}`);
  }

  const cover = row.images[0] ?? null;
  const selectedChips: { label: string; value: string }[] = [
    spec.fabric && { label: "Fabric", value: spec.fabric },
    spec.color && { label: "Color", value: spec.color },
    spec.fit && { label: "Fit", value: spec.fit },
    spec.sizes && spec.sizes.length > 0 && { label: "Sizes", value: spec.sizes.join(", ") },
    spec.waist && { label: "Waist", value: spec.waist },
    spec.buttons && { label: "Buttons", value: spec.buttons },
    spec.pockets && { label: "Pockets", value: spec.pockets },
    spec.labels && { label: "Labels", value: spec.labels },
    spec.packaging && { label: "Packaging", value: spec.packaging },
    spec.otherDetails && { label: "Other", value: spec.otherDetails },
  ].filter((x): x is { label: string; value: string } => Boolean(x));

  const activeKey: StepKey = STEPS[stepIndex].key;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Design Your Own"
        description={row.productName}
        breadcrumbs={[{ label: "Product", href: basePath }, { label: row.productName, href: `${basePath}/${row.id}` }, { label: "Design" }]}
        actions={
          <Button variant="outline" size="sm" className="gap-1.5" render={<Link href={`${basePath}/${row.id}`} />} nativeButton={false}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Product
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start">
        {/* Live preview — the real base product image; customization choices are
            listed alongside it, never faked as a generated render. */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 lg:sticky lg:top-4">
          <div className="w-full h-[420px] rounded-xl border border-border bg-muted/40 overflow-hidden">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.dataUrl} alt={row.productName} className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">No product image yet</div>
            )}
          </div>
          {selectedChips.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-foreground">Your Customization</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedChips.map((c) => (
                  <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-foreground">
                    <span className="text-muted-foreground">{c.label}:</span> {c.value}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Stepper */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Design Your Product</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Step {stepIndex + 1} of {STEPS.length}</p>
          </div>

          <div className="space-y-1">
            {STEPS.map((step, i) => (
              <button
                key={step.key}
                type="button"
                onClick={() => goTo(i)}
                disabled={i > maxReached}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  i === stepIndex ? "bg-primary/10" : "hover:bg-muted disabled:hover:bg-transparent",
                  i > maxReached && "opacity-50 cursor-not-allowed"
                )}
              >
                <span
                  className={cn(
                    "flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold shrink-0",
                    i < maxReached ? "bg-primary text-primary-foreground" : i === stepIndex ? "border-2 border-primary text-primary" : "border border-border text-muted-foreground"
                  )}
                >
                  {i < maxReached ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className={cn("text-xs font-medium", i === stepIndex ? "text-foreground" : "text-muted-foreground")}>
                  Step {i + 1} — {step.label}
                </span>
              </button>
            ))}
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            {activeKey === "fabric" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Fabric</Label>
                <TextCombobox value={spec.fabric ?? ""} onChange={(v) => patchSpec({ fabric: v })} options={FABRIC_OPTIONS} placeholder="Select or add a fabric" addLabel="Use" />
              </div>
            )}

            {activeKey === "color" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <Input value={spec.color ?? ""} onChange={(e) => patchSpec({ color: e.target.value })} placeholder="e.g. Camel Beige" />
              </div>
            )}

            {activeKey === "fit" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Fit</Label>
                <div className="grid grid-cols-2 gap-2">
                  {FIT_OPTIONS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => patchSpec({ fit: f })}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                        spec.fit === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeKey === "size" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sizes</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SIZE_OPTIONS.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                          (spec.sizes ?? []).includes(size) ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Waist (optional)</Label>
                  <Input value={spec.waist ?? ""} onChange={(e) => patchSpec({ waist: e.target.value })} placeholder="e.g. 32 in" />
                </div>
              </div>
            )}

            {activeKey === "details" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Buttons</Label>
                    <Input value={spec.buttons ?? ""} onChange={(e) => patchSpec({ buttons: e.target.value })} placeholder="Optional" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Pockets</Label>
                    <Input value={spec.pockets ?? ""} onChange={(e) => patchSpec({ pockets: e.target.value })} placeholder="Optional" />
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
                  <Label className="text-xs">Other Details</Label>
                  <Textarea rows={2} value={spec.otherDetails ?? ""} onChange={(e) => patchSpec({ otherDetails: e.target.value })} placeholder="Optional" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Notes</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reference Files</Label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-lg border-2 border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors w-full"
                  >
                    <Plus className="h-3.5 w-3.5" /> Attach a reference file
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileAdd} />
                  {(attachments.length > 0 || pendingAttachments.length > 0) && (
                    <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                      {attachments.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 px-3 py-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-foreground truncate flex-1">{a.fileName}</span>
                          <span className="text-[10px] text-muted-foreground">{formatFileSize(a.sizeBytes)}</span>
                          <button type="button" onClick={() => handleRemoveAttachment(a.id)} className="text-muted-foreground hover:text-destructive">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {pendingAttachments.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs text-foreground truncate flex-1">{a.fileName}</span>
                          <span className="text-[10px] text-muted-foreground">Not saved yet</span>
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

            {activeKey === "review" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Design Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="rounded-lg border border-border divide-y divide-border overflow-hidden text-xs">
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Product</span>
                    <span className="font-medium text-foreground">{row.productName}</span>
                  </div>
                  {selectedChips.map((c) => (
                    <div key={c.label} className="flex items-center justify-between px-3 py-2">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-medium text-foreground text-right">{c.value}</span>
                    </div>
                  ))}
                  {notes && (
                    <div className="flex items-center justify-between px-3 py-2 gap-4">
                      <span className="text-muted-foreground shrink-0">Notes</span>
                      <span className="font-medium text-foreground text-right">{notes}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Reference Files</span>
                    <span className="font-medium text-foreground">{attachments.length + pendingAttachments.length}</span>
                  </div>
                </div>
                {selectedChips.length === 0 && (
                  <p className="text-xs text-muted-foreground">No customization selected yet — go back through the steps to choose fabric, color, fit, or size.</p>
                )}
                <div className="flex flex-col gap-2 pt-1">
                  <Button variant="outline" className="gap-1.5" disabled={saving !== null} onClick={handleSaveDesign}>
                    {saving === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save Design
                  </Button>
                  <Button className="gap-1.5" disabled={saving !== null} onClick={handleManufactureThisDesign}>
                    {saving === "manufacture" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Factory className="h-3.5 w-3.5" />} Manufacture This Design
                  </Button>
                </div>
              </div>
            )}
          </div>

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
    </div>
  );
}
