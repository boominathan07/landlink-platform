"""
LandLink layout table OCR — EasyOCR row clustering + per-row field extraction.
Each plot gets unique width/length/area/cent parsed from its table row.
"""
import json
import re
import sys
import time
import gc
from pathlib import Path

import cv2
import numpy as np

gc.collect()

HEADER_WORDS = re.compile(
    r"plot|width|length|area|cent|survey|taluk|village|extent|s\.?\s*no|sq\.?\s*m|sq\.?\s*ft|total|taluka",
    re.I,
)


def parse_numeric_cell(text):
    if not text:
        return None
    raw = str(text).strip()
    if "=" in raw:
        raw = raw.split("=")[-1]
    raw = raw.replace(",", ".")
    raw = re.sub(r"[^\d.\-+]", "", raw)
    if not raw or raw in (".", "-", "+"):
        return None
    try:
        val = float(raw)
        return val if val == val else None  # NaN check
    except ValueError:
        return None


def parse_length_cell(text):
    if not text:
        return None
    raw = str(text).strip()
    if "=" in raw:
        val = parse_numeric_cell(raw.split("=")[-1])
        if val is not None and 10 <= val <= 25:
            return val
    nums = [float(m) for m in re.findall(r"\d+\.?\d*", raw)]
    candidates = [v for v in nums if 10 <= v <= 25]
    if candidates:
        return candidates[-1]
    return parse_numeric_cell(raw)


def normalize_plot_number(text):
    if not text:
        return None
    cleaned = re.sub(r"[^\d]", "", str(text).strip())
    if not cleaned:
        return None
    num = int(cleaned)
    if num < 1 or num > 200:
        return None
    return num


def round_to(value, decimals):
    return round(float(value), decimals)


def build_plot_from_parts(plot_num, numbers, length_raw=None):
    if len(numbers) < 3:
        return None

    width_m = numbers[0]
    length_m = parse_length_cell(length_raw) if length_raw else numbers[1]
    if length_m is None:
        return None

    area_sqm = None
    area_sqft = None
    cent = None
    rest = numbers[1:] if length_raw else numbers[2:]

    if len(rest) >= 3:
        area_sqm = rest[0] if rest[0] < 500 else None
        area_sqft = next((n for n in rest if n >= 500), rest[1] if len(rest) > 1 else None)
        cent = rest[-1] if rest[-1] < 10 else rest[2] if len(rest) > 2 else None
    elif len(rest) == 2:
        if rest[0] >= 500:
            area_sqft = rest[0]
            cent = rest[1]
        else:
            area_sqm = rest[0]
            area_sqft = rest[1]
    elif len(rest) == 1:
        area_sqft = rest[0] if rest[0] >= 500 else rest[0] * 10.7639

    if area_sqft is None and area_sqm is not None:
        area_sqft = round_to(area_sqm * 10.7639, 2)
    if area_sqm is None and area_sqft is not None:
        area_sqm = round_to(area_sqft / 10.7639, 2)
    if cent is None and area_sqft is not None:
        cent = round_to(area_sqft / 435.6, 2)

    return {
        "plot_number": str(plot_num),
        "plotNumber": str(plot_num),
        "width_m": width_m,
        "widthMeters": width_m,
        "width": width_m,
        "length_m": length_m,
        "lengthMeters": length_m,
        "length": length_m,
        "area_sqm": area_sqm,
        "areaSqMeters": area_sqm,
        "area_sqft": area_sqft,
        "areaSqFeet": area_sqft,
        "area": area_sqft,
        "cent": cent,
        "cents": cent,
    }


def validate_plot(plot, strict_ratio=True):
    w = plot.get("width_m") or plot.get("widthMeters")
    l = plot.get("length_m") or plot.get("lengthMeters")
    area_sqft = plot.get("area_sqft") or plot.get("areaSqFeet")
    cent = plot.get("cent") or plot.get("cents")
    plot_num = int(plot.get("plot_number") or plot.get("plotNumber") or 0)
    area_sqm = plot.get("area_sqm") or plot.get("areaSqMeters")
    if area_sqm is None and area_sqft:
        area_sqm = area_sqft / 10.7639

    if not all(isinstance(v, (int, float)) for v in [w, l, area_sqft, cent]):
        return False
    if w < 4 or w > 20 or l < 8 or l > 30:
        return False
    if area_sqft < 1000 or area_sqft > 4000:
        return False
    if cent < 1 or cent > 8:
        return False

    if strict_ratio and area_sqm and w and l:
        expected = w * l
        if expected > 0:
            ratio = area_sqm / expected
            if ratio < 0.45 or ratio > 1.55:
                return False

    if plot_num > 35 and area_sqft < 1600 and w < 10:
        return False
    if plot_num > 60:
        return False
    return True


