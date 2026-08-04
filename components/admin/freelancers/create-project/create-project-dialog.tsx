"use client";

import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, FileEdit, UserCheck2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { createProjectSchema, type CreateProjectFormValues } from "@/lib/validations/project";
import { createFullProjectAction } from "@/services/projects";
import { ProjectDetailsSection } from "./project-details-section";
import { TimelineSection } from "./timeline-section";
import { ReferencesSection } from "./references-section";
import { DocumentsSection } from "./documents-section";
import { ScheduleSection } from "./schedule-section";
import { SupplyChainSection } from "./supply-chain-section";
import { ItemsSection } from "./items-section";
import type { FreelancerRecord } from "@/types/freelancer";

interface CreateProjectDialogProps {
  freelancer: FreelancerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function defaultValues(): CreateProjectFormValues {
  return {
    name: "",
    clientName: "",
    city: "",
    pointOfContact: "",
    whatsapp: "",
    email: "",
    linkedinUrl: "",
    notes: "",
    timeline: [{ id: crypto.randomUUID(), title: "", description: "", date: today(), status: "NOT_STARTED" }],
    referenceLinks: [],
    referenceImages: [],
    documents: [],
    startDate: today(),
    expectedEndDate: today(),
    supplyChainId: "",
    items: [],
  };
}

const SECTIONS = [
  { value: "details", label: "1. Project Details" },
  { value: "timeline", label: "2. Timeline" },
  { value: "references", label: "3. References" },
  { value: "documents", label: "4. Document Folder" },
  { value: "schedule", label: "5. Schedule" },
  { value: "supplyChain", label: "6. Supply Chain" },
  { value: "items", label: "7. Create Items" },
];

export function CreateProjectDialog({ freelancer, open, onOpenChange, onCreated }: CreateProjectDialogProps) {
  const [submitting, setSubmitting] = useState<"draft" | "assign" | null>(null);

  const form = useForm<CreateProjectFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- zodResolver type diverges from RHF Resolver generic
    resolver: zodResolver(createProjectSchema) as any,
    defaultValues: defaultValues(),
  });

  function handleOpenChange(next: boolean) {
    if (!next) form.reset(defaultValues());
    onOpenChange(next);
  }

  async function submit(isDraft: boolean) {
    if (!freelancer) return;

    if (isDraft) {
      const valid = await form.trigger(["name", "clientName"]);
      if (!valid) {
        toast.error("Project name and client are required, even for a draft.");
        return;
      }
    } else {
      const valid = await form.trigger();
      if (!valid) {
        toast.error("Please fix the highlighted fields before assigning.");
        return;
      }
    }

    const values = form.getValues();
    setSubmitting(isDraft ? "draft" : "assign");
    const result = await createFullProjectAction({
      ...values,
      supplyChainId: values.supplyChainId || undefined,
      freelancerUserId: freelancer.id,
      isDraft,
    });
    setSubmitting(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isDraft ? "Draft saved" : `Project assigned to ${freelancer.name}`);
    onCreated();
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle>Create Project{freelancer ? ` — ${freelancer.name}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-5">
          <FormProvider {...form}>
            <form onSubmit={(e) => e.preventDefault()}>
              <Accordion defaultValue={["details"]} multiple>
                <AccordionItem value="details">
                  <AccordionTrigger>{SECTIONS[0].label}</AccordionTrigger>
                  <AccordionPanel>
                    <ProjectDetailsSection />
                  </AccordionPanel>
                </AccordionItem>

                <AccordionItem value="timeline">
                  <AccordionTrigger>{SECTIONS[1].label}</AccordionTrigger>
                  <AccordionPanel>
                    <TimelineSection />
                  </AccordionPanel>
                </AccordionItem>

                <AccordionItem value="references">
                  <AccordionTrigger>{SECTIONS[2].label}</AccordionTrigger>
                  <AccordionPanel>
                    <ReferencesSection />
                  </AccordionPanel>
                </AccordionItem>

                <AccordionItem value="documents">
                  <AccordionTrigger>{SECTIONS[3].label}</AccordionTrigger>
                  <AccordionPanel>
                    <DocumentsSection />
                  </AccordionPanel>
                </AccordionItem>

                <AccordionItem value="schedule">
                  <AccordionTrigger>{SECTIONS[4].label}</AccordionTrigger>
                  <AccordionPanel>
                    <ScheduleSection />
                  </AccordionPanel>
                </AccordionItem>

                <AccordionItem value="supplyChain">
                  <AccordionTrigger>{SECTIONS[5].label}</AccordionTrigger>
                  <AccordionPanel>
                    <SupplyChainSection />
                  </AccordionPanel>
                </AccordionItem>

                <AccordionItem value="items">
                  <AccordionTrigger>{SECTIONS[6].label}</AccordionTrigger>
                  <AccordionPanel>
                    <ItemsSection />
                  </AccordionPanel>
                </AccordionItem>
              </Accordion>
            </form>
          </FormProvider>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={!!submitting}>
            Cancel
          </Button>
          <Button variant="secondary" className="gap-1.5" onClick={() => submit(true)} disabled={!!submitting}>
            {submitting === "draft" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileEdit className="h-3.5 w-3.5" />}
            Save Draft
          </Button>
          <Button className="gap-1.5" onClick={() => submit(false)} disabled={!!submitting}>
            {submitting === "assign" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck2 className="h-3.5 w-3.5" />}
            Assign Project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
