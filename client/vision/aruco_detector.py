"""Fast ArUco marker detection.

Small markers on patients, detected at camera frame rate. Uses OpenCV's
ArucoDetector with corner refinement tuned for small marker sizes at
distance (the marker may only be 20–40 px across in the glasses' view).
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class MarkerDetection:
    marker_id: int
    corners: np.ndarray      # (4, 2) float32, pixel coordinates, clockwise
    center: tuple[float, float]
    size_px: float           # mean edge length — proxy for distance


class ArucoDetector:
    def __init__(self, dict_name: str = "DICT_4X4_50") -> None:
        if not hasattr(cv2.aruco, dict_name):
            raise ValueError(f"unknown ArUco dictionary: {dict_name}")
        dictionary = cv2.aruco.getPredefinedDictionary(getattr(cv2.aruco, dict_name))
        params = cv2.aruco.DetectorParameters()
        # Subpixel corner refinement stabilizes the anchor and gives the
        # optical-flow fallback precise seed points.
        params.cornerRefinementMethod = cv2.aruco.CORNER_REFINE_SUBPIX
        # Allow very small candidate contours — patient markers are small.
        params.minMarkerPerimeterRate = 0.01
        params.adaptiveThreshWinSizeMin = 3
        params.adaptiveThreshWinSizeMax = 33
        params.adaptiveThreshWinSizeStep = 6
        self._detector = cv2.aruco.ArucoDetector(dictionary, params)

    def detect(self, gray: np.ndarray) -> list[MarkerDetection]:
        corners, ids, _rejected = self._detector.detectMarkers(gray)
        if ids is None:
            return []
        detections: list[MarkerDetection] = []
        for marker_corners, marker_id in zip(corners, ids.flatten()):
            pts = marker_corners.reshape(4, 2).astype(np.float32)
            center = pts.mean(axis=0)
            edges = np.linalg.norm(np.roll(pts, -1, axis=0) - pts, axis=1)
            detections.append(
                MarkerDetection(
                    marker_id=int(marker_id),
                    corners=pts,
                    center=(float(center[0]), float(center[1])),
                    size_px=float(edges.mean()),
                )
            )
        return detections
