import type { ComponentType } from "react";
import type { PortfolioViewModel } from "@/types/portfolio";
import { Editorial01Template } from "./editorial-01/editorial-01-template";

// Presentation-only registry, keyed by the same `key` values as
// lib/portfolio-templates.ts. Adding Template 02+ means adding a component
// here — the data contract (PortfolioViewModel) never changes.
const TEMPLATE_COMPONENTS: Record<string, ComponentType<{ data: PortfolioViewModel }>> = {
  editorial01: Editorial01Template,
};

export function PortfolioRenderer({ data }: { data: PortfolioViewModel }) {
  const Component = TEMPLATE_COMPONENTS[data.templateKey] ?? Editorial01Template;
  return <Component data={data} />;
}
