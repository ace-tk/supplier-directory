"use server";

// AI Garment Studio — "Auto Select" masking. Admin-only, same as every
// other Garment Studio action. This is a DIFFERENT AI system from the rest
// of the app: it never touches OpenAI, and OpenAI never touches it. SAM 2
// (services/segmentation/, a local/free/open-source model — see that
// folder's README.md) only ever decides WHERE a click's selection should
// be; it has no opinion on WHAT happens to that region. The existing
// editing pipeline (runMaskedEdit/editImage in services/garment-studio.ts)
// is completely unmodified and unaware this exists — it just keeps
// receiving a mask blob, exactly as before, regardless of whether a human
// painted it or SAM 2 generated it.

import { getUser } from "@/lib/session";
import { validateImage } from "@/lib/file-validation";

export type ActionResult<T = void> = { success: true; data: T } | { success: false; error: string };

async function requireAdmin() {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

// Defaults to the local dev service (see services/segmentation/README.md).
// Changing this to a different host (e.g. a production Oracle Cloud
// instance) is the only step needed to relocate where inference runs —
// no other code changes.
const SEGMENTATION_SERVICE_URL = process.env.SEGMENTATION_SERVICE_URL || "http://127.0.0.1:8000";
const REQUEST_TIMEOUT_MS = 30_000;

export interface SegmentPoint {
  x: number;
  y: number;
  /** SAM 2's own foreground/background point convention: 1 = Add (include
   * this area), 0 = Subtract (exclude this area). */
  label: 0 | 1;
}

/**
 * Sends the exact same garment canvas image the rest of the masking
 * pipeline already uses, plus the click point(s), to the local SAM 2
 * service, and returns a selection mask PNG at that same image's exact
 * pixel dimensions — see services/segmentation/server.py's docstring for
 * why no resizing/alignment step is needed here (verified directly against
 * the real, installed model before this was written).
 *
 * Never throws: every failure mode (service not running, model not
 * downloaded, bad input, timeout) resolves to a friendly
 * ActionResult failure so the caller can fall back to manual masking
 * tools without ever crashing the editor.
 */
export async function autoSelectMaskAction(image: Blob, points: SegmentPoint[]): Promise<ActionResult<{ maskDataUrl: string; score: number }>> {
  const admin = await requireAdmin();
  if (!admin) return { success: false, error: "Admins only." };

  const check = validateImage(image.type, image.size);
  if (!check.valid) return { success: false, error: check.error! };

  if (points.length === 0) {
    return { success: false, error: "Click a point on the garment first." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const form = new FormData();
    form.append("image", image, "image.png");
    form.append("points", JSON.stringify(points));

    const response = await fetch(`${SEGMENTATION_SERVICE_URL}/segment`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      // Never forward the raw response body (could contain internal detail)
      // beyond a short, generic category — the friendly copy the editor
      // shows either way is defined by the caller, not by this message.
      return { success: false, error: "Auto Select couldn't generate a selection. You can continue with Brush, Rectangle or Polygon." };
    }

    const data = (await response.json()) as { mask_png_base64?: string; score?: number };
    if (!data.mask_png_base64) {
      return { success: false, error: "Auto Select didn't return a selection. You can continue with Brush, Rectangle or Polygon." };
    }

    return { success: true, data: { maskDataUrl: `data:image/png;base64,${data.mask_png_base64}`, score: data.score ?? 0 } };
  } catch {
    // Covers: service not running (connection refused), timeout/abort,
    // DNS failure, or any other network-level error. Deliberately generic
    // — never expose internal hosts/stack traces to the client.
    return { success: false, error: "Auto Select isn't available right now. You can continue with Brush, Rectangle or Polygon." };
  } finally {
    clearTimeout(timeout);
  }
}
