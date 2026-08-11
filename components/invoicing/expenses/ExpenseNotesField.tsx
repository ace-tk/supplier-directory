"use client";

import { Mic, Square, MicOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";

/** Notes textarea with a mic button overlaid inside it (bottom-right) —
 * speech is transcribed and appended to the existing text, which the user
 * can still edit freely before saving. Falls back to a plain textarea when
 * the browser's Speech Recognition API isn't available. */
export function ExpenseNotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { isListening, isSupported, error, start, stop } = useSpeechRecognition({
    onResult: (transcript) => {
      onChange(value ? `${value} ${transcript}` : transcript);
    },
  });

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Notes</Label>
      <div className="relative">
        <Textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={isListening ? "Listening…" : "Optional notes"}
          className="pr-10"
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
            "absolute bottom-2 right-2 flex items-center justify-center h-7 w-7 rounded-full transition-colors",
            isListening
              ? "bg-destructive/10 text-destructive"
              : error
                ? "text-destructive"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            !isSupported && "opacity-40 cursor-not-allowed"
          )}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
        >
          {!isSupported ? (
            <MicOff className="h-3.5 w-3.5" />
          ) : isListening ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Mic className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
