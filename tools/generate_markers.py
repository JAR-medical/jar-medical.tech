#!/usr/bin/env python3
"""Generate printable ArUco patient markers.

Produces one PNG per marker plus a tiled A4 sheet (300 DPI) ready to print,
laminate and stick on patients instead of paper triage tags.

Usage:
    python tools/generate_markers.py --count 24 --size-mm 40
    python tools/generate_markers.py --ids 1 2 3 --dict DICT_4X4_50
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np

DPI = 300
MM_PER_INCH = 25.4
A4_MM = (210, 297)


def mm_to_px(mm: float) -> int:
    return int(round(mm / MM_PER_INCH * DPI))


def render_marker_tile(dictionary, marker_id: int, size_mm: float) -> np.ndarray:
    """One marker with quiet zone and a human-readable ID label below."""
    marker_px = mm_to_px(size_mm)
    quiet = mm_to_px(5)
    label_h = mm_to_px(8)
    marker = cv2.aruco.generateImageMarker(dictionary, marker_id, marker_px)

    tile_w = marker_px + 2 * quiet
    tile_h = marker_px + 2 * quiet + label_h
    tile = np.full((tile_h, tile_w), 255, dtype=np.uint8)
    tile[quiet:quiet + marker_px, quiet:quiet + marker_px] = marker

    label = f"PAT {marker_id}"
    scale = marker_px / 220.0
    thickness = max(1, int(scale * 2))
    (text_w, text_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, scale, thickness)
    cv2.putText(
        tile, label,
        ((tile_w - text_w) // 2, quiet + marker_px + (label_h + text_h) // 2),
        cv2.FONT_HERSHEY_SIMPLEX, scale, 0, thickness, cv2.LINE_AA,
    )
    # Cut guides as corner crop marks only. A full frame (even light gray)
    # registers as a candidate quad in the ArUco detector and suppresses
    # the marker inside it — crop marks cannot form a closed contour.
    tick = mm_to_px(2)
    for x, dx in ((0, 1), (tile_w - 1, -1)):
        for y, dy in ((0, 1), (tile_h - 1, -1)):
            cv2.line(tile, (x, y), (x + dx * tick, y), 0, 1)
            cv2.line(tile, (x, y), (x, y + dy * tick), 0, 1)
    return tile


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--count", type=int, default=24,
                        help="generate IDs 0..count-1 (ignored if --ids given)")
    parser.add_argument("--ids", type=int, nargs="*", default=None)
    parser.add_argument("--dict", default="DICT_4X4_50")
    parser.add_argument("--size-mm", type=float, default=40.0,
                        help="printed marker edge length in mm")
    parser.add_argument("--out", default="markers_out")
    args = parser.parse_args()

    if not hasattr(cv2.aruco, args.dict):
        raise SystemExit(f"unknown dictionary {args.dict}")
    dictionary = cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, args.dict))
    ids = args.ids if args.ids is not None else list(range(args.count))

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    tiles = []
    for marker_id in ids:
        tile = render_marker_tile(dictionary, marker_id, args.size_mm)
        cv2.imwrite(str(out_dir / f"marker_{marker_id:03d}.png"), tile)
        tiles.append(tile)

    # Tile onto A4 sheets.
    page_w, page_h = mm_to_px(A4_MM[0]), mm_to_px(A4_MM[1])
    margin = mm_to_px(10)
    tile_h, tile_w = tiles[0].shape
    cols = max(1, (page_w - 2 * margin) // tile_w)
    rows = max(1, (page_h - 2 * margin) // tile_h)
    per_page = cols * rows

    for page_idx in range(0, len(tiles), per_page):
        page = np.full((page_h, page_w), 255, dtype=np.uint8)
        for i, tile in enumerate(tiles[page_idx:page_idx + per_page]):
            r, c = divmod(i, cols)
            y, x = margin + r * tile_h, margin + c * tile_w
            page[y:y + tile_h, x:x + tile_w] = tile
        sheet = out_dir / f"sheet_{page_idx // per_page + 1}.png"
        cv2.imwrite(str(sheet), page)
        print(f"wrote {sheet}")

    print(f"{len(tiles)} markers in {out_dir}/ — print at 300 DPI, do not scale")


if __name__ == "__main__":
    main()
