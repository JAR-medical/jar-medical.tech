"""Anchor confirmation gate: single-frame ArUco misreads must never
create anchors (and thus never create phantom patients on the hub)."""

import numpy as np
import pytest

cv2 = pytest.importorskip("cv2")

from client.vision.anchor import AnchorEventType, AnchorManager
from client.vision.aruco_detector import MarkerDetection


def det(marker_id: int, x: float = 100.0, y: float = 100.0) -> MarkerDetection:
    corners = np.array(
        [[x - 20, y - 20], [x + 20, y - 20], [x + 20, y + 20], [x - 20, y + 20]],
        dtype=np.float32,
    )
    return MarkerDetection(marker_id=marker_id, corners=corners, center=(x, y), size_px=40.0)


def frame() -> np.ndarray:
    rng = np.random.default_rng(42)
    return rng.integers(0, 255, size=(480, 640), dtype=np.uint8)


def test_single_frame_misread_is_ignored():
    mgr = AnchorManager(confirm_frames=3)
    img = frame()
    assert mgr.process_frame(img, [det(37)]) == []          # 1st sighting
    assert mgr.process_frame(img, []) == []                  # gone again
    assert mgr.process_frame(img, [det(37)]) == []           # counter was reset
    assert 37 not in mgr.anchors


def test_persistent_marker_is_acquired_exactly_once():
    mgr = AnchorManager(confirm_frames=3)
    img = frame()
    events = []
    for _ in range(5):
        events += mgr.process_frame(img, [det(7)])
    acquired = [e for e in events if e.type == AnchorEventType.ACQUIRED]
    assert len(acquired) == 1
    assert acquired[0].marker_id == 7


def test_brief_dropout_stays_silent():
    mgr = AnchorManager(confirm_frames=1, miss_grace_s=10.0)
    img = frame()
    mgr.process_frame(img, [det(2)])
    # marker flickers off for a few frames — within grace, no events
    for _ in range(3):
        events = mgr.process_frame(img, [])
        assert events == []
    # and comes back: plain MOVED, not a REACQUIRED storm
    events = mgr.process_frame(img, [det(2)])
    assert [e.type for e in events] == [AnchorEventType.MOVED]
