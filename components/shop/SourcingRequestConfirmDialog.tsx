"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { getBuyerContactDetails, submitBuyerRequirement } from "@/services/buyer-leads";
import { detectCategory, detectQuantity, detectBudget } from "@/lib/requirement-parser";

interface SourcingRequestConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requirement: string;
  onSubmitted: () => void;
}

export function SourcingRequestConfirmDialog({
  open,
  onOpenChange,
  requirement,
  onSubmitted,
}: SourcingRequestConfirmDialogProps) {
  const session = useSession();
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      getBuyerContactDetails().then((details) => {
        if (details?.company) setCompany(details.company);
      });
    }
  }, [open]);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setTimeout(() => {
        setSubmitted(false);
        setPhone("");
      }, 200);
    }
  }

  async function handleSubmit() {
    if (!company.trim() || !phone.trim()) {
      toast.error("Company and phone are required.");
      return;
    }
    setSubmitting(true);
    const result = await submitBuyerRequirement({
      company: company.trim(),
      phone: phone.trim(),
      requirement: requirement.trim(),
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSubmitted(true);
    onSubmitted();
  }

  const category = detectCategory(requirement);
  const quantity = detectQuantity(requirement);
  const budget = detectBudget(requirement);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {submitted ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Request received</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your sourcing request has been received. Our team will verify your requirement and connect you with
                suitable suppliers.
              </p>
            </div>
            <Button onClick={() => handleOpenChange(false)} className="mt-2">
              Done
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm your sourcing request</DialogTitle>
              <DialogDescription>We&apos;ll route this to our sourcing team once submitted.</DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-muted/40 border border-border/40 p-3 text-sm text-foreground">
              {requirement}
              {(category || quantity || budget) && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {category && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{category}</span>
                  )}
                  {quantity && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{quantity}</span>
                  )}
                  {budget && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{budget}</span>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Name</p>
                <p className="font-medium text-foreground truncate">{session?.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium text-foreground truncate">{session?.email}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="sr-company" className="text-xs">
                  Company
                </Label>
                <Input
                  id="sr-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Your company name"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sr-phone" className="text-xs">
                  Phone
                </Label>
                <Input
                  id="sr-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            <Button onClick={handleSubmit} className="w-full gap-2" disabled={submitting}>
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send Request
                </>
              )}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
