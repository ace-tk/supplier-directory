"use client";

import { useEffect } from "react";
import { toInvoicePreviewProps, type InvoicePreviewProps } from "./preview/InvoicePreview";
import { InvoiceTemplateRenderer } from "./templates/InvoiceTemplateRenderer";
import type { InvoiceRecord } from "@/types/invoicing";

/** Bare, chrome-free print target — no nav/sidebar/action buttons, just the
 * document, rendered in whichever template the invoice was saved with. A4
 * page setup + row/section break rules live here since this route (via the
 * browser's own print dialog / "Save as PDF") is the real PDF-export path
 * for every template, not just Regular. */
export function PrintView({ invoice }: { invoice: InvoiceRecord }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, []);

  const props: InvoicePreviewProps = toInvoicePreviewProps(invoice);

  return (
    <div className="min-h-screen bg-white py-8 print:py-0">
      <style>{`
        @page { size: A4; margin: 14mm; }
        @media print {
          html, body { background: #fff; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
        }
      `}</style>
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        <InvoiceTemplateRenderer
          template={invoice.template}
          {...props}
          className="border-0 shadow-none rounded-none print:border-0 print:shadow-none"
        />
      </div>
    </div>
  );
}
