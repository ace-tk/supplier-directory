"use client";

import { useState } from "react";
import { BellRing, Mail, MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney, formatShortDate } from "@/lib/invoicing/ui";
import type { InvoiceRecord } from "@/types/invoicing";

function buildReminderMessage(invoice: InvoiceRecord, balanceDue: string): string {
  return [
    `Hi ${invoice.partyContactPerson || invoice.partyName},`,
    "",
    `This is a friendly reminder that payment for Tax Invoice ${invoice.invoiceNumber} (${formatMoney(invoice.grandTotal, invoice.currency)}) is due.`,
    `Balance due: ${formatMoney(balanceDue, invoice.currency)}`,
    `Due date: ${formatShortDate(invoice.dueDate)}`,
    "",
    `Please let us know if you have any questions.`,
    "",
    `Regards,`,
    invoice.sellerName,
  ].join("\n");
}

/**
 * Generates an editable reminder the user reviews before handing off to
 * their own mail/WhatsApp client — same real mailto:/wa.me mechanism as
 * ShareMenu. Never auto-sent, never marked "sent" by the app itself.
 */
export function SendReminderDialog({ invoice, balanceDue }: { invoice: InvoiceRecord; balanceDue: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(() => buildReminderMessage(invoice, balanceDue));

  function handleOpenChange(next: boolean) {
    if (next) setMessage(buildReminderMessage(invoice, balanceDue));
    setOpen(next);
  }

  function handleEmail() {
    const subject = encodeURIComponent(`Payment reminder — Invoice ${invoice.invoiceNumber}`);
    const to = invoice.partyEmail ? encodeURIComponent(invoice.partyEmail) : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(message)}`;
  }

  function handleWhatsApp() {
    const digits = invoice.partyPhone ? invoice.partyPhone.replace(/[^\d]/g, "") : "";
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <BellRing className="h-3.5 w-3.5" /> Send Reminder
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Payment Reminder</DialogTitle>
          <DialogDescription>Review and edit the message, then hand it off to your email or WhatsApp.</DialogDescription>
        </DialogHeader>

        <Textarea rows={10} value={message} onChange={(e) => setMessage(e.target.value)} className="text-sm" />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={handleEmail} className="gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Email
          </Button>
          <Button variant="outline" size="sm" onClick={handleWhatsApp} className="gap-1.5">
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
