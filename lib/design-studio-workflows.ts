import type { ComponentType } from "react";
import { Grid3x3, Shirt, Library, Scissors, SwatchBook, Layers, Package } from "lucide-react";

export interface DesignStudioWorkflow {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  status: "available" | "coming-soon";
}

/**
 * Single source of truth for every AI Design Studio workflow — drives the
 * Studio Home cards and the secondary nav (StudioNav). Adding a future
 * workflow (Print → Embroidery going live, a new AI tool, ...) means adding
 * one entry here, not touching the home page or nav separately.
 */
export const designStudioWorkflows: DesignStudioWorkflow[] = [
  {
    id: "repeat-print-maker",
    name: "Repeat Print Maker",
    description: "Turn artwork into seamless, tileable repeat prints.",
    href: "/design-studio/repeat-print",
    icon: Grid3x3,
    status: "available",
  },
  {
    id: "ai-garment-studio",
    name: "AI Garment Studio",
    description: "Generate garments with AI and edit them region by region.",
    href: "/design-studio/garment",
    icon: Shirt,
    status: "available",
  },
  {
    id: "pattern-library",
    name: "Pattern Library",
    description: "Browse, reuse and apply your saved seamless patterns.",
    href: "/design-studio/pattern-library",
    icon: Library,
    status: "available",
  },
  {
    id: "print-to-embroidery",
    name: "Print → Embroidery",
    description: "Convert artwork into an embroidery concept and preview it on a garment.",
    href: "/design-studio/print-to-embroidery",
    icon: Scissors,
    status: "available",
  },
  {
    id: "embroidery-assets",
    name: "Embroidery Assets",
    description: "A home for embroidery-ready assets — detailed categorization is coming later.",
    href: "/design-studio/embroidery-assets",
    icon: Package,
    status: "available",
  },
  {
    id: "color-variations",
    name: "Color Variations",
    description: "Generate colorway variations of a design automatically.",
    href: "/design-studio/color-variations",
    icon: SwatchBook,
    status: "coming-soon",
  },
  {
    id: "garment-variations",
    name: "Garment Variations",
    description: "Produce style and silhouette variations of a garment.",
    href: "/design-studio/garment-variations",
    icon: Layers,
    status: "coming-soon",
  },
];
