# Segmentation service — SAM 2 (local, free)

Powers AI Garment Studio's **Auto Select** masking tool. This is a small,
isolated Python process — it is never imported into or executed by the
Next.js app. The app talks to it over plain local HTTP
(`services/garment-segmentation.ts`), the exact same shape as any other
external inference call already in this codebase (compare to
`lib/ai/openai-client.ts`), just pointed at a free, local, open-source
model instead of a paid API.

```
GarmentCanvas.tsx (Auto Select click)
        │  point coordinates already in the same pixel space
        │  the existing MaskBuffer uses (screenToCanvasPoint)
        ▼
services/garment-segmentation.ts  (Next.js server action, admin-gated)
        │  plain HTTP POST, image + points
        ▼
services/segmentation/server.py   (this service, localhost only)
        │  SAM 2.1 (tiny) inference
        ▼
selection mask PNG, same pixel dimensions as the input image
        │
        ▼
MaskBuffer.applyExternalMask()  →  existing getMaskBlob() → existing
Colorize / Prints-Logos / Patterns / Change / Regenerate pipeline, unchanged
```

SAM 2 only ever decides **where** the user clicked wants to be selected.
The existing OpenAI-based editing pipeline is completely unaware this
service exists and is unchanged — it still decides **what** happens to
whatever region is selected, exactly as before, regardless of whether that
region was painted by hand or auto-selected.

## What model, and why

[Meta's SAM 2.1](https://github.com/facebookresearch/sam2) via the official
`sam2` PyPI package (`pip install sam2`, published by Meta). This uses the
**tiny** checkpoint (`sam2.1_hiera_tiny.pt`, ~156MB) — the smallest/fastest
of the four official sizes, chosen for responsive local interactive use.
Free, open-source, no account or API key of any kind.

## Local setup (macOS / Apple Silicon)

```bash
cd services/segmentation
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python download_checkpoint.py      # one-time, ~156MB, from Meta's own hosting
uvicorn server:app --host 127.0.0.1 --port 8000
```

Leave that running, then start the Next.js app as usual (`npm run dev`) in
another terminal. `services/garment-segmentation.ts` defaults to
`http://127.0.0.1:8000`; override with `SEGMENTATION_SERVICE_URL` if you run
it on a different port/host.

Verify it's up: `curl http://127.0.0.1:8000/health`.

### Hardware / where inference actually runs

- **Apple Silicon (M-series) Macs**: uses PyTorch's MPS backend (Apple's
  GPU API) automatically — confirmed working in this exact setup. No CUDA,
  no GPU purchase, no cloud dependency for local development.
- Falls back to CPU automatically if MPS isn't available (`torch.backends.mps.is_available()`
  is checked at model-load time) — slower, but still fully functional.
- **Never assumes CUDA.** `get_device()` only uses CUDA if MPS isn't present
  and CUDA is.

### Measured local latency (this dev machine, tiny model, MPS)

- Model load (first request only, then cached in-process): **~0.6s**
- Per-click inference (`set_image` + `predict`): **~2–4s**

Each Auto Select click currently re-runs the full image encoder (no
cross-request embedding cache — see Limitations in the feature's PR/report),
which is the dominant cost. This is an acceptable V1 tradeoff for a
click-to-select feature, not real-time video-scrubbing performance.

## Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `SEGMENTATION_SERVICE_URL` | Next.js server env (`.env`/`.env.local`) | Base URL of this service. Defaults to `http://127.0.0.1:8000` if unset. Changing this is the *only* step needed to point at a different host later (e.g. an Oracle Cloud instance) — no code change. |

No API key. Nothing here is sent to, or requires an account with, any
external provider — this is why there's no `SEGMENTATION_API_KEY` or
similar.

## Production / Oracle Cloud deployment

SupplyBase's Next.js app runs on Oracle Cloud today. This service is
**not** deployed as part of that — it needs its own long-running process
(unlike Vercel-style serverless functions, it must keep a loaded
multi-hundred-MB model resident in memory between requests), so treat it as
a small internal microservice next to the main app, not a route inside it.

**Do not assume the production Oracle instance has a GPU.** This service
runs on CPU with zero code changes if none is available — `get_device()`
already falls back to `"cpu"` automatically. It will be slower per click
(CPU inference for the tiny SAM 2 model is roughly single-digit seconds
per click on a typical cloud CPU core, based on the model's published
benchmarks — plan for a few seconds of "Generating selection…" time on a
GPU-less instance) but fully functional; nothing needs to be purchased or
redesigned to ship this V1.

To deploy:
1. Provision the same Python 3.12 venv + `pip install -r requirements.txt`
   + `python download_checkpoint.py` on the Oracle instance (or bake it
   into a container image).
2. Run `uvicorn server:app --host 127.0.0.1 --port 8000` as a long-lived
   process (systemd unit / supervisor / container), bound to localhost or
   an internal-only network interface — **never expose it publicly**; only
   the Next.js server should ever reach it (see Security below).
3. Point `SEGMENTATION_SERVICE_URL` at wherever it listens (e.g.
   `http://127.0.0.1:8000` if co-located on the same host, or an internal
   private address if it's a separate instance).

If real-world latency on CPU turns out to be too slow for production, the
next step is moving this same service to a GPU-backed Oracle instance
(OCI has GPU shapes) — no application code changes required, only where
the process runs and which `device` it resolves to (already automatic).
Nothing in this PR purchases or provisions that; it's future work.

## Security

- This service is only ever called from the Next.js server (a Server
  Action), never directly from the browser — the frontend has no
  knowledge of its URL or existence. It should be bound to localhost /
  an internal-only interface in production, never exposed to the public
  internet.
- The Next.js server action (`services/garment-segmentation.ts`) enforces
  the same admin-only authorization every other AI Design Studio action
  already uses, and validates the image (type/size) before ever reaching
  this service.
- This service independently re-validates its inputs too (content type,
  point count/shape, image size, image decodability) — it doesn't trust
  its caller just because that caller happens to be our own app.
- No shell execution of any kind is reachable from any input. There is no
  code path that accepts or runs an arbitrary command.

## Limitations (V1)

- No cross-request embedding cache: each click (including Add/Subtract
  refinement clicks) re-runs SAM 2's image encoder from scratch. Fine for
  V1; a real perf win later would be caching the per-image embedding
  between refinement clicks on the same image.
- Point prompts only (Add/Subtract clicks) — no box-drag prompt yet.
- Single image in, single mask out per request — no batching.
- This is a V1 automatic selection, not Photoshop-level accuracy — it can
  still misjudge ambiguous or low-contrast edges (see the feature's own
  in-app copy, which labels it as such and always leaves Brush/Eraser
  available to refine the result).
