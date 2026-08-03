"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Mic, Square, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { SourcingRequestConfirmDialog } from "./SourcingRequestConfirmDialog";
import { cn } from "@/lib/utils";
import { SOURCING_REQUEST_DRAFT_KEY as DRAFT_KEY } from "@/lib/storage-keys";

const EXAMPLES = [
  "I need 100 sneakers under ₹4,000.",
  "Looking for cotton T-shirt manufacturers.",
  "Need kidswear suppliers from Tiruppur.",
  "Looking for women's handbags for export.",
  "I need OEM hoodie manufacturers.",
];

const ROTATE_MS = 3200;

export function BuyerRequirementAssistant() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const [text, setText] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(DRAFT_KEY) ?? "";
  });
  // A restored draft reopens the panel so the buyer can submit without
  // retyping — computed once at mount, alongside `text` above.
  const [open, setOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(DRAFT_KEY);
  });
  const [hovering, setHovering] = useState(false);
  const [exampleIndex, setExampleIndex] = useState(0);
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

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setExampleIndex((i) => (i + 1) % EXAMPLES.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [open]);

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
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end">
      {/* Hover preview — only when the panel itself is closed */}
      <AnimatePresence>
        {hovering && !open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="mb-3 w-64 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-elevated"
          >
            <p className="text-xs font-semibold text-foreground mb-2">Need help finding suppliers?</p>
            <ul className="space-y-1.5">
              {[
                "Describe your requirement",
                "Get matched with verified suppliers",
                "Receive supplier recommendations",
              ].map((line) => (
                <li key={line} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="text-emerald-500">✓</span> {line}
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating trigger */}
      {!open && (
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-2 pl-3 pr-4 h-11 rounded-full bg-primary text-primary-foreground shadow-elevated hover:shadow-lg transition-shadow"
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span className="hidden sm:inline text-sm font-medium whitespace-nowrap">
            Buyer Requirement Assistant
          </span>
        </motion.button>
      )}

      {/* Compact floating panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="w-[400px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card shadow-elevated overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 shrink-0">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground leading-tight truncate">
                    Buyer Requirement Assistant
                  </p>
                  <span className="flex items-center gap-1 text-[10px] text-emerald-500 leading-tight">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </span>
                    Ready
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center w-7 h-7 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              <div className="relative h-8 overflow-hidden rounded-lg bg-muted/50 border border-border/50">
                <AnimatePresence mode="wait">
                  <motion.button
                    key={exampleIndex}
                    type="button"
                    onClick={() => setText(EXAMPLES[exampleIndex])}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 flex items-center px-3 text-left text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
                  >
                    {EXAMPLES[exampleIndex]}
                  </motion.button>
                </AnimatePresence>
              </div>

              <div className="flex items-center justify-center gap-1">
                {EXAMPLES.map((example, i) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setExampleIndex(i)}
                    aria-label={`Show example ${i + 1}`}
                    className={cn(
                      "h-1 rounded-full transition-all",
                      i === exampleIndex ? "w-4 bg-primary" : "w-1 bg-muted-foreground/30"
                    )}
                  />
                ))}
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={isListening ? stop : start}
                  disabled={!isSupported}
                  title={isSupported ? "Voice input" : "Voice input not supported in this browser"}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full border shrink-0 transition-colors",
                    isListening
                      ? "bg-red-500/10 border-red-500/40 text-red-500 animate-pulse"
                      : "bg-muted border-border text-muted-foreground hover:text-foreground",
                    !isSupported && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {isListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>

                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Describe your sourcing requirement..."
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring"
                />
              </div>

              <Button onClick={handleSend} className="w-full gap-1.5">
                <Send className="h-4 w-4" /> Send Request
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <SourcingRequestConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        requirement={text}
        onSubmitted={() => setText("")}
      />
    </div>
  );
}
