"""Occlusion-robust patient anchoring.

The core AR problem this solves: a paramedic kneels down to treat the
patient, their hands (or the patient's clothing) cover the ArUco marker,
or the marker drifts out of the camera's field of view — yet the overlay
must stay spatially attached to the patient.

Strategy — a per-patient state machine:

  LOCKED    marker positively detected this frame. The anchor position is
            the marker itself. Every LOCKED frame refreshes a set of
            Shi-Tomasi feature points sampled from the patient region
            around the marker (torso-scale ROI, not just the marker), so
            the fallback always has fresh, valid texture to hold on to.

  COASTING  marker not detected. The anchor is carried by Lucas-Kanade
            optical flow on the feature points with forward-backward
            verification; the anchor moves with the median flow of the
            surviving points. Survives partial occlusion (points on the
            patient keep tracking) and marker occlusion by hands.

  LOST      flow degenerated (too few consistent points) or the marker
            has not been re-verified within `coast_timeout_s`. The overlay
            is dropped rather than shown at a stale/wrong position —
            showing SK I data floating over the wrong patient is a
            patient-safety hazard, so we fail closed.

Re-detection of the marker at any time snaps the anchor back to LOCKED
(and re-verifies patient identity, since only the marker carries identity).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

import cv2
import numpy as np

from .aruco_detector import MarkerDetection

_LK_PARAMS = dict(
    winSize=(21, 21),
    maxLevel=3,
    criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01),
)
_MIN_TRACK_POINTS = 4
_FB_ERROR_MAX_PX = 1.5          # forward-backward consistency gate
_MAX_FEATURES = 60
_ROI_SCALE = 4.0                # feature ROI = marker size × this (patient area)


class AnchorState(str, Enum):
    LOCKED = "LOCKED"
    COASTING = "COASTING"
    LOST = "LOST"


class AnchorEventType(str, Enum):
    ACQUIRED = "ACQUIRED"          # marker confirmed for the first time
    REACQUIRED = "REACQUIRED"      # marker verified again after coasting/loss
    COASTING = "COASTING"          # marker occluded, flow tracking took over
    MOVED = "MOVED"                # position update while tracked
    LOST = "LOST"                  # anchor dropped (fail-closed)
    CANDIDATE = "CANDIDATE"        # detection awaiting temporal confirmation


@dataclass
class AnchorEvent:
    type: AnchorEventType
    marker_id: int
    center: tuple[float, float]
    state: AnchorState
    size_px: float = 0.0
    coast_time_s: float = 0.0


@dataclass
class _Anchor:
    marker_id: int
    state: AnchorState = AnchorState.LOST
    center: np.ndarray = field(default_factory=lambda: np.zeros(2, dtype=np.float32))
    size_px: float = 0.0
    points: Optional[np.ndarray] = None       # (N, 1, 2) float32 feature points
    point_offsets: Optional[np.ndarray] = None  # points relative to center
    last_marker_seen: float = 0.0


class AnchorManager:
    def __init__(
        self,
        coast_timeout_s: float = 8.0,
        confirm_frames: int = 3,
        miss_grace_s: float = 0.5,
    ) -> None:
        self._coast_timeout = coast_timeout_s
        # A marker ID must be detected `confirm_frames` times within a short
        # sliding window before it becomes an anchor (or revives a LOST one).
        # Sliding window instead of strictly consecutive frames: a genuine
        # marker at distance often decodes only every 2nd/3rd frame, while a
        # noise misread virtually never repeats the same ID several times
        # within a second.
        self._confirm_frames = confirm_frames
        self._confirm_window_s = 1.0
        # Detection dropouts shorter than this stay silently LOCKED (the
        # anchor coasts internally) instead of spamming COASTING/REACQUIRED
        # transitions on every flickering frame.
        self._miss_grace = miss_grace_s
        self._anchors: dict[int, _Anchor] = {}
        self._pending: dict[int, list[float]] = {}  # id -> recent sighting times
        self._prev_gray: Optional[np.ndarray] = None

    @property
    def anchors(self) -> dict[int, _Anchor]:
        return self._anchors

    def active_anchors(self) -> list[_Anchor]:
        return [a for a in self._anchors.values() if a.state != AnchorState.LOST]

    def process_frame(
        self, gray: np.ndarray, detections: list[MarkerDetection]
    ) -> list[AnchorEvent]:
        now = time.monotonic()
        events: list[AnchorEvent] = []
        detected_ids = {d.marker_id for d in detections}

        for det in detections:
            anchor = self._anchors.get(det.marker_id)
            is_new = anchor is None
            was_lost = anchor is not None and anchor.state == AnchorState.LOST

            if is_new or was_lost:
                sightings = self._pending.setdefault(det.marker_id, [])
                sightings.append(now)
                cutoff = now - self._confirm_window_s
                self._pending[det.marker_id] = sightings = [
                    t for t in sightings if t >= cutoff
                ]
                if len(sightings) < self._confirm_frames:
                    # Not confirmed yet — surface as candidate so the UI can
                    # show that the misread filter is doing its job.
                    events.append(AnchorEvent(
                        type=AnchorEventType.CANDIDATE,
                        marker_id=det.marker_id,
                        center=det.center,
                        state=AnchorState.LOST,
                        size_px=det.size_px,
                    ))
                    continue
                self._pending.pop(det.marker_id, None)
                if is_new:
                    anchor = _Anchor(marker_id=det.marker_id)
                    self._anchors[det.marker_id] = anchor
                    event_type = AnchorEventType.ACQUIRED
                else:
                    event_type = AnchorEventType.REACQUIRED
            elif anchor.state == AnchorState.COASTING:
                event_type = AnchorEventType.REACQUIRED
            else:
                event_type = AnchorEventType.MOVED

            coast_time = now - anchor.last_marker_seen if not is_new else 0.0
            anchor.center = np.array(det.center, dtype=np.float32)
            anchor.size_px = det.size_px
            anchor.state = AnchorState.LOCKED
            anchor.last_marker_seen = now
            self._refresh_features(gray, anchor, det)
            events.append(self._event(event_type, anchor, coast_time))

        # Markers not detected this frame: coast on optical flow.
        for anchor in self._anchors.values():
            if anchor.marker_id in detected_ids or anchor.state == AnchorState.LOST:
                continue
            coast_time = now - anchor.last_marker_seen
            if coast_time > self._coast_timeout:
                self._drop(anchor, events, coast_time)
                continue
            moved = self._coast(gray, anchor)
            in_grace = coast_time < self._miss_grace
            if not moved:
                # Within the grace window a failed flow step is forgiven —
                # the marker usually reappears next frame. Beyond it, drop.
                if not in_grace:
                    self._drop(anchor, events, coast_time)
                continue
            if in_grace:
                continue  # silent internal coasting; no state transition yet
            if anchor.state == AnchorState.LOCKED:
                anchor.state = AnchorState.COASTING
                events.append(self._event(AnchorEventType.COASTING, anchor, coast_time))
            else:
                events.append(self._event(AnchorEventType.MOVED, anchor, coast_time))

        # Forget stale candidates (phantom ids that stopped appearing).
        stale_cutoff = now - 4 * self._confirm_window_s
        self._pending = {
            mid: times for mid, times in self._pending.items()
            if times and times[-1] >= stale_cutoff
        }

        self._prev_gray = gray
        return events

    # ----------------------------------------------------------- internals

    def _refresh_features(
        self, gray: np.ndarray, anchor: _Anchor, det: MarkerDetection
    ) -> None:
        """Sample trackable texture from the patient region around the marker."""
        h, w = gray.shape[:2]
        half = det.size_px * _ROI_SCALE / 2.0
        cx, cy = det.center
        x0, y0 = max(0, int(cx - half)), max(0, int(cy - half))
        x1, y1 = min(w, int(cx + half)), min(h, int(cy + half))
        if x1 - x0 < 8 or y1 - y0 < 8:
            anchor.points = det.corners.reshape(-1, 1, 2).copy()
        else:
            mask = np.zeros_like(gray)
            mask[y0:y1, x0:x1] = 255
            found = cv2.goodFeaturesToTrack(
                gray, maxCorners=_MAX_FEATURES, qualityLevel=0.01,
                minDistance=7, mask=mask,
            )
            corner_pts = det.corners.reshape(-1, 1, 2)
            anchor.points = (
                np.vstack([corner_pts, found.astype(np.float32)])
                if found is not None else corner_pts.copy()
            )
        anchor.point_offsets = anchor.points.reshape(-1, 2) - anchor.center

    def _coast(self, gray: np.ndarray, anchor: _Anchor) -> bool:
        """Advance the anchor by median optical flow. Returns False if the
        track degenerated and the anchor can no longer be trusted."""
        if (
            self._prev_gray is None
            or anchor.points is None
            or len(anchor.points) < _MIN_TRACK_POINTS
        ):
            return False

        new_pts, status, _err = cv2.calcOpticalFlowPyrLK(
            self._prev_gray, gray, anchor.points, None, **_LK_PARAMS
        )
        if new_pts is None:
            return False
        # Forward-backward check: track back and keep only consistent points.
        back_pts, back_status, _ = cv2.calcOpticalFlowPyrLK(
            gray, self._prev_gray, new_pts, None, **_LK_PARAMS
        )
        fb_error = np.linalg.norm(
            (anchor.points - back_pts).reshape(-1, 2), axis=1
        )
        good = (
            (status.flatten() == 1)
            & (back_status.flatten() == 1)
            & (fb_error < _FB_ERROR_MAX_PX)
        )
        if int(good.sum()) < _MIN_TRACK_POINTS:
            return False

        kept_new = new_pts.reshape(-1, 2)[good]
        kept_offsets = anchor.point_offsets[good] if anchor.point_offsets is not None else None
        # Median of per-point anchor estimates → robust to points that
        # latched onto the occluder (e.g. the paramedic's hand).
        if kept_offsets is not None and len(kept_offsets) == len(kept_new):
            center_estimates = kept_new - kept_offsets
            anchor.center = np.median(center_estimates, axis=0).astype(np.float32)
        else:
            flow = kept_new - anchor.points.reshape(-1, 2)[good]
            anchor.center = anchor.center + np.median(flow, axis=0)

        anchor.points = kept_new.reshape(-1, 1, 2).astype(np.float32)
        anchor.point_offsets = kept_new - anchor.center
        return True

    def _drop(self, anchor: _Anchor, events: list[AnchorEvent], coast_time: float) -> None:
        if anchor.state != AnchorState.LOST:
            anchor.state = AnchorState.LOST
            anchor.points = None
            events.append(self._event(AnchorEventType.LOST, anchor, coast_time))

    def _event(
        self, event_type: AnchorEventType, anchor: _Anchor, coast_time: float = 0.0
    ) -> AnchorEvent:
        return AnchorEvent(
            type=event_type,
            marker_id=anchor.marker_id,
            center=(float(anchor.center[0]), float(anchor.center[1])),
            state=anchor.state,
            size_px=anchor.size_px,
            coast_time_s=round(coast_time, 2),
        )
