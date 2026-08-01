"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Mic, Square, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { SourcingRequestConfirmDialog } from "./SourcingRequestConfirmDialog";
import { cn } from "@/lib/utils";
import { SOURCING_REQUEST_DRAFT_KEY as DRAFT_KEY } from "@/lib/storage-keys";

const EXAMPLES = [
  "I need 100 sneakers under ₹4,000.",
  "I need 500 cotton hoodies.",
  "I need kids wear manufacturers from Tiruppur.",
  "I need leather handbags for export.",
];

export function SourcingRequestBar() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(DRAFT_KEY) ?? "";
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(DRAFT_KEY)) return;
    localStorage.removeItem(DRAFT_KEY);
    if (session) {
      toast.info("Welcome back — continue your sourcing request below.");
      textareaRef.current?.focus();
    }
  }, [session]);

  const { isListening, isSupported, start, stop } = useSpeechRecognition({
    onResult: (transcript) => setText((prev) => (prev ? `${prev} ${transcript}` : transcript)),
  });

  function handleSend() {
    if (!text.trim()) {
      toast.error("Describe what you're looking for first.");
      return;
    }
    if (!session) {
      localStorage.setItem(DRAFT_KEY, text.trim());
      router.push(`/login?from=${encodeURIComponent(pathname)}`);
      return;
    }
    if (session.role !== "BUYER") {
      toast.error("Only buyer accounts can submit sourcing requests.");
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <div className="sticky bottom-4 z-30 mx-auto mt-10 w-full max-w-3xl px-4">
      <div className="rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
          <Sparkles className="h-3.5 w-3.5" /> Buyer Requirement Assistant
        </p>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={isListening ? stop : start}
            disabled={!isSupported}
            title={isSupported ? "Voice input" : "Voice input not supported in this browser"}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full border shrink-0 transition-colors",
              isListening
                ? "bg-red-500/10 border-red-500/40 text-red-500 animate-pulse"
                : "bg-muted border-border text-muted-foreground hover:text-foreground",
              !isSupported && "opacity-40 cursor-not-allowed"
            )}
          >
            {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What are you looking for today?"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
          />

          <Button onClick={handleSend} className="shrink-0 gap-1.5">
            <Send className="h-4 w-4" /> Send Request
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="text-[11px] px-2 py-1 rounded-full bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <SourcingRequestConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        requirement={text}
        onSubmitted={() => setText("")}
      />
    </div>
  );
}
