"""Client configuration (env-overridable defaults, CLI flags win)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class ClientConfig:
    hub_url: str = os.environ.get("TRIARGE_HUB_URL", "http://127.0.0.1:8087")
    medic_id: str = os.environ.get("TRIARGE_MEDIC_ID", "RTW-1")

    # Vision
    camera_index: int = int(os.environ.get("TRIARGE_CAMERA", "0"))
    video_file: str = ""                 # replay a recording instead of camera
    aruco_dict: str = os.environ.get("TRIARGE_ARUCO_DICT", "DICT_4X4_50")
    # How long the overlay stays anchored via optical flow after the marker
    # was last positively identified (paramedic leaning over the patient,
    # marker occluded / out of frame).
    coast_timeout_s: float = float(os.environ.get("TRIARGE_COAST_TIMEOUT", "8.0"))
    target_fps: float = 30.0

    # Audio
    sample_rate: int = 16000

    # Offline resilience: dictations that cannot reach the hub are spooled
    # here and re-sent automatically once the hub is reachable again.
    spool_dir: str = os.environ.get("TRIARGE_SPOOL_DIR", "spool")

    @property
    def ws_url(self) -> str:
        return self.hub_url.replace("http://", "ws://").replace("https://", "wss://") + "/ws"
