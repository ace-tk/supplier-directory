"use client";

import { Mic, Square, MicOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";

/** Description/Notes textarea with a rainbow-gradient voice mic overlaid
 * bottom-right — reuses useSpeechRecognition exactly as
 * ExpenseNotesField does (append transcript to existing text, never
 * erase), just with a distinct "AI" visual treatment for this one
 * intentionally colorful control. */
export function VoiceNotesField({
  value,
  onChange,
  label = "Description / Notes",
  rows = 3,
  placeholder = "Optional",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  rows?: number;
  placeholder?: string;
}) {
  const { isListening, isSupported, error, start, stop } = useSpeechRecognition({
    onResult: (transcript) => {
      onChange(value ? `${value} ${transcript}` : transcript);
    },
  });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isListening ? "Listening…" : placeholder}
          className="pr-11"
        />
        <button
          type="button"
          onClick={isListening ? stop : start}
          disabled={!isSupported}
          title={
            !isSupported
              ? "Voice input not supported in this browser"
              : error
                ? error
                : isListening
                  ? "Stop voice input"
                  : "Voice input"
          }
          className={cn(
            "absolute bottom-2 right-2 flex items-center justify-center h-7 w-7 rounded-full shadow-sm transition-transform",
            !isSupported && "bg-muted text-muted-foreground opacity-40 cursor-not-allowed",
            isSupported && !isListening &&
              "text-white hover:scale-105 bg-[conic-gradient(from_180deg_at_50%_50%,#f97316,#ec4899,#a855f7,#6366f1,#3b82f6,#10b981,#f97316)]",
            isListening && "bg-destructive text-destructive-foreground scale-105 animate-pulse"
          )}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
        >
          {!isSupported ? <MicOff className="h-3.5 w-3.5" /> : isListening ? <Square className="h-3 w-3 fill-current" /> : <Mic className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {!isSupported && <p className="text-[11px] text-muted-foreground">Voice input isn&apos;t available in this browser — you can still type notes.</p>}
    </div>
  );
}
