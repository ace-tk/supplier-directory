"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Save, Sparkles,
  CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StepIndicator } from "@/components/supplier-portal/StepIndicator";
import { BusinessForm } from "@/components/supplier-portal/BusinessForm";
import { CategorySelector } from "@/components/supplier-portal/CategorySelector";
import { ProductManager } from "@/components/supplier-portal/ProductManager";
import { DocumentUploader } from "@/components/supplier-portal/DocumentUploader";
import { ProfilePreview } from "@/components/supplier-portal/ProfilePreview";
import {
  type PortalFormState,
  type PortalApiRecord,
  STEP_LABELS,
} from "@/types/portal";
import { SUPPLIER_PORTAL_DRAFT_KEY as DRAFT_KEY } from "@/lib/storage-keys";
const TOTAL_STEPS = 5;

function initialState(): PortalFormState {
  return {
    id: null,
    currentStep: 1,
    isDirty: false,
    lastSaved: null,
    companyName: "", businessType: "", industry: "", gst: "",
    country: "", state: "", city: "", website: "", linkedin: "",
    instagram: "", whatsapp: "", contactName: "", email: "", phone: "",
    description: "",
    categories: [],
    products: [],
    documents: {},
  };
}

function apiToState(record: PortalApiRecord, step: number): PortalFormState {
  const docs: PortalFormState["documents"] = {};
  for (const d of record.documents) {
    docs[d.docType] = { docType: d.docType, fileName: d.fileName, fileUrl: d.fileUrl, fileSize: d.fileSize ?? undefined };
  }
  return {
    id: record.id,
    currentStep: step,
    isDirty: false,
    lastSaved: record.updatedAt,
    companyName: record.companyName ?? "",
    businessType: record.businessType ?? "",
    industry: record.industry ?? "",
    gst: record.gst ?? "",
    country: record.country ?? "",
    state: record.state ?? "",
    city: record.city ?? "",
    website: record.website ?? "",
    linkedin: record.linkedin ?? "",
    instagram: record.instagram ?? "",
    whatsapp: record.whatsapp ?? "",
    contactName: record.contactName ?? "",
    email: record.email ?? "",
    phone: record.phone ?? "",
    description: record.description ?? "",
    categories: record.categories ?? [],
    products: record.products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      moq: p.moq ?? "",
      priceRange: p.priceRange ?? "",
      description: p.description ?? "",
      images: p.images.map((url) => ({ name: url.split("/").pop() ?? "image", url })),
      sortOrder: p.sortOrder,
    })),
    documents: docs,
  };
}

function stateToPayload(state: PortalFormState) {
  return {
    companyName: state.companyName,
    businessType: state.businessType,
    industry: state.industry,
    gst: state.gst,
    country: state.country,
    state: state.state,
    city: state.city,
    website: state.website,
    linkedin: state.linkedin,
    instagram: state.instagram,
    whatsapp: state.whatsapp,
    contactName: state.contactName,
    email: state.email,
    phone: state.phone,
    description: state.description,
    categories: state.categories,
    products: state.products.map((p, i) => ({
      name: p.name,
      category: p.category,
      moq: p.moq,
      priceRange: p.priceRange,
      description: p.description,
      images: p.images.filter((img) => !img.uploading && img.url).map((img) => img.url),
      sortOrder: i,
    })),
    documents: Object.values(state.documents).map((d) => ({
      docType: d.docType,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      fileSize: d.fileSize,
    })),
  };
}

