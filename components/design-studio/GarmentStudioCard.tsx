import Link from "next/link";
import { Mic } from "lucide-react";
import type { GarmentStudioCard as GarmentStudioCardData } from "@/lib/garment-studio-sections";

/**
 * The one card used by every AI Garment Studio home section. Cards with an
 * href link to their live workflow; the rest render as plain, non-clickable
 * cards until their route exists.
 */
export function GarmentStudioCard({ card }: { card: GarmentStudioCardData }) {
  const body = (
    <div className="flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-card transition-[border-color,box-shadow] duration-200 hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-[381/254] w-full border-b border-border bg-muted">
        {/* Decorative (the title below names the card), so alt="" — which
            also means a not-yet-added image file leaves a plain muted panel
            rather than a broken-image icon. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={card.image} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
        {card.voice && (
          <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-card/92 px-2.5 py-1 text-[12.5px] font-semibold text-sky-ink shadow-sm">
            <Mic className="h-3.5 w-3.5" /> Voice
          </span>
        )}
      </div>
      {/* Fixed text box (1-line title, 3-line description) so every card in
          every section is exactly the same size; full text stays on hover. */}
      <div className="p-5">
        <p title={card.title} className="truncate text-[19px] font-semibold leading-snug text-foreground">{card.title}</p>
        <p title={card.description} className="mt-1.5 line-clamp-3 min-h-[4.35em] text-[15.5px] leading-[1.45] text-muted-foreground">{card.description}</p>
      </div>
    </div>
  );

  return card.href ? (
    <Link href={card.href} className="block h-full">
      {body}
    </Link>
  ) : (
    <div className="h-full">{body}</div>
  );
}
