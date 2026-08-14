// Portfolio template registry — data only (no React components), so this
// file is safe to import from server actions, the builder's template
// picker, and the public renderer alike. Presentation components live
// separately in components/portfolio/templates/registry.tsx and are keyed
// off the same `key` values. Adding Template 02+ later means adding a row
// here plus a new presentation component — never touching this file's
// consumers.

import type { PortfolioTemplateMeta } from "@/types/portfolio";

export const PORTFOLIO_TEMPLATES: PortfolioTemplateMeta[] = [
  {
    key: "editorial01",
    name: "Editorial 01",
    description: "Bold editorial typography, large project visuals, and a black/white/neutral palette.",
    availability: "AVAILABLE",
  },
  {
    key: "brutalist02",
    name: "Brutalist 02",
    description: "Raw grid-driven layout with stark type contrasts.",
    availability: "COMING_SOON",
  },
  {
    key: "gallery03",
    name: "Gallery 03",
    description: "Image-forward layout built around a full-bleed project gallery.",
    availability: "COMING_SOON",
  },
  {
    key: "minimal04",
    name: "Minimal 04",
    description: "Quiet, text-led layout for writing- and strategy-led portfolios.",
    availability: "COMING_SOON",
  },
];

export const DEFAULT_TEMPLATE_KEY = "editorial01";

export function getTemplateMeta(key: string): PortfolioTemplateMeta | undefined {
  return PORTFOLIO_TEMPLATES.find((t) => t.key === key);
}

export function isTemplateSelectable(key: string): boolean {
  return getTemplateMeta(key)?.availability === "AVAILABLE";
}
