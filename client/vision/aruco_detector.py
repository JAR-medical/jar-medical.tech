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
    """Default dictionary is AprilTag 36h11: 36 payload bits with Hamming
    distance 11 between codes, so random scene texture essentially cannot
    decode to a valid ID — unlike 4x4 ArUco (16 bits), which produces
    persistent phantom IDs from noise. 4x4 remains available via CLI flag
    for legacy printed sheets."""

    def __init__(self, dict_name: str = "DICT_APRILTAG_36h11", min_size_px: float = 18.0) -> None:
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
        # Default error correction (0.6) fixes many bit errors — and thereby
        # also *invents* IDs from noise squares. Patient identity must be
        # high-precision, so accept far fewer corrected bits and instead rely
        # on temporal confirmation (AnchorManager) for recall.
        params.errorCorrectionRate = 0.2
        self._detector = cv2.aruco.ArucoDetector(dictionary, params)
        # Below this apparent size the 4x4 grid sits on <3 px per cell and
        # decoding is guesswork — reject outright.
        self._min_size_px = min_size_px

    def detect(self, gray: np.ndarray) -> list[MarkerDetection]:
        corners, ids, _rejected = self._detector.detectMarkers(gray)
        if ids is None:
            return []
        detections: list[MarkerDetection] = []
        for marker_corners, marker_id in zip(corners, ids.flatten()):
            pts = marker_corners.reshape(4, 2).astype(np.float32)
            center = pts.mean(axis=0)
            edges = np.linalg.norm(np.roll(pts, -1, axis=0) - pts, axis=1)
            size = float(edges.mean())
            if size < self._min_size_px:
                continue
            # Wildly uneven edges = a noise quad that happened to decode;
            # a real (near-planar) marker keeps edges within ~3x of each other.
            if float(edges.max()) > 3.0 * max(1e-6, float(edges.min())):
                continue
            detections.append(
                MarkerDetection(
                    marker_id=int(marker_id),
                    corners=pts,
                    center=(float(center[0]), float(center[1])),
                    size_px=size,
                )
            )
        return detections
