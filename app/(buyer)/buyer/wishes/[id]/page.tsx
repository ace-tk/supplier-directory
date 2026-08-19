import { redirect, notFound } from "next/navigation";
import { MapPin, ShieldCheck, ImageOff } from "lucide-react";
import { getUser } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/portal/status-badge";
import { ManufactureThisWishButton } from "@/components/wishes/ManufactureThisWishButton";
import { getWishAction } from "@/services/wishes";
import { findMatchingSuppliersAction } from "@/services/manufacturing";
import { formatMoney } from "@/lib/invoicing/ui";

const STATUS_LABELS = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
} as const;

export default async function WishDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) redirect("/login?from=/buyer/wishes");

  const { id } = await params;
  const result = await getWishAction(id);
  if (!result.success) notFound();
  const wish = result.data;

  // Drafts are edited, not viewed — keep the two views cleanly separate.
  if (wish.status === "DRAFT") redirect(`/buyer/wishes/${id}/edit`);

  const matchesResult = wish.category ? await findMatchingSuppliersAction(wish.category) : null;
  const matches = matchesResult?.success ? matchesResult.data : [];

  return (
    <div>
      <PageHeader
        title={wish.name}
        description={wish.category}
        actions={<StatusBadge status={STATUS_LABELS[wish.status]} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
        <div className="space-y-6 min-w-0">
          {wish.images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {wish.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={img.dataUrl} alt={wish.name} className="w-full aspect-square rounded-xl object-cover bg-muted" />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-6 text-muted-foreground">
              <ImageOff className="h-4 w-4" /> No reference images
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{wish.description || "—"}</p>
          </div>

          {(wish.material || wish.colors.length > 0 || wish.sizes.length > 0) && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              {wish.material && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Material</p>
                  <p className="text-foreground">{wish.material}</p>
                </div>
              )}
              {wish.colors.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Colors</p>
                  <p className="text-foreground">{wish.colors.join(", ")}</p>
                </div>
              )}
              {wish.sizes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Sizes</p>
                  <p className="text-foreground">{wish.sizes.join(", ")}</p>
                </div>
              )}
            </div>
          )}

          {wish.notes && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{wish.notes}</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target Price</p>
              <p className="text-sm font-semibold text-foreground">{wish.targetPrice !== null ? formatMoney(wish.targetPrice, wish.currency) : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target Qty</p>
              <p className="text-sm font-semibold text-foreground">{wish.targetQuantity ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">MOQ</p>
              <p className="text-sm font-semibold text-foreground">{wish.targetMoq ?? "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Required By</p>
              <p className="text-sm font-semibold text-foreground">{wish.requiredBy ? new Date(wish.requiredBy).toLocaleDateString() : "—"}</p>
            </div>
          </div>

          <ManufactureThisWishButton wishId={wish.id} />
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Matching Suppliers</p>
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matching suppliers found for this category yet.</p>
          ) : (
            <div className="space-y-2.5">
              {matches.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground truncate">{s.companyName}</p>
                    {s.verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {s.city}, {s.country}
                  </p>
                  <p className="text-[11px] font-medium text-primary">{s.matchReason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
