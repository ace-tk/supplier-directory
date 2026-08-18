"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { sendAdminMessageAction } from "@/services/proposals";
import type { FreelancerRecord } from "@/types/freelancer";

/**
 * No two-way chat/Conversation model exists for admin↔freelancer messaging
 * — this sends a single one-way note via the real (previously-unused)
 * sendAdminMessageAction, which creates a genuine Notification the
 * freelancer sees in their own portal. Deliberately scoped to that, not
 * presented as a live chat thread.
 */
export function SendMessageDialog({
  freelancer,
  open,
  onOpenChange,
}: {
  freelancer: FreelancerRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function handleOpenChange(next: boolean) {
    if (!next) setMessage("");
    onOpenChange(next);
  }

  async function handleSend() {
    if (!freelancer || !message.trim()) return;
    setSending(true);
    const result = await sendAdminMessageAction({ freelancerUserId: freelancer.id, message });
    setSending(false);
    if (!result.success) return toast.error(result.error);
    toast.success(`Message sent to ${freelancer.name}`);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Message {freelancer?.name}</DialogTitle>
          <DialogDescription>Sends a note to their notifications — not a live chat.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a message..."
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending || !message.trim()} className="gap-1.5">
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
