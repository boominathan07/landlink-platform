#!/usr/bin/env python3

"""
Extract plot number and cents from tabular layout images using PaddleOCR.

Outputs JSON only:
[{plotNumber, cents, needsReview}, ...]
"""

import json
import os
import re
import sys
import traceback
from pathlib import Path

import cv2
import numpy as np

os.environ.setdefault("FLAGS_use_mkldnn", "0")
os.environ.setdefault("PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK", "True")
os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")


def emit_error(message, detail=None):
    payload = {"error": message}
    if detail:
        payload["detail"] = detail
    print(json.dumps(payload), file=sys.stderr, flush=True)


def configure_paddle_home():
    if os.environ.get("PADDLEOCR_HOME"):
        return
    base = os.environ.get("PADDLE_HOME") or os.environ.get("XDG_CACHE_HOME")
    if not base:
        base = "/tmp/paddleocr" if sys.platform != "win32" else os.path.join(
            os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
            "paddleocr",
        )
    cache_root = os.path.join(base, "paddleocr")
    os.makedirs(cache_root, exist_ok=True)
    os.environ["PADDLEOCR_HOME"] = cache_root


HEADER_RE = re.compile(
    r"plot|width|length|area|cent|survey|taluk|village|extent|"
    r"s\.?\s*no|sq\.?\s*m|sq\.?\s*ft|total|taluka",
    re.I,
)


def load_image(image_path):
    img = cv2.imread(str(image_path))

    if img is None:
        from PIL import Image

        pil = Image.open(image_path).convert("RGB")
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    return img


def preprocess_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    denoised = cv2.fastNlMeansDenoising(
        gray,
        None,
        h=8,
        templateWindowSize=7,
        searchWindowSize=21,
    )

    return cv2.cvtColor(denoised, cv2.COLOR_GRAY2BGR)


def parse_ocr_results(result):
    items = []

    if not result:
        return items

    lines = []

    if isinstance(result, list) and result:
        first = result[0]

        if isinstance(first, dict):
            rec_texts = (
                first.get("rec_texts")
                or first.get("texts")
                or []
            )

            rec_boxes = (
                first.get("rec_boxes")
                or first.get("dt_polys")
                or first.get("boxes")
                or []
            )

            for idx, text in enumerate(rec_texts):
                text = str(text or "").strip()

                if not text or HEADER_RE.search(text):
                    continue

                if idx < len(rec_boxes):
                    bbox = rec_boxes[idx]
                else:
                    continue

                lines.append((bbox, (text, 1.0)))

        elif isinstance(first, (list, tuple)):
            lines = first

        else:
            lines = result

    elif isinstance(result, dict):
        rec_texts = (
            result.get("rec_texts")
            or result.get("texts")
            or []
        )

        rec_boxes = (
            result.get("rec_boxes")
            or result.get("dt_polys")
            or result.get("boxes")
            or []
        )

        for idx, text in enumerate(rec_texts):
            text = str(text or "").strip()

            if not text or HEADER_RE.search(text):
                continue

            if idx < len(rec_boxes):
                lines.append((rec_boxes[idx], (text, 1.0)))

    for entry in lines:
        if not entry or len(entry) < 2:
            continue

        bbox = entry[0]
        text_part = entry[1]

        if isinstance(text_part, (list, tuple)):
            text = str(text_part[0] or "").strip()
        else:
            text = str(text_part or "").strip()

        if not text or HEADER_RE.search(text):
            continue

        if hasattr(bbox, "tolist"):
            bbox = bbox.tolist()

        if not bbox:
            continue

        if isinstance(bbox[0], (int, float)):
            xs = [
                float(bbox[0]),
                float(bbox[2]),
            ]

            ys = [
                float(bbox[1]),
                float(bbox[3]),
            ]

        else:
            xs = [float(p[0]) for p in bbox]
            ys = [float(p[1]) for p in bbox]

        items.append(
            {
                "text": text,
                "cx": sum(xs) / len(xs),
                "cy": sum(ys) / len(ys),
                "x_min": min(xs),
                "h": max(ys) - min(ys),
            }
        )

    return items


