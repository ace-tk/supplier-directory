import { Suspense } from "react";
import { getTemplatesForOwner } from "@/lib/content-queries";
import { TemplateLibrary } from "@/components/content/TemplateLibrary";
import { PageHeader } from "@/components/layout/page-header";

type Props = { basePath: string; userId: string; initialCategory?: string };

// Streams the templates query instead of blocking the whole response on it:
// the page shell + this skeleton flush immediately, then TemplateLibrary
// streams in with the same server-fetched initialTemplates as before (so it
// still skips its own client-side fetch on mount).
async function TemplateLibraryData({ basePath, userId, initialCategory }: Props) {
  const initialTemplates = await getTemplatesForOwner(userId);
  return <TemplateLibrary basePath={basePath} initialCategory={initialCategory} initialTemplates={initialTemplates} />;
}

// Mirrors TemplateLibrary's header and its own `templates === null` placeholder.
export function TemplateLibrarySkeleton({ basePath }: { basePath: string }) {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Template Library"
        description="Beautiful, ready-to-use templates for every business need."
        breadcrumbs={[{ label: "Content Management", href: basePath }, { label: "Template Library" }]}
      />
      <div className="h-64 rounded-xl border border-border bg-card animate-pulse" />
    </div>
  );
}

export function StreamedTemplateLibrary(props: Props) {
  return (
    <Suspense fallback={<TemplateLibrarySkeleton basePath={props.basePath} />}>
      <TemplateLibraryData {...props} />
    </Suspense>
  );
}
