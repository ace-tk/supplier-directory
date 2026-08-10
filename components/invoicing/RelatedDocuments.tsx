import Link from "next/link";
import { FileText, ArrowUpRight } from "lucide-react";
import { INVOICE_TYPE_LABELS } from "@/lib/invoicing/ui";
import type { RelatedDocuments as RelatedDocumentsData } from "@/types/invoicing";

export function RelatedDocuments({ basePath, data }: { basePath: string; data: RelatedDocumentsData }) {
  if (!data.source && data.derived.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">Related Documents</h2>
      <div className="space-y-1.5">
        {data.source && (
          <Link
            href={`${basePath}/${data.source.id}`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Created from</span>
            <span className="font-medium text-foreground">{INVOICE_TYPE_LABELS[data.source.type]}</span>
            <span className="font-mono text-xs text-muted-foreground">{data.source.invoiceNumber}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          </Link>
        )}
        {data.derived.map((doc) => (
          <Link
            key={doc.id}
            href={`${basePath}/${doc.id}`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-medium text-foreground">{INVOICE_TYPE_LABELS[doc.type]}</span>
            <span className="font-mono text-xs text-muted-foreground">{doc.invoiceNumber}</span>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}
