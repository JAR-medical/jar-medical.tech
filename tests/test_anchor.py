"""Anchor confirmation gate.

ArUco misreads (phantom IDs from image noise) must never create anchors —
and thus never create phantom patients on the hub — while genuine markers
that decode only intermittently (distance, glare) must still be confirmed
quickly via the sliding window.
"""

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


def hub_relevant(events):
    """Events that trigger hub traffic / overlay changes."""
    return [e for e in events if e.type != AnchorEventType.CANDIDATE]


def test_sporadic_misreads_never_activate():
    mgr = AnchorManager(confirm_frames=3)
    img = frame()
    assert hub_relevant(mgr.process_frame(img, [det(37)])) == []
    assert hub_relevant(mgr.process_frame(img, [])) == []
    assert hub_relevant(mgr.process_frame(img, [det(37)])) == []
    assert 37 not in mgr.anchors


def test_unconfirmed_detection_is_surfaced_as_candidate():
    mgr = AnchorManager(confirm_frames=3)
    events = mgr.process_frame(frame(), [det(37)])
    assert [e.type for e in events] == [AnchorEventType.CANDIDATE]
    assert events[0].marker_id == 37


def test_persistent_marker_is_acquired_exactly_once():
    mgr = AnchorManager(confirm_frames=3)
    img = frame()
    events = []
    for _ in range(5):
        events += mgr.process_frame(img, [det(7)])
    acquired = [e for e in events if e.type == AnchorEventType.ACQUIRED]
    assert len(acquired) == 1
    assert acquired[0].marker_id == 7


def test_flickering_real_marker_still_confirms():
    """A marker decoding only every other frame (distance/glare) must be
    confirmed by the sliding window — this was the transmission blocker
    with strictly-consecutive counting."""
    mgr = AnchorManager(confirm_frames=3)
    img = frame()
    events = []
    for i in range(6):
        seen = [det(9)] if i % 2 == 0 else []
        events += mgr.process_frame(img, seen)
    assert any(e.type == AnchorEventType.ACQUIRED and e.marker_id == 9 for e in events)


def test_brief_dropout_stays_silent():
    mgr = AnchorManager(confirm_frames=1, miss_grace_s=10.0)
    img = frame()
    mgr.process_frame(img, [det(2)])
    # marker flickers off for a few frames — within grace, no events
    for _ in range(3):
        assert mgr.process_frame(img, []) == []
    # and comes back: plain MOVED, not a REACQUIRED storm
    events = mgr.process_frame(img, [det(2)])
    assert [e.type for e in events] == [AnchorEventType.MOVED]
