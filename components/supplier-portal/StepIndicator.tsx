"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEP_LABELS } from "@/types/portal";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps?: number;
}

export function StepIndicator({ currentStep, totalSteps = 5 }: StepIndicatorProps) {
  return (
    <div className="w-full">
      {/* Mobile: compact bar */}
      <div className="flex items-center gap-1 sm:hidden mb-4">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
          <div
            key={step}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-300",
              step < currentStep
                ? "bg-primary"
                : step === currentStep
                ? "bg-primary/70"
                : "bg-border"
            )}
          />
        ))}
      </div>
      <p className="sm:hidden text-xs text-muted-foreground mb-1">
        Step {currentStep} of {totalSteps} — {STEP_LABELS[currentStep]}
      </p>

      {/* Desktop: full step list */}
      <div className="hidden sm:flex items-center gap-0">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, idx) => {
          const done = step < currentStep;
          const active = step === currentStep;
          return (
            <div key={step} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  animate={
                    active
                      ? { scale: [1, 1.1, 1], transition: { duration: 0.3 } }
                      : {}
                  }
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold border-2 transition-all duration-300",
                    done
                      ? "bg-primary border-primary text-primary-foreground"
                      : active
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-muted border-border text-muted-foreground"
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : step}
                </motion.div>
                <span
                  className={cn(
                    "text-[11px] font-medium whitespace-nowrap transition-colors",
                    active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>

              {idx < totalSteps - 1 && (
                <div className="flex-1 mx-2 mb-4">
                  <div className="h-0.5 w-full bg-border relative overflow-hidden rounded-full">
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-primary rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: done ? "100%" : "0%" }}
                      transition={{ duration: 0.4, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
