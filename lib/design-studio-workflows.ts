import type { ComponentType } from "react";
import { Grid3x3, Shirt, Library, Scissors, Package, RotateCw } from "lucide-react";

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
    id: "garment-back-design",
    name: "Garment Back Design",
    description: "Generate a matching back view for any front-facing garment design.",
    href: "/design-studio/garment-back-design",
    icon: RotateCw,
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
];

export interface DesignStudioProposalCard {
  id: string;
  name: string;
  description: string;
  /** Served from public/ai-studio/reference-images/. */
  image: string;
}

/**
 * Display-only Studio Home cards, in order. No workflow is wired to these
 * yet — each gets an href (and moves to its own route) once its workflow is
 * built.
 */
export const designStudioProposalCards: DesignStudioProposalCard[] = [
  {
    id: "hit-collection-proposal",
    name: "Hit Collection Proposal",
    description: "Extend a bestseller into cohesive style variations while preserving its core design language.",
    image: "/ai-studio/reference-images/hit-collection-proposal.webp",
  },
  {
    id: "collection-proposal",
    name: "Collection Proposal",
    description: "Build a cohesive collection proposal around a bestseller with aligned themes, categories and design language.",
    image: "/ai-studio/reference-images/collection-proposal.webp",
  },
  {
    id: "detail-to-design",
    name: "Detail to Design",
    description: "Turn a neckline, sleeve, pocket or other detail reference into multiple apparel concepts.",
    image: "/ai-studio/reference-images/detail-to-design.webp",
  },
  {
    id: "fabric-to-design",
    name: "Fabric to Design",
    description: "Create apparel concepts that match the color, texture and drape of a fabric reference.",
    image: "/ai-studio/reference-images/fabric-to-design.webp",
  },
];
