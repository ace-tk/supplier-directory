import { InvoicePreview, type InvoicePreviewProps } from "@/components/invoicing/preview/InvoicePreview";
import { ClassicRedInvoiceTemplate } from "./ClassicRedInvoiceTemplate";
import { MinimalStudioInvoiceTemplate } from "./MinimalStudioInvoiceTemplate";
import type { InvoiceTemplate } from "@/types/invoicing";

/**
 * The single switch point between the 3 visual designs. Every branch
 * receives the exact same InvoicePreviewProps — the shared, already-
 * computed view model — so Regular/Classic Red/Minimal Studio can never
 * disagree on a monetary value; only the presentation differs. Used
 * identically by the live editor preview, the invoice detail page, and the
 * print route, so switching templates never touches form data or triggers
 * a recalculation.
 */
export function InvoiceTemplateRenderer({ template, ...props }: InvoicePreviewProps & { template: InvoiceTemplate }) {
  switch (template) {
    case "CLASSIC_RED":
      return <ClassicRedInvoiceTemplate {...props} />;
    case "MINIMAL_STUDIO":
      return <MinimalStudioInvoiceTemplate {...props} />;
    case "REGULAR":
    default:
      return <InvoicePreview {...props} />;
  }
}
