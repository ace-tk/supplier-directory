/**
 * Pattern Print Studio feature flag. NEXT_PUBLIC_* values are inlined at
 * build time, so changing it needs a rebuild/redeploy. When off, the route
 * 404s and the AI Garment Studio card is hidden.
 */
export function isPatternStudioEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_FEATURE_PATTERN_STUDIO;
  return v === "true" || v === "1";
}
