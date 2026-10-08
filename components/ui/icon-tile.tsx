import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type Tone = "sky" | "mint" | "peach" | "lav" | "rose" | "butter" | "sage" | "primary"

/** Pastel background + matching ink, from the theme tokens (translucent in dark). */
export const TONE_CLASS: Record<Tone, string> = {
  sky: "bg-sky text-sky-ink",
  mint: "bg-mint text-mint-ink",
  peach: "bg-peach text-peach-ink",
  lav: "bg-lav text-lav-ink",
  rose: "bg-rose text-rose-ink",
  butter: "bg-butter text-butter-ink",
  sage: "bg-sage text-sage-ink",
  primary: "bg-primary/12 text-pri-text",
}

const SIZE_CLASS = {
  sm: "size-8 rounded-[10px] [&_svg]:size-4",
  md: "size-10 rounded-xl [&_svg]:size-5",
  lg: "size-14 rounded-2xl [&_svg]:size-7",
} as const

interface IconTileProps {
  icon: LucideIcon
  tone?: Tone
  size?: keyof typeof SIZE_CLASS
  className?: string
}

/** Pastel rounded square holding an icon. */
export function IconTile({ icon: Icon, tone = "sky", size = "md", className }: IconTileProps) {
  return (
    <div
      aria-hidden
      className={cn("flex shrink-0 items-center justify-center", TONE_CLASS[tone], SIZE_CLASS[size], className)}
    >
      <Icon />
    </div>
  )
}
