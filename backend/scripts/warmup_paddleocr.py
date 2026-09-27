#!/usr/bin/env python3
"""Download/load PaddleOCR models during Render build (or manual warmup)."""

import os
import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parents[1]
cache_dir = backend_dir / ".paddleocr"
cache_dir.mkdir(parents=True, exist_ok=True)

os.environ["PADDLEOCR_HOME"] = str(cache_dir)
os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

try:
    from paddleocr import PaddleOCR
except ImportError as exc:
    print(f"PaddleOCR import failed: {exc}", file=sys.stderr)
    sys.exit(1)

try:
    PaddleOCR(lang="en", use_angle_cls=True)
except TypeError:
    PaddleOCR(lang="en")

print(f"PaddleOCR models ready in {cache_dir}", flush=True)
