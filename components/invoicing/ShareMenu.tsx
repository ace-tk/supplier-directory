"use client";

import { Mail, MessageCircle, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { formatMoney, INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import type { InvoiceRecord } from "@/types/invoicing";

/**
 * Real, verifiable share actions only — mailto:/wa.me are genuine deep
 * links into the user's own mail/WhatsApp client, and Copy Link performs a
 * real clipboard write. There is no email/WhatsApp provider wired up in
 * this codebase (lib/email-service.ts is an explicit mock), so this menu
 * never claims a message was "sent" — it only ever hands off to the
 * recipient's own client or confirms a local action (the copy).
 */
export function ShareMenu({ invoice, url }: { invoice: InvoiceRecord; url: string }) {
  const docLabel = INVOICE_TYPE_LABELS[invoice.type];
  const amount = formatMoney(invoice.grandTotal, invoice.currency);
  const message = `${docLabel} ${invoice.invoiceNumber} from ${invoice.sellerName} — ${amount}.\nView it here: ${url}`;

  function handleEmail() {
    const subject = encodeURIComponent(`${docLabel} ${invoice.invoiceNumber} from ${invoice.sellerName}`);
    const body = encodeURIComponent(message);
    const to = invoice.partyEmail ? encodeURIComponent(invoice.partyEmail) : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }

  function handleWhatsApp() {
    const digits = invoice.partyPhone ? invoice.partyPhone.replace(/[^\d]/g, "") : "";
    const text = encodeURIComponent(message);
    window.open(`https://wa.me/${digits}?text=${text}`, "_blank", "noopener,noreferrer");
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link — copy it manually from the address bar.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
        <Share2 className="h-3.5 w-3.5" /> Share
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleEmail}>
          <Mail className="h-3.5 w-3.5" /> Email
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleWhatsApp}>
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <Link2 className="h-3.5 w-3.5" /> Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
