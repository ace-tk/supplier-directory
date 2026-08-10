"use client";

import { Mic, Square } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { cn } from "@/lib/utils";

/** Notes textarea with an optional mic button — speech is transcribed and
 * appended to the existing text, which the user can still edit freely
 * before saving. Falls back to a plain textarea when the browser's Speech
 * Recognition API isn't available. */
export function ExpenseNotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { isListening, isSupported, start, stop } = useSpeechRecognition({
    onResult: (transcript) => {
      onChange(value ? `${value} ${transcript}` : transcript);
    },
  });

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">Notes</Label>
        <button
          type="button"
          onClick={isListening ? stop : start}
          disabled={!isSupported}
          title={isSupported ? "Voice input" : "Voice input not supported in this browser"}
          className={cn(
            "flex items-center justify-center h-6 w-6 rounded-full transition-colors",
            isListening ? "bg-destructive/10 text-destructive" : "text-muted-foreground hover:text-foreground hover:bg-muted",
            !isSupported && "opacity-40 cursor-not-allowed"
          )}
          aria-label={isListening ? "Stop voice input" : "Start voice input"}
        >
          {isListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </button>
      </div>
      <Textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isListening ? "Listening…" : "Optional notes"}
      />
    </div>
  );
}
