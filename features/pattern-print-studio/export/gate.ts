// The pre-flight gate for export: which problems BLOCK an export and which
// only warn ("Export anyway"). Pure rules, so they can be unit-tested.

export type GateKind = "missing" | "open" | "dpi" | "empty" | "untagged" | "gap" | "link";

export interface GateInput {
  kind: GateKind;
  /** Effective DPI of the print (kind "dpi"). */
  dpi?: number;
  /** The open outline holds a print (kind "open"). */
  hasPrint?: boolean;
}

export const DPI_BLOCK = 100;

/**
 * error   — export is blocked until it is fixed
 * warning — export is allowed after the user confirms
 *
 *  - a missing original image: there is nothing to print from
 *  - an open outline with a print in it: the print cannot be cut to the piece
 *  - a print under 100 effective DPI that is also below the export DPI
 *    (exporting at 72 DPI cannot be made worse by an 80 DPI print)
 *  - everything else warns: empty pieces, untagged pieces, DPI 100–150,
 *    white-gap risk, linked pieces that differ, open marks without a print
 */
export function gateLevel(issue: GateInput, exportDpi: number): "error" | "warning" {
  if (issue.kind === "missing") return "error";
  if (issue.kind === "open") return issue.hasPrint ? "error" : "warning";
  if (issue.kind === "dpi") return issue.dpi !== undefined && issue.dpi < DPI_BLOCK && issue.dpi < exportDpi ? "error" : "warning";
  return "warning";
}

export function gate<T extends GateInput>(issues: T[], exportDpi: number): { errors: T[]; warnings: T[]; canExport: boolean } {
  const errors: T[] = [];
  const warnings: T[] = [];
  for (const i of issues) (gateLevel(i, exportDpi) === "error" ? errors : warnings).push(i);
  return { errors, warnings, canExport: errors.length === 0 };
}