def group_rows(items):
    if not items:
        return []

    avg_h = (
        sum(item["h"] for item in items) / len(items)
        or 20.0
    )

    tolerance = max(avg_h * 0.55, 10.0)

    sorted_items = sorted(
        items,
        key=lambda item: item["cy"],
    )

    rows = []

    current = [sorted_items[0]]
    current_y = sorted_items[0]["cy"]

    for item in sorted_items[1:]:
        if abs(item["cy"] - current_y) <= tolerance:
            current.append(item)

            current_y = (
                sum(cell["cy"] for cell in current)
                / len(current)
            )

        else:
            rows.append(
                sorted(
                    current,
                    key=lambda cell: cell["cx"],
                )
            )

            current = [item]
            current_y = item["cy"]

    if current:
        rows.append(
            sorted(
                current,
                key=lambda cell: cell["cx"],
            )
        )

    return rows


def parse_plot_number(text):
    if not text:
        return None

    cleaned = re.sub(
        r"[^\d]",
        "",
        str(text).strip(),
    )

    if not cleaned:
        return None

    try:
        value = int(cleaned)
    except ValueError:
        return None

    if value < 1:
        return None

    return str(value)


def parse_cents(text):
    if not text:
        return None

    raw = str(text).strip()

    if "=" in raw:
        raw = raw.split("=")[-1]

    raw = raw.replace(",", ".")

    raw = re.sub(
        r"[^\d.\-+]",
        "",
        raw,
    )

    if not raw or raw in (".", "-", "+"):
        return None

    try:
        value = float(raw)
    except ValueError:
        return None

    if not (1.0 <= value <= 50.0):
        return None

    return round(value, 2)


def extract_row_fields(cells):
    plot_number = None
    cents = None

    for cell in cells:
        candidate = parse_plot_number(
            cell["text"]
        )

        if candidate is not None:
            plot_number = candidate
            break

    cents_candidates = []

    for cell in cells:
        value = parse_cents(
            cell["text"]
        )

        if value is not None:
            cents_candidates.append(
                (cell["cx"], value)
            )

    if cents_candidates:
        cents_candidates.sort(
            key=lambda item: item[0],
            reverse=True,
        )

        cents = cents_candidates[0][1]

    needs_review = (
        plot_number is None
        or cents is None
    )

    return {
        "plotNumber": plot_number,
        "cents": cents,
        "needsReview": needs_review,
    }


def create_paddle_ocr():
    configure_paddle_home()

    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise RuntimeError(
            "paddleocr is not installed. Install backend/requirements-ocr.txt "
            "(paddlepaddle + paddleocr)."
        ) from exc

    kwargs = {
        "use_angle_cls": True,
        "lang": "en",
    }

    try:
        return PaddleOCR(
            show_log=False,
            **kwargs,
        )

    except (TypeError, ValueError):
        try:
            return PaddleOCR(lang="en")
        except (TypeError, ValueError):
            return PaddleOCR(**kwargs)


def run_paddle_ocr(ocr, image):
    try:
        return ocr.ocr(
            image,
            cls=True,
        )

    except TypeError:
        return ocr.predict(image)


def extract_plot_table(image_path):
    img = load_image(image_path)

    processed = preprocess_image(img)

    ocr = create_paddle_ocr()

    result = run_paddle_ocr(
        ocr,
        processed,
    )

    items = parse_ocr_results(result)

    rows = group_rows(items)

    output = []

    for row_cells in rows:
        if len(row_cells) < 2:
            continue

        row = extract_row_fields(
            row_cells
        )

        if (
            row["plotNumber"] is None
            and row["cents"] is None
        ):
            continue

        output.append(row)

    return output


def main():
    if len(sys.argv) < 2:
        emit_error("Missing image path argument")
        sys.exit(1)

    image_path = Path(sys.argv[1]).resolve()

    if not image_path.is_file():
        emit_error(f"Image file not found: {image_path}")
        sys.exit(1)

    try:
        output = extract_plot_table(image_path)
    except Exception as exc:
        emit_error("PaddleOCR plot extraction failed", traceback.format_exc())
        sys.exit(1)

    print(json.dumps(output), flush=True)
    sys.exit(0)


if __name__ == "__main__":
    main()