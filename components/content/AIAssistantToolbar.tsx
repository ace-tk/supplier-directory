"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  Wand2,
  Expand,
  Shrink,
  Briefcase,
  Megaphone,
  Gem,
  Cpu,
  Languages,
  SpellCheck2,
  Feather,
  SearchCheck,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AIComparisonModal } from "@/components/content/AIComparisonModal";
import { AI_EDIT_ACTION_LABELS, type AIEditAction } from "@/lib/ai/content-edit-actions";
import { CONTENT_LANGUAGE_LABELS } from "@/lib/content-ui";
import type { ContentLanguage } from "@/types/content";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<AIEditAction, LucideIcon> = {
  REWRITE: RefreshCw,
  IMPROVE: Wand2,
  EXPAND: Expand,
  SHORTEN: Shrink,
  TONE_PROFESSIONAL: Briefcase,
  TONE_MARKETING: Megaphone,
  TONE_LUXURY: Gem,
  TONE_TECHNICAL: Cpu,
  TRANSLATE: Languages,
  FIX_GRAMMAR: SpellCheck2,
  SIMPLIFY: Feather,
  SEO_OPTIMIZE: SearchCheck,
};

const ACTION_GROUPS: { heading: string; actions: AIEditAction[] }[] = [
  { heading: "Rewrite", actions: ["REWRITE", "IMPROVE", "EXPAND", "SHORTEN"] },
  { heading: "Tone", actions: ["TONE_PROFESSIONAL", "TONE_MARKETING", "TONE_LUXURY", "TONE_TECHNICAL"] },
  { heading: "Polish", actions: ["TRANSLATE", "FIX_GRAMMAR", "SIMPLIFY", "SEO_OPTIMIZE"] },
];

const LANGUAGES = Object.keys(CONTENT_LANGUAGE_LABELS) as ContentLanguage[];

interface AIEditRequest {
  action: AIEditAction;
  targetLanguage?: ContentLanguage;
}

export function AIAssistantToolbar({
  html,
  onReplace,
  onProcessingChange,
  disabled,
}: {
  html: string;
  onReplace: (html: string) => void;
  /** Called with true while an AI request is in flight — use it to lock the editor without unmounting it. */
  onProcessingChange?: (processing: boolean) => void;
  disabled?: boolean;
}) {
  const [pendingAction, setPendingAction] = useState<AIEditAction | null>(null);
  const [comparison, setComparison] = useState<{ action: AIEditAction; currentHtml: string; aiHtml: string } | null>(null);
  const [languagePickerOpen, setLanguagePickerOpen] = useState(false);
  const inFlight = useRef(false);

  async function runAction({ action, targetLanguage }: AIEditRequest) {
    if (inFlight.current) return; // one AI request at a time — ignore duplicate/rapid clicks
    if (!html.trim()) {
      toast.error("There's no content to edit yet.");
      return;
    }

    const currentHtml = html;
    inFlight.current = true;
    setPendingAction(action);
    onProcessingChange?.(true);

    try {
      const res = await fetch("/api/content/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, html: currentHtml, targetLanguage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI editing failed. Please try again.");
      setComparison({ action, currentHtml, aiHtml: data.html });
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI editing failed. Please try again.";
      toast.error(message, { action: { label: "Retry", onClick: () => runAction({ action, targetLanguage }) } });
    } finally {
      inFlight.current = false;
      setPendingAction(null);
      onProcessingChange?.(false);
    }
  }

  function handleActionClick(action: AIEditAction) {
    if (action === "TRANSLATE") {
      setLanguagePickerOpen(true);
      return;
    }
    runAction({ action });
  }

  const busy = pendingAction !== null;

  return (
    <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">AI Assistant</p>
          <p className="text-[11px] text-muted-foreground">Edit the content in place — you&apos;ll review before anything is replaced.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
        {ACTION_GROUPS.map((group, i) => (
          <div key={group.heading} className="flex items-center gap-1.5">
            {i > 0 && <div className="w-px h-5 bg-border mx-1 shrink-0" />}
            {group.actions.map((action) => {
              const Icon = ACTION_ICONS[action];
              const isPending = pendingAction === action;

              if (action === "TRANSLATE") {
                return (
                  <Popover key={action} open={languagePickerOpen} onOpenChange={setLanguagePickerOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={disabled || busy}
                          className="gap-1.5 rounded-full bg-background/60 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                        />
                      }
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                      {AI_EDIT_ACTION_LABELS[action]}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-48 p-1.5">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => {
                            setLanguagePickerOpen(false);
                            runAction({ action: "TRANSLATE", targetLanguage: lang });
                          }}
                          className="w-full text-left rounded-lg px-2.5 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          {CONTENT_LANGUAGE_LABELS[lang]}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                );
              }

              return (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  disabled={disabled || busy}
                  onClick={() => handleActionClick(action)}
                  className={cn(
                    "gap-1.5 rounded-full bg-background/60 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors",
                    isPending && "border-primary/40 text-primary"
                  )}
                >
                  {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                  {AI_EDIT_ACTION_LABELS[action]}
                </Button>
              );
            })}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-t border-primary/20 bg-primary/5">
              <Loader2 className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
              <span className="text-xs font-medium text-primary">AI is improving your content&hellip;</span>
              <div className="ml-auto h-1 w-24 rounded-full bg-primary/10 overflow-hidden">
                <motion.div
                  className="h-full w-1/3 rounded-full bg-primary/60"
                  animate={{ x: ["-100%", "220%"] }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {comparison && (
        <AIComparisonModal
          actionLabel={AI_EDIT_ACTION_LABELS[comparison.action]}
          currentHtml={comparison.currentHtml}
          aiHtml={comparison.aiHtml}
          onKeep={() => setComparison(null)}
          onReplace={() => {
            onReplace(comparison.aiHtml);
            setComparison(null);
            toast.success("Content replaced with AI version.");
          }}
        />
      )}
    </div>
  );
}
