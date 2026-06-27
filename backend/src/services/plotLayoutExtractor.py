"""
Extract plot layout data from images or tabular files.
Uses: Pillow, OpenCV, NumPy, Pandas, Matplotlib, Shapely
"""
import json
import re
import sys
from pathlib import Path

import cv2
import numpy as np
import pandas as pd
from PIL import Image
from shapely.geometry import box


def normalize_status(raw):
    val = str(raw or 'available').strip().lower()
    mapping = {
        'available': 'available',
        'avail': 'available',
        'sold': 'sold',
        'reserved': 'hold',
        'hold': 'hold',
        'booked': 'booked',
        'under construction': 'booked',
        'construction': 'booked',
    }
    return mapping.get(val, 'available')


def extract_from_dataframe(df):
    cols = {c.lower().strip(): c for c in df.columns}
    plot_col = next((cols[k] for k in cols if 'plot' in k or k in ('no', 'number', 'id')), None)
    if not plot_col:
        plot_col = df.columns[0]

    plots = []
    n = len(df)
    cols_count = max(1, int(np.ceil(np.sqrt(n))))

    for idx, row in df.iterrows():
        plot_num = str(row[plot_col]).strip()
        if not plot_num or plot_num.lower() in ('nan', 'none'):
            continue

        width = None
        length = None
        area = None
        cents = None
        status = 'available'

        for key, col in cols.items():
            if 'width' in key:
                width = float(row[col]) if pd.notna(row[col]) else None
            elif 'length' in key or 'depth' in key:
                length = float(row[col]) if pd.notna(row[col]) else None
            elif 'area' in key:
                area = float(row[col]) if pd.notna(row[col]) else None
            elif 'cent' in key:
                cents = float(row[col]) if pd.notna(row[col]) else None
            elif 'status' in key:
                status = normalize_status(row[col])

        row_i = idx // cols_count
        col_i = idx % cols_count
        cell_w = 100 / cols_count
        cell_h = 100 / max(1, int(np.ceil(n / cols_count)))

        plots.append({
            'plotId': f'plot-{plot_num}',
            'plotNumber': plot_num,
            'coordinates': {
                'x': col_i * cell_w,
                'y': row_i * cell_h,
                'width': cell_w * 0.9,
                'height': cell_h * 0.9,
            },
            'size': {
                'widthMeters': width,
                'lengthMeters': length,
                'areaSqFeet': area,
                'cents': cents,
            },
            'status': status,
            'owner': None,
        })

    return plots


def extract_from_tabular(path):
    ext = Path(path).suffix.lower()
    if ext == '.json':
        data = json.loads(Path(path).read_text(encoding='utf-8'))
        if isinstance(data, list):
            return data
        return data.get('plots', [])
    if ext in ('.csv', '.txt'):
        df = pd.read_csv(path)
        return extract_from_dataframe(df)
    if ext in ('.xlsx', '.xls'):
        df = pd.read_excel(path)
        return extract_from_dataframe(df)
    raise ValueError(f'Unsupported data file: {ext}')


def extract_from_image(path):
    img = cv2.imread(str(path))
    if img is None:
        pil = Image.open(path).convert('RGB')
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel, iterations=2)
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    min_area = (w * h) * 0.00005
    max_area = (w * h) * 0.08
    candidates = []

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        if bw < 8 or bh < 8:
            continue
        candidates.append((x, y, bw, bh, area))

    candidates.sort(key=lambda c: (c[1] // 20, c[0]))

    plots = []
    for i, (x, y, bw, bh, _area) in enumerate(candidates[:500]):
        poly = box(x, y, x + bw, y + bh)
        plot_num = str(i + 1)
        plots.append({
            'plotId': f'plot-{plot_num}',
            'plotNumber': plot_num,
            'coordinates': {
                'x': (x / w) * 100,
                'y': (y / h) * 100,
                'width': (bw / w) * 100,
                'height': (bh / h) * 100,
            },
            'polygon': [[px, py] for px, py in poly.exterior.coords],
            'size': {},
            'status': 'available',
            'owner': None,
        })

    return plots


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'Usage: plotLayoutExtractor.py <file_path>'}))
        sys.exit(1)

    path = sys.argv[1]
    ext = Path(path).suffix.lower()

    try:
        if ext in ('.csv', '.xlsx', '.xls', '.json', '.txt'):
            plots = extract_from_tabular(path)
        else:
            plots = extract_from_image(path)

        print(json.dumps({'success': True, 'plots': plots, 'count': len(plots)}))
    except Exception as exc:
        print(json.dumps({'success': False, 'error': str(exc), 'plots': []}))
        sys.exit(1)


if __name__ == '__main__':
    main()
