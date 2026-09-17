"""Local SAM 2 segmentation microservice for AI Garment Studio's
"Auto Select" masking tool.

This process is intentionally separate from the Next.js app — it is never
imported into or executed by the frontend/Node process, and the frontend
never talks to it directly (see security notes in README.md). The Next.js
server action (services/garment-segmentation.ts) calls it over a plain
local HTTP request, the same shape as any other external inference call
already in this codebase (see lib/ai/openai-client.ts calling OpenAI) —
just pointed at a free, local, open-source model instead of a paid API.

SAM 2 is responsible ONLY for producing a selection mask from a click.
It never talks to OpenAI and never performs the actual garment edit — the
existing masking/editing pipeline (MaskBuffer, getMaskBlob, runMaskedEdit,
editImage) is completely unchanged and unaware this service exists; it just
receives a mask PNG built from a different source than a paintbrush.

Run locally — see README.md for full setup:
    source .venv/bin/activate
    python download_checkpoint.py     # one-time, ~156MB
    uvicorn server:app --host 127.0.0.1 --port 8000
"""

import base64
import io
import json
import logging
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("segmentation")

SERVICE_DIR = Path(__file__).parent
CHECKPOINT_PATH = SERVICE_DIR / "checkpoints" / "sam2.1_hiera_tiny.pt"
MODEL_CONFIG = "configs/sam2.1/sam2.1_hiera_t.yaml"

# Defense in depth only — the Next.js app already caps garment canvases at
# 1536px (see lib/garment-canvas.ts MAX_CANVAS_DIMENSION) before this
# service ever sees an image, so this is never expected to trigger from the
# real app; it exists in case this endpoint is ever called some other way.
MAX_IMAGE_DIMENSION = 2048
MAX_POINTS = 20
ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

app = FastAPI(title="SupplyBase Segmentation Service (SAM 2, local, free)")

_predictor = None
_device: Optional[str] = None


def get_device() -> str:
    if torch.backends.mps.is_available():
        return "mps"
    if torch.cuda.is_available():
        return "cuda"
    return "cpu"


def get_predictor():
    """Loads the model once per process and reuses it — the checkpoint load
    itself (~0.6s on Apple Silicon MPS in local testing) is the only slow
    one-time cost; each /segment call afterwards only pays for set_image +
    predict."""
    global _predictor, _device
    if _predictor is not None:
        return _predictor

    if not CHECKPOINT_PATH.exists():
        raise RuntimeError(
            f"SAM 2 checkpoint not found at {CHECKPOINT_PATH}. Run `python download_checkpoint.py` first (see README.md)."
        )

    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor

    _device = get_device()
    logger.info("Loading SAM 2 (hiera tiny) on device=%s", _device)
    sam2_model = build_sam2(MODEL_CONFIG, str(CHECKPOINT_PATH), device=_device)
    _predictor = SAM2ImagePredictor(sam2_model)
    logger.info("SAM 2 model ready.")
    return _predictor


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": _predictor is not None, "device": _device or get_device()}


@app.post("/segment")
async def segment(image: UploadFile = File(...), points: str = Form(...)):
    """
    image: the exact garment canvas image (same one the rest of the masking
      pipeline already uses — see GarmentCanvas.tsx's baseCanvasRef), so the
      returned mask is guaranteed to be pixel-aligned with it. No resizing
      happens on the way in.
    points: JSON array of {"x": number, "y": number, "label": 0 | 1}, in
      that same image's own pixel coordinates (the exact numbers
      screenToCanvasPoint already produces client-side for every other
      masking tool). label 1 = "include this" (Add), 0 = "exclude this"
      (Subtract) — SAM 2's own foreground/background point convention.

    Returns the selection mask as a PNG (white = selected, black = not),
    already at the *same* width/height as the input image — SAM 2's
    predictor resizes its own internal low-res logits back to the original
    image size before returning them, so no manual mask resizing/alignment
    is needed here (verified directly against this exact installed
    sam2==1.1.0 build before writing this endpoint).
    """
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image type.")

    try:
        parsed_points = json.loads(points)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid points payload.")

    if not isinstance(parsed_points, list) or not (1 <= len(parsed_points) <= MAX_POINTS):
        raise HTTPException(status_code=400, detail=f"Provide between 1 and {MAX_POINTS} points.")

    for p in parsed_points:
        if not isinstance(p, dict) or "x" not in p or "y" not in p or "label" not in p:
            raise HTTPException(status_code=400, detail="Each point needs x, y, and label.")
        if p["label"] not in (0, 1):
            raise HTTPException(status_code=400, detail="label must be 0 or 1.")

    raw = await image.read()
    try:
        pil_image = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Couldn't read the uploaded image.")

    if max(pil_image.size) > MAX_IMAGE_DIMENSION:
        raise HTTPException(status_code=400, detail="Image is too large for segmentation.")

    width, height = pil_image.size

    try:
        predictor = get_predictor()
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    image_np = np.array(pil_image)
    point_coords = np.array([[p["x"], p["y"]] for p in parsed_points], dtype=np.float32)
    point_labels = np.array([p["label"] for p in parsed_points], dtype=np.int64)
    # A single ambiguous click benefits from multimask_output (SAM's own
    # recommendation — pick the best-scoring of 3 candidates); once the user
    # has added enough points to disambiguate, a single mask is fine either
    # way, so it's simplest to always request multimask and take the best.
    multimask = True

    try:
        with torch.inference_mode():
            predictor.set_image(image_np)
            masks, scores, _ = predictor.predict(
                point_coords=point_coords,
                point_labels=point_labels,
                multimask_output=multimask,
            )
    except Exception:
        logger.exception("SAM 2 inference failed")
        raise HTTPException(status_code=500, detail="Segmentation failed.")

    best_idx = int(np.argmax(scores))
    mask = masks[best_idx]
    score = float(scores[best_idx])

    if mask.shape != (height, width):
        # Should not happen (see docstring), but never silently misalign a
        # mask against the canvas it needs to overlay pixel-for-pixel.
        mask_img = Image.fromarray((mask * 255).astype(np.uint8)).resize((width, height), Image.NEAREST)
    else:
        mask_img = Image.fromarray((mask * 255).astype(np.uint8))

    buf = io.BytesIO()
    mask_img.save(buf, format="PNG")
    mask_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return JSONResponse({"mask_png_base64": mask_b64, "width": width, "height": height, "score": score})