def parse_line_regex(line):
    clean = line.strip()
    if not clean or HEADER_WORDS.search(clean):
        return None
    m = re.match(
        r"^(\d{1,3})\s+(\d+\.?\d*)\s+(.+?)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s*$",
        clean,
    )
    if not m:
        return None
    plot_num = normalize_plot_number(m.group(1))
    if plot_num is None:
        return None
    numbers = [
        parse_numeric_cell(m.group(2)),
        parse_numeric_cell(m.group(4)),
        parse_numeric_cell(m.group(5)),
        parse_numeric_cell(m.group(6)),
    ]
    numbers = [n for n in numbers if n is not None]
    return build_plot_from_parts(plot_num, [parse_numeric_cell(m.group(2)), *numbers], m.group(3))


def preprocess_image(image_path):
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]
    target_w = 3000
    if w < target_w:
        scale = target_w / w
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)
    gray = cv2.fastNlMeansDenoising(gray, None, h=8, templateWindowSize=7, searchWindowSize=21)
    bgr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)

    h2, w2 = gray.shape
    y0 = int(h2 * 0.08)
    y1 = int(h2 * 0.98)
    x0 = int(w2 * 0.01)
    x1 = int(w2 * 0.99)
    return bgr[y0:y1, x0:x1], gray[y0:y1, x0:x1]


def ocr_items_from_results(results):
    items = []
    for bbox, text, conf in results:
        text = (text or "").strip()
        if not text or HEADER_WORDS.search(text):
            continue
        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]
        items.append({
            "cx": sum(xs) / len(xs),
            "cy": sum(ys) / len(ys),
            "text": text,
            "conf": float(conf),
            "h": max(ys) - min(ys),
        })
    return items


def cluster_rows(items, tolerance=None):
    if not items:
        return []
    avg_h = sum(i["h"] for i in items) / len(items) or 20
    tol = tolerance or max(avg_h * 0.6, 12)
    sorted_items = sorted(items, key=lambda i: i["cy"])
    rows = []
    current = [sorted_items[0]]
    current_y = sorted_items[0]["cy"]

    for item in sorted_items[1:]:
        if abs(item["cy"] - current_y) <= tol:
            current.append(item)
            current_y = sum(i["cy"] for i in current) / len(current)
        else:
            rows.append(sorted(current, key=lambda i: i["cx"]))
            current = [item]
            current_y = item["cy"]
    if current:
        rows.append(sorted(current, key=lambda i: i["cx"]))
    return rows


def parse_row_from_cells(cells):
    """Parse a table row from left-to-right OCR cells."""
    if len(cells) < 4:
        return None

    plot_num = normalize_plot_number(cells[0]["text"])
    if plot_num is None:
        return None

    nums = []
    length_raw = None
    for i, cell in enumerate(cells[1:], start=1):
        val = parse_numeric_cell(cell["text"])
        if val is not None:
            nums.append(val)
        elif i == 2 and re.search(r"\d", cell["text"]):
            length_raw = cell["text"]

    if len(nums) < 3:
        line = " ".join(c["text"] for c in cells)
        parsed = parse_line_regex(line)
        if parsed:
            return parsed
        return None

    width = nums[0]
    rest = nums[1:]
    return build_plot_from_parts(plot_num, [width, *rest], length_raw)


def dedupe_plots(plots):
    by_num = {}
    for plot in plots:
        key = str(plot.get("plot_number") or plot.get("plotNumber"))
        by_num[key] = plot
    return sorted(by_num.values(), key=lambda p: int(p.get("plot_number") or p.get("plotNumber") or 0))


def run_ocr(image_path):
    start = time.time()
    gc.collect()

    try:
        import easyocr
    except ImportError:
        return {"success": False, "error": "easyocr is not installed"}

    reader = easyocr.Reader(["en"], gpu=False, verbose=False)
    bgr, _gray = preprocess_image(image_path)
    results = reader.readtext(bgr, paragraph=False, detail=1)
    items = ocr_items_from_results(results)
    rows = cluster_rows(items)

    plots = []
    for row in rows:
        plot = parse_row_from_cells(row)
        if plot and (validate_plot(plot, False) or validate_plot(plot, True)):
            plots.append(plot)

    # Fallback: join each row as text line
    if len(plots) < 2:
        for row in rows:
            line = " ".join(c["text"] for c in row)
            plot = parse_line_regex(line)
            if plot and (validate_plot(plot, False) or validate_plot(plot, True)):
                plots.append(plot)

    del reader
    gc.collect()

    unique_plots = dedupe_plots(plots)
    elapsed = round(time.time() - start, 2)

    if len(unique_plots) >= 2:
        return {
            "success": True,
            "total_plots": len(unique_plots),
            "plots": unique_plots,
            "processing_time": elapsed,
            "engine": "easyocr-row-parser",
            "source_image": str(image_path),
        }

    return {
        "success": False,
        "error": "Could not parse plot table rows. Ensure the image shows a clear tabular layout with plot numbers, width, length, area, and cent columns.",
        "processing_time": elapsed,
        "rows_detected": len(rows),
    }


if __name__ == "__main__":
    sys.stdout.flush()

    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image path provided"}))
        sys.exit(1)

    image = Path(sys.argv[1])
    if not image.exists():
        print(json.dumps({"success": False, "error": f"Image not found: {image}"}))
        sys.exit(1)

    result = run_ocr(image)
    print(json.dumps(result))
    sys.stdout.flush()
