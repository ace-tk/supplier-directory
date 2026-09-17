"""One-time setup: downloads the official Meta SAM 2.1 (tiny) checkpoint
directly from Meta's own hosting — the same file/URL Meta's own sam2 repo
downloads in checkpoints/download_ckpts.sh. No account, API key, or paid
service involved; this is a public, free, open-source model checkpoint.

Run once after `pip install -r requirements.txt`:
    python download_checkpoint.py
"""

import sys
import urllib.request
from pathlib import Path

CHECKPOINT_DIR = Path(__file__).parent / "checkpoints"
CHECKPOINT_URL = "https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt"
CHECKPOINT_PATH = CHECKPOINT_DIR / "sam2.1_hiera_tiny.pt"
EXPECTED_MIN_BYTES = 100_000_000  # the real file is ~156MB; catches a truncated/failed download


def main() -> int:
    if CHECKPOINT_PATH.exists() and CHECKPOINT_PATH.stat().st_size >= EXPECTED_MIN_BYTES:
        print(f"Checkpoint already present at {CHECKPOINT_PATH} ({CHECKPOINT_PATH.stat().st_size:,} bytes) — nothing to do.")
        return 0

    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Downloading SAM 2.1 (tiny) checkpoint (~156MB) from {CHECKPOINT_URL} ...")

    def progress(block_num: int, block_size: int, total_size: int) -> None:
        downloaded = block_num * block_size
        pct = min(100, downloaded * 100 // total_size) if total_size > 0 else 0
        print(f"\r  {pct}% ({downloaded:,} / {total_size:,} bytes)", end="", flush=True)

    tmp_path = CHECKPOINT_PATH.with_suffix(".pt.partial")
    try:
        urllib.request.urlretrieve(CHECKPOINT_URL, tmp_path, reporthook=progress)
        print()
    except Exception as exc:
        print(f"\nDownload failed: {exc}", file=sys.stderr)
        tmp_path.unlink(missing_ok=True)
        return 1

    if tmp_path.stat().st_size < EXPECTED_MIN_BYTES:
        print("Downloaded file is smaller than expected — likely a truncated/failed download.", file=sys.stderr)
        tmp_path.unlink(missing_ok=True)
        return 1

    tmp_path.rename(CHECKPOINT_PATH)
    print(f"Saved to {CHECKPOINT_PATH} ({CHECKPOINT_PATH.stat().st_size:,} bytes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
