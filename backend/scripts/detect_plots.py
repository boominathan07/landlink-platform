#!/usr/bin/env python3
"""
Plot Layout Auto-Detection with OCR.
Uses: opencv-python, pytesseract, Pillow, numpy, requests
"""
import json
import re
import sys

import cv2
import numpy as np
import requests
import pytesseract
from PIL import Image
from io import BytesIO
from pathlib import Path


def download_image(url):
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    img_array = np.frombuffer(response.content, np.uint8)
    img = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
    if img is None:
        pil = Image.open(BytesIO(response.content)).convert('RGB')
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


def load_image(source):
    if source.startswith(('http://', 'https://')):
        return download_image(source)
    path = Path(source)
    if not path.exists():
        raise FileNotFoundError(f'Image not found: {source}')
    img = cv2.imread(str(path))
    if img is None:
        pil = Image.open(path).convert('RGB')
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


def preprocess_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    kernel = np.ones((3, 3), np.uint8)
    closed = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel, iterations=2)
    return closed


def ocr_region(img, x, y, w, h):
    pad = 10
    h_img, w_img = img.shape[:2]
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(w_img, x + w + pad)
    y2 = min(h_img, y + h + pad)
    region = img[y1:y2, x1:x2]
    if region.size == 0:
        return ''
    pil_img = Image.fromarray(cv2.cvtColor(region, cv2.COLOR_BGR2RGB))
    pil_img = pil_img.resize((max(pil_img.width * 3, 30), max(pil_img.height * 3, 30)), Image.LANCZOS)
    config = '--psm 6 --oem 3 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-. '
    text = pytesseract.image_to_string(pil_img, config=config).strip()
    return re.sub(r'\s+', ' ', text).strip()


def extract_plot_number(text):
    if not text:
        return None
    patterns = [
        r'\b([A-Z]?-?\d{1,4})\b',
        r'\bPlot\s*(\w+)\b',
        r'\b([A-Z]\d{1,3})\b',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def extract_area_from_text(text):
    area_patterns = [
        r'(\d+)\s*[xX\*]\s*(\d+)',
        r'(\d+\.?\d*)\s*(?:sqft|sq\.ft|sft|sqm)',
        r'(\d+\.?\d*)\s*(?:Sq|SQ)',
    ]
    for pattern in area_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            if 'x' in pattern.lower() or '*' in pattern.lower():
                try:
                    return f"{match.group(1)}x{match.group(2)} ft"
                except Exception:
                    pass
            else:
                return f"{match.group(1)} sqft"
    return None


def detect_plots(image_source):
    print(f"Starting detection for: {image_source}", file=sys.stderr)
    img = load_image(image_source)
    if img is None:
        return {"success": False, "error": "Failed to load image", "plots": []}

    orig_img = img.copy()
    h_orig, w_orig = img.shape[:2]
    processed = preprocess_image(img)

    contours, _ = cv2.findContours(processed, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return {"success": False, "error": "No contours found in image", "plots": []}

    img_area = h_orig * w_orig
    min_area = img_area * 0.003
    max_area = img_area * 0.3

    plots = []
    plot_counter = 1
    seen_regions = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area > max_area:
            continue

        x, y, w, h = cv2.boundingRect(contour)
        aspect_ratio = w / h if h > 0 else 0
        if aspect_ratio > 8 or aspect_ratio < 0.1:
            continue

        is_duplicate = False
        for seen_x, seen_y, seen_w, seen_h in seen_regions:
            overlap_x = max(0, min(x + w, seen_x + seen_w) - max(x, seen_x))
            overlap_y = max(0, min(y + h, seen_y + seen_h) - max(y, seen_y))
            overlap = overlap_x * overlap_y
            if overlap > 0.6 * w * h:
                is_duplicate = True
                break

        if is_duplicate:
            continue

        seen_regions.append((x, y, w, h))
        region_text = ocr_region(orig_img, x, y, w, h)
        plot_number = extract_plot_number(region_text)
        area_text = extract_area_from_text(region_text)

        if not plot_number:
            plot_number = str(plot_counter)

        x_pct = round((x / w_orig) * 100, 4)
        y_pct = round((y / h_orig) * 100, 4)
        w_pct = round((w / w_orig) * 100, 4)
        h_pct = round((h / h_orig) * 100, 4)

        plot = {
            "plotId": f"plot_{plot_counter}",
            "plotNumber": plot_number,
            "label": f"Plot {plot_number}",
            "rawText": region_text,
            "extractedArea": area_text,
            "x": x_pct,
            "y": y_pct,
            "width": w_pct,
            "height": h_pct,
            "coordinates": {
                "x": x_pct,
                "y": y_pct,
                "width": w_pct,
                "height": h_pct,
            },
            "percentBounds": {
                "x": x_pct,
                "y": y_pct,
                "w": w_pct,
                "h": h_pct,
            },
            "pixelArea": round(area),
            "status": "available",
        }
        plots.append(plot)
        plot_counter += 1

    plots.sort(key=lambda p: (round(p['percentBounds']['y'] / 5) * 5, p['percentBounds']['x']))

    print(f"Detected {len(plots)} plots", file=sys.stderr)
    return {
        "success": True,
        "plotCount": len(plots),
        "plots": plots,
        "count": len(plots),
        "width": w_orig,
        "height": h_orig,
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No image URL provided", "plots": []}))
        sys.exit(1)

    image_url = sys.argv[1]
    try:
        result = detect_plots(image_url)
        if not result.get('plots'):
            result['success'] = False
            result['error'] = result.get('error') or 'No plots detected'
        print(json.dumps(result))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc), "plots": []}))
        sys.exit(1)
