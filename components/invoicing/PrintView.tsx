"use client";

import { useEffect } from "react";
import { InvoicePreview, toInvoicePreviewProps, type InvoicePreviewProps } from "./preview/InvoicePreview";
import type { InvoiceRecord } from "@/types/invoicing";

/** Bare, chrome-free print target — no nav/sidebar/action buttons, just the document. */
export function PrintView({ invoice }: { invoice: InvoiceRecord }) {
  useEffect(() => {
    const id = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(id);
  }, []);

  const props: InvoicePreviewProps = toInvoicePreviewProps(invoice);

  return (
    <div className="min-h-screen bg-white py-8 print:py-0">
      <div className="mx-auto max-w-3xl px-4 print:max-w-none print:px-0">
        <InvoicePreview {...props} className="border-0 shadow-none rounded-none print:border-0 print:shadow-none" />
      </div>
    </div>
  );
}
