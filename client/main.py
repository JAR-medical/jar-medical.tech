"""TriARge Paramedic Client — entrypoint.

Run with:  python -m client.main [--hub http://<hub-ip>:8087] [--medic-id RTW-2]

Simulates AR smart glasses on a Mac: the webcam is the glasses camera, the
Mac microphone is the glasses mic, and the CLI logger is the AR display.

Interactive commands (type + Enter):
  d            start/stop dictation for the focused patient (push-to-talk)
  f <id>       manually focus a marker (default: nearest = largest in view)
  ls           list currently anchored patients
  show <id>    re-print a patient's overlay card
  cat <id> <SK1|SK2|SK3|SK4|DECEASED>   quick-set triage category
  q            quit
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
import threading
import time
from typing import Any, Optional

from .audio.dictation import DictationRecorder
from .config import ClientConfig
from .net.hub_client import HubClient
from .overlay.cli_renderer import CliOverlayRenderer
from .vision.anchor import AnchorEvent, AnchorEventType, AnchorManager, AnchorState

logging.basicConfig(level=logging.WARNING, format="%(asctime)s %(name)s: %(message)s")
log = logging.getLogger("triarge.client")

_VALID_CATEGORIES = {"SK1", "SK2", "SK3", "SK4", "DECEASED"}


class ParamedicClient:
    def __init__(self, config: ClientConfig) -> None:
        self.config = config
        self.renderer = CliOverlayRenderer()
        self.hub = HubClient(
            config.hub_url, config.ws_url, config.medic_id, config.spool_dir
        )
        self.anchors = AnchorManager(coast_timeout_s=config.coast_timeout_s)
        self.recorder = DictationRecorder(config.sample_rate)

        self._events: asyncio.Queue[AnchorEvent] = asyncio.Queue()
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._vision_thread: Optional[threading.Thread] = None
        self._stop = threading.Event()
        self._manual_focus: Optional[int] = None
        self._dictating_marker: Optional[int] = None
        self._last_seen_ping: dict[int, float] = {}

    # -------------------------------------------------------------- vision

    def _vision_loop(self) -> None:
        """Camera → ArUco → anchor tracking. Runs in its own thread at
        camera rate; only anchor *events* cross into asyncio."""
        import cv2

        from .vision.aruco_detector import ArucoDetector

        source: Any = self.config.video_file or self.config.camera_index
        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            self._post_status(f"Kamera/Videoquelle {source!r} nicht verfügbar — Vision deaktiviert")
            return
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720
        self.renderer.set_frame_size(width, height)
        self._post_status(
            f"Vision aktiv: {width}x{height}, ArUco {self.config.aruco_dict}, "
            f"Coast-Timeout {self.config.coast_timeout_s:.0f}s"
        )

        detector = ArucoDetector(self.config.aruco_dict)
        frame_interval = 1.0 / self.config.target_fps

        while not self._stop.is_set():
            started = time.monotonic()
            ok, frame = cap.read()
            if not ok:
                if self.config.video_file:
                    self._post_status("Videodatei zu Ende — Vision beendet")
                    break
                time.sleep(0.1)
                continue
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            detections = detector.detect(gray)
            for event in self.anchors.process_frame(gray, detections):
                self._post_event(event)
            # Pace to target FPS; detection is fast but no need to spin.
            elapsed = time.monotonic() - started
            if elapsed < frame_interval:
                time.sleep(frame_interval - elapsed)
        cap.release()

    def _post_event(self, event: AnchorEvent) -> None:
        if self._loop is not None:
            self._loop.call_soon_threadsafe(self._events.put_nowait, event)

    def _post_status(self, message: str) -> None:
        if self._loop is not None:
            self._loop.call_soon_threadsafe(self.renderer.status, message)

    # -------------------------------------------------------- event handling

    async def _event_consumer(self) -> None:
        while True:
            event = await self._events.get()
            handler = {
                AnchorEventType.ACQUIRED: self._on_acquired,
                AnchorEventType.REACQUIRED: self._on_reacquired,
                AnchorEventType.COASTING: self._on_coasting,
                AnchorEventType.LOST: self._on_lost,
                AnchorEventType.MOVED: self._on_moved,
            }[event.type]
            await handler(event)

    async def _on_acquired(self, event: AnchorEvent) -> None:
        self.renderer.acquired(event.marker_id, event.center)
        # The only place a patient record is created: first confirmed sight.
        patient = await self.hub.claim_patient(event.marker_id)
        await self.hub.report_seen(event.marker_id)
        self._last_seen_ping[event.marker_id] = time.monotonic()
        if patient is None:
            self.renderer.warn(
                f"Hub nicht erreichbar und kein Cache für #{event.marker_id} — Overlay ohne Daten"
            )
            return
        self.renderer.show_patient(patient, event.center)

    async def _on_reacquired(self, event: AnchorEvent) -> None:
        self.renderer.reacquired(event.marker_id, event.center)
        await self.hub.report_seen(event.marker_id)
        self._last_seen_ping[event.marker_id] = time.monotonic()
        # Cache first — live WS updates keep it fresh, so no re-claim storm.
        patient = self.hub.patient_cached(event.marker_id)
        if patient is None:
            patient = await self.hub.claim_patient(event.marker_id)
        # Re-print the card only after a substantial gap; brief occlusions
        # would otherwise flood the CLI with identical cards.
        if patient is not None and event.coast_time_s >= 3.0:
            self.renderer.show_patient(patient, event.center)

    async def _on_coasting(self, event: AnchorEvent) -> None:
        self.renderer.coasting(event.marker_id, event.center)

    async def _on_lost(self, event: AnchorEvent) -> None:
        self.renderer.lost(event.marker_id, event.coast_time_s)
        if self._manual_focus == event.marker_id:
            self._manual_focus = None

    async def _on_moved(self, event: AnchorEvent) -> None:
        # A real HMD renderer would update the overlay transform here; the
        # CLI stays quiet. We only emit a throttled presence ping so the
        # dashboard shows who currently has eyes on the patient.
        now = time.monotonic()
        if now - self._last_seen_ping.get(event.marker_id, 0.0) >= 10.0:
            self._last_seen_ping[event.marker_id] = now
            await self.hub.report_seen(event.marker_id)

    async def _on_patient_broadcast(self, patient: dict[str, Any]) -> None:
        """Another medic (or the radio AI, or the EL) updated a patient we
        currently have anchored → refresh the overlay immediately."""
        marker_id = patient["marker_id"]
        anchor = self.anchors.anchors.get(marker_id)
        if anchor is not None and anchor.state != AnchorState.LOST:
            self.renderer.update_patient(patient)

    async def _on_connection_change(self, connected: bool) -> None:
        if connected:
            self.renderer.status("Verbindung zum Hub hergestellt (Live-Sync aktiv)")
        else:
            self.renderer.warn("Hub-Verbindung verloren — Offline-Modus (Cache + Spool)")

    # ----------------------------------------------------------------- focus

    def _focused_marker(self) -> Optional[int]:
        if self._manual_focus is not None:
            anchor = self.anchors.anchors.get(self._manual_focus)
            if anchor is not None and anchor.state != AnchorState.LOST:
                return self._manual_focus
        active = self.anchors.active_anchors()
        if not active:
            return None
        # Largest marker in view ≈ patient the medic is closest to / facing.
        return max(active, key=lambda a: a.size_px).marker_id

    # ------------------------------------------------------------ dictation

    async def _toggle_dictation(self) -> None:
        if self.recorder.recording:
            marker_id = self._dictating_marker
            self._dictating_marker = None
            wav = await asyncio.to_thread(self.recorder.stop)
            if wav is None or marker_id is None:
                self.renderer.warn("Aufnahme zu kurz — verworfen")
                return
            self.renderer.dictation(
                f"Aufnahme beendet ({len(wav) // 1024} KiB) — sende an Hub zur KI-Auswertung …"
            )
            result = await self.hub.send_dictation(marker_id, wav)
            if result is None:
                self.renderer.warn(
                    f"Hub offline — Diktat für #{marker_id} gespoolt, wird automatisch nachgereicht"
                )
            elif not result.get("applied"):
                self.renderer.warn(f"Keine Sprache erkannt ({result.get('detail', '')})")
            else:
                self.renderer.dictation(f"Transkript: „{result['transcript']}“")
                self.renderer.update_patient(result["patient"])
            return

        marker_id = self._focused_marker()
        if marker_id is None:
            self.renderer.warn("Kein Patient im Blickfeld — Diktat nicht möglich")
            return
        self._dictating_marker = marker_id
        await asyncio.to_thread(self.recorder.start)
        self.renderer.dictation(
            f"Aufnahme läuft für Patient #{marker_id} — 'd' + Enter zum Beenden"
        )

    # ----------------------------------------------------------------- REPL

    async def _repl(self) -> None:
        while True:
            raw = await asyncio.to_thread(sys.stdin.readline)
            if raw == "":  # EOF
                break
            parts = raw.strip().split()
            if not parts:
                continue
            cmd, args = parts[0].lower(), parts[1:]
            try:
                if cmd == "q":
                    break
                elif cmd == "d":
                    await self._toggle_dictation()
                elif cmd == "f" and args:
                    self._manual_focus = int(args[0])
                    self.renderer.status(f"Fokus manuell auf #{self._manual_focus}")
                elif cmd == "ls":
                    self._print_anchor_list()
                elif cmd == "show" and args:
                    await self._show_patient(int(args[0]))
                elif cmd == "cat" and len(args) == 2:
                    await self._set_category(int(args[0]), args[1].upper())
                else:
                    self.renderer.status(
                        "Befehle: d | f <id> | ls | show <id> | cat <id> <SK1..SK4|DECEASED> | q"
                    )
            except ValueError:
                self.renderer.warn("Ungültige Marker-ID")

    def _print_anchor_list(self) -> None:
        active = self.anchors.active_anchors()
        if not active:
            self.renderer.status("Keine Patienten im Tracking")
            return
        focused = self._focused_marker()
        for anchor in sorted(active, key=lambda a: a.marker_id):
            mark = "→" if anchor.marker_id == focused else " "
            self.renderer.status(
                f"{mark} #{anchor.marker_id}: {anchor.state.value}, Größe {anchor.size_px:.0f}px"
            )

    async def _show_patient(self, marker_id: int) -> None:
        patient = self.hub.patient_cached(marker_id) or await self.hub.claim_patient(marker_id)
        if patient is None:
            self.renderer.warn(f"Keine Daten für #{marker_id}")
            return
        anchor = self.anchors.anchors.get(marker_id)
        center = (
            (float(anchor.center[0]), float(anchor.center[1]))
            if anchor is not None else (0.0, 0.0)
        )
        self.renderer.show_patient(patient, center)

    async def _set_category(self, marker_id: int, category: str) -> None:
        if category not in _VALID_CATEGORIES:
            self.renderer.warn(f"Ungültige Kategorie {category}")
            return
        patient = await self.hub.update_patient(marker_id, {"category": category})
        if patient is None:
            self.renderer.warn("Update fehlgeschlagen (Hub offline?)")
        else:
            self.renderer.update_patient(patient)

    # ------------------------------------------------------------------ run

    async def run(self, enable_vision: bool = True) -> None:
        self._loop = asyncio.get_running_loop()
        self.renderer.status(
            f"TriARge Client [{self.config.medic_id}] — Hub: {self.config.hub_url}"
        )
        self.hub.start(self._on_patient_broadcast, self._on_connection_change)
        consumer = asyncio.create_task(self._event_consumer(), name="events")

        if enable_vision:
            self._vision_thread = threading.Thread(
                target=self._vision_loop, name="vision", daemon=True
            )
            self._vision_thread.start()
        else:
            self.renderer.status("Vision deaktiviert (--no-vision)")

        try:
            await self._repl()
        finally:
            self.renderer.status("Beende Client …")
            self._stop.set()
            if self.recorder.recording:
                self.recorder.stop()
            consumer.cancel()
            await self.hub.close()
            if self._vision_thread is not None:
                self._vision_thread.join(timeout=2)


def parse_args() -> tuple[ClientConfig, bool]:
    defaults = ClientConfig()
    parser = argparse.ArgumentParser(description="TriARge paramedic client (AR simulation)")
    parser.add_argument("--hub", default=defaults.hub_url, help="hub base URL")
    parser.add_argument("--medic-id", default=defaults.medic_id, help="call sign, e.g. RTW-2")
    parser.add_argument("--camera", type=int, default=defaults.camera_index)
    parser.add_argument("--video", default="", help="replay a video file instead of the camera")
    parser.add_argument("--aruco-dict", default=defaults.aruco_dict)
    parser.add_argument("--coast-timeout", type=float, default=defaults.coast_timeout_s,
                        help="seconds the overlay survives marker occlusion")
    parser.add_argument("--no-vision", action="store_true",
                        help="run without camera (dictation/REPL only)")
    args = parser.parse_args()
    config = ClientConfig(
        hub_url=args.hub,
        medic_id=args.medic_id,
        camera_index=args.camera,
        video_file=args.video,
        aruco_dict=args.aruco_dict,
        coast_timeout_s=args.coast_timeout,
    )
    return config, not args.no_vision


def preauthorize_devices(config: ClientConfig, enable_vision: bool) -> None:
    """Trigger macOS camera/microphone permission prompts from the MAIN
    thread before any worker thread touches the devices.

    macOS (TCC) can only present the authorization dialog when the request
    originates on the main thread with a spinnable run loop; OpenCV opened
    from the vision thread fails with "not authorized to capture video"
    and never prompts. Opening both devices here once — before the asyncio
    loop and threads start — makes the prompts appear on first launch.
    """
    import os

    if enable_vision and not config.video_file:
        import cv2

        # Two attempts: the first open blocks on the permission dialog and
        # may report failure even though the user clicked "Allow".
        camera_ok = False
        for _ in range(2):
            cap = cv2.VideoCapture(config.camera_index)
            camera_ok = cap.isOpened()
            cap.release()
            if camera_ok:
                break
        if camera_ok:
            # Authorized — the vision thread must not re-request (it can't
            # spin the main run loop), so skip auth on subsequent opens.
            os.environ["OPENCV_AVFOUNDATION_SKIP_AUTH"] = "1"
        else:
            print(
                "⚠ Kamera nicht verfügbar. Falls kein Dialog erschien: "
                "Systemeinstellungen → Datenschutz & Sicherheit → Kamera → "
                "Terminal erlauben, dann Client neu starten.",
                file=sys.stderr,
            )

    try:
        import sounddevice as sd

        stream = sd.InputStream(
            channels=1, samplerate=config.sample_rate, dtype="float32"
        )
        stream.start()
        stream.stop()
        stream.close()
    except Exception as exc:
        print(
            f"⚠ Mikrofon nicht verfügbar ({exc}). Diktat wird fehlschlagen — "
            "Systemeinstellungen → Datenschutz & Sicherheit → Mikrofon prüfen.",
            file=sys.stderr,
        )


def main() -> None:
    config, enable_vision = parse_args()
    preauthorize_devices(config, enable_vision)
    try:
        asyncio.run(ParamedicClient(config).run(enable_vision=enable_vision))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