export default function SupplierPortalPage() {
  const [form, setForm] = useState<PortalFormState>(initialState);
  const [step1Valid, setStep1Valid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [supplierCode, setSupplierCode] = useState<string | null>(null);
  const [loadingDraft, setLoadingDraft] = useState(true);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing draft on mount
  useEffect(() => {
    async function loadDraft() {
      const draftId = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
      if (!draftId) { setLoadingDraft(false); return; }
      try {
        const res = await fetch(`/api/supplier-portal/${draftId}`);
        if (!res.ok) { localStorage.removeItem(DRAFT_KEY); setLoadingDraft(false); return; }
        const record = await res.json() as PortalApiRecord;
        if (record.status === "submitted") {
          setSupplierCode(record.supplierCode);
          setSubmitted(true);
        }
        setForm(apiToState(record, record.status === "submitted" ? 5 : 1));
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      } finally {
        setLoadingDraft(false);
      }
    }
    loadDraft();
  }, []);

  const update = useCallback((partial: Partial<PortalFormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  // Auto-save 3s after changes
  useEffect(() => {
    if (!form.isDirty || !form.id) return;
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      saveDraft(false);
    }, 3000);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.isDirty, form]);

  async function saveDraft(showToast = true) {
    setSaving(true);
    try {
      const payload = stateToPayload(form);
      let record: PortalApiRecord;

      if (form.id) {
        const res = await fetch(`/api/supplier-portal/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Save failed");
        record = await res.json() as PortalApiRecord;
      } else {
        const res = await fetch("/api/supplier-portal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Save failed");
        record = await res.json() as PortalApiRecord;
        localStorage.setItem(DRAFT_KEY, record.id);
      }

      setForm((prev) => ({
        ...prev,
        id: record.id,
        isDirty: false,
        lastSaved: record.updatedAt,
      }));
      if (showToast) toast.success("Draft saved");
    } catch {
      if (showToast) toast.error("Failed to save draft");
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    await saveDraft(false);
    setForm((prev) => ({ ...prev, currentStep: Math.min(TOTAL_STEPS, prev.currentStep + 1) as PortalFormState["currentStep"] }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePrev() {
    setForm((prev) => ({ ...prev, currentStep: Math.max(1, prev.currentStep - 1) as PortalFormState["currentStep"] }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!form.id) { toast.error("Please save your draft first"); return; }
    setSubmitting(true);
    try {
      await saveDraft(false);
      const res = await fetch(`/api/supplier-portal/${form.id}/submit`, { method: "POST" });
      if (!res.ok) throw new Error("Submit failed");
      const record = await res.json() as PortalApiRecord;
      setSupplierCode(record.supplierCode);
      setSubmitted(true);
      toast.success(`Profile submitted! Your Supplier ID is ${record.supplierCode}`);
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const canGoNext = () => {
    if (form.currentStep === 1) return step1Valid;
    if (form.currentStep === 2) return form.categories.length > 0;
    return true;
  };

  if (loadingDraft) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your draft…</p>
        </div>
      </div>
    );
  }

  if (submitted && supplierCode) {
    return <SuccessScreen supplierCode={supplierCode} state={form} onViewProfile={() => setForm((p) => ({ ...p, currentStep: 5 as PortalFormState["currentStep"] }))} />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Supplier Portal</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10">
            Complete your profile to get listed on SupplyBase.
          </p>
        </div>

        <div className="flex items-center gap-2 ml-10 sm:ml-0">
          {form.lastSaved && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Saved {new Date(form.lastSaved).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={() => saveDraft(true)}
            disabled={saving || !form.isDirty}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40"
          >
            {saving ? (
              <><div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Saving…</>
            ) : (
              <><Save className="h-3.5 w-3.5" /> Save Draft</>
            )}
          </button>
        </div>
      </motion.div>

      {/* Step Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border border-border rounded-xl p-5"
      >
        <StepIndicator currentStep={form.currentStep} totalSteps={TOTAL_STEPS} />
      </motion.div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={form.currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="bg-card border border-border rounded-xl p-6"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Step {form.currentStep}: {STEP_LABELS[form.currentStep]}
            </h2>
            <div className="mt-1 h-0.5 w-12 bg-primary rounded-full" />
          </div>

          {form.currentStep === 1 && (
            <BusinessForm
              state={form}
              onChange={update}
              onValidChange={setStep1Valid}
            />
          )}
          {form.currentStep === 2 && (
            <CategorySelector
              selected={form.categories}
              onChange={(cats) => update({ categories: cats, isDirty: true })}
            />
          )}
          {form.currentStep === 3 && (
            <ProductManager state={form} onChange={update} />
          )}
          {form.currentStep === 4 && (
            <DocumentUploader state={form} onChange={update} />
          )}
          {form.currentStep === 5 && (
            <ProfilePreview state={form} supplierCode={supplierCode} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Validation hint */}
      {form.currentStep === 1 && !step1Valid && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 px-1"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Fill in all required fields to continue.
        </motion.div>
      )}
      {form.currentStep === 2 && form.categories.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 px-1"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Select at least one category to continue.
        </motion.div>
      )}

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between gap-3 pb-8"
      >
        <button
          type="button"
          onClick={handlePrev}
          disabled={form.currentStep === 1}
          className={cn(
            "inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border text-sm font-medium transition-all",
            "hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          {form.currentStep < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canGoNext() || saving}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-5 rounded-lg text-sm font-medium transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {saving ? (
                <><div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Saving…</>
              ) : (
                <>Next <ChevronRight className="h-4 w-4" /></>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || submitted}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-5 rounded-lg text-sm font-medium transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
                "disabled:opacity-40 disabled:cursor-not-allowed"
              )}
            >
              {submitting ? (
                <><div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Submitting…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Submit Profile</>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function SuccessScreen({
  supplierCode, state, onViewProfile,
}: {
  supplierCode: string;
  state: PortalFormState;
  onViewProfile: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto flex flex-col items-center text-center py-16 gap-6">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center"
      >
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <h1 className="text-2xl font-bold text-foreground mb-2">You&apos;re on SupplyBase! 🎉</h1>
        <p className="text-muted-foreground text-sm">
          {state.companyName ? `${state.companyName} has` : "Your profile has"} been submitted for review.
          Our team will verify it within 24–48 hours.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
        className="bg-card border border-border rounded-2xl px-8 py-5 w-full"
      >
        <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Your Supplier ID</p>
        <p className="text-3xl font-mono font-bold text-primary">{supplierCode}</p>
        <p className="text-xs text-muted-foreground mt-1">Share this with buyers to verify your listing</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 w-full"
      >
        <button
          type="button"
          onClick={onViewProfile}
          className="flex-1 h-9 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          View Profile Preview
        </button>
        <a
          href="/directory"
          className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center hover:bg-primary/90 transition-colors"
        >
          Explore Directory
        </a>
      </motion.div>
    </div>
  );
}
