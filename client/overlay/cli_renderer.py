"""CLI stand-in for the AR display.

On real glasses this module is replaced by an HMD renderer; the interface
(`show_patient`, `update_patient`, `coasting`, `lost`, `status`) is the
contract. Here, every overlay state change becomes a timestamped, colored
log line, and the "overlay" is an ANSI patient card — enough to verify the
entire pipeline end-to-end without hardware.
"""

from __future__ import annotations

import sys
from datetime import datetime
from typing import Any

_RESET = "\033[0m"
_BOLD = "\033[1m"
_DIM = "\033[2m"

_CATEGORY_STYLE = {
    "SK1": ("\033[41;97m", "SK I  ROT"),
    "SK2": ("\033[43;30m", "SK II GELB"),
    "SK3": ("\033[42;97m", "SK III GRÜN"),
    "SK4": ("\033[44;97m", "SK IV BLAU"),
    "DECEASED": ("\033[100;97m", "VERSTORBEN"),
    "UNSIGHTED": ("\033[47;30m", "UNGESICHTET"),
}


def _ts() -> str:
    return _DIM + datetime.now().strftime("%H:%M:%S.%f")[:-3] + _RESET


def _line(tag: str, message: str) -> None:
    sys.stdout.write(f"{_ts()} {tag} {message}\n")
    sys.stdout.flush()


class CliOverlayRenderer:
    """Log-line 'AR overlay'. Position is reported in normalized frame
    coordinates so the output is resolution-independent."""

    def __init__(self, frame_size: tuple[int, int] = (1280, 720)) -> None:
        self._frame_w, self._frame_h = frame_size

    def set_frame_size(self, width: int, height: int) -> None:
        self._frame_w, self._frame_h = width, height

    def _pos(self, center: tuple[float, float]) -> str:
        nx = center[0] / max(1, self._frame_w)
        ny = center[1] / max(1, self._frame_h)
        return f"({nx:.2f}, {ny:.2f})"

    # -------------------------------------------------------- anchor events

    def acquired(self, marker_id: int, center: tuple[float, float]) -> None:
        _line("🔎", f"{_BOLD}Marker #{marker_id}{_RESET} erkannt @ {self._pos(center)} — lade Patientendaten …")

    def reacquired(self, marker_id: int, center: tuple[float, float]) -> None:
        _line("🔗", f"Marker #{marker_id} re-verifiziert @ {self._pos(center)} — Anker wieder LOCKED")

    def coasting(self, marker_id: int, center: tuple[float, float]) -> None:
        _line("🌫", f"Marker #{marker_id} verdeckt/außer Sicht — Overlay bleibt via Optical Flow verankert @ {self._pos(center)}")

    def lost(self, marker_id: int, coast_time_s: float) -> None:
        _line("✖", f"Anker #{marker_id} verloren (nach {coast_time_s:.1f}s Coasting) — Overlay ausgeblendet (fail-closed)")

    # ------------------------------------------------------- patient overlay

    def show_patient(self, patient: dict[str, Any], center: tuple[float, float]) -> None:
        self._card(patient, f"OVERLAY EINGEBLENDET @ {self._pos(center)}")

    def update_patient(self, patient: dict[str, Any]) -> None:
        self._card(patient, "LIVE-UPDATE VOM HUB")

    def _card(self, p: dict[str, Any], banner: str) -> None:
        style, cat_label = _CATEGORY_STYLE.get(
            p.get("category", "UNSIGHTED"), _CATEGORY_STYLE["UNSIGHTED"]
        )
        vit = p.get("vitals") or {}
        vitals = "  ".join(
            s for s in (
                f"AF {vit['breathing_rate']}/min" if vit.get("breathing_rate") is not None else "",
                f"Puls {vit['pulse']}/min" if vit.get("pulse") is not None else "",
                f"SpO₂ {vit['spo2']}%" if vit.get("spo2") is not None else "",
                f"RR {vit['bp_systolic']}/{vit.get('bp_diastolic', '?')}" if vit.get("bp_systolic") is not None else "",
                f"GCS {vit['gcs']}" if vit.get("gcs") is not None else "",
            ) if s
        ) or "keine Vitalwerte erfasst"

        demo = " ".join(
            s for s in (
                {"m": "männl.", "w": "weibl."}.get(p.get("sex") or "", ""),
                f"~{p['age_estimate']}J." if p.get("age_estimate") is not None else "",
                "gehfähig" if p.get("ambulatory") is True else
                "nicht gehfähig" if p.get("ambulatory") is False else "",
            ) if s
        )

        lines = [
            f"┌─ PATIENT #{p['marker_id']} {'─' * 30}",
            f"│ {style} {cat_label} {_RESET}  {demo}".rstrip(),
            f"│ Vitals: {vitals}",
        ]
        if p.get("injuries"):
            lines.append(f"│ Verletzungen: {', '.join(p['injuries'])}")
        if p.get("treatments"):
            lines.append(f"│ Maßnahmen: {', '.join(p['treatments'])}")
        if p.get("notes"):
            lines.append(f"│ Letzte Notiz: {p['notes'][-1][:90]}")
        lines.append(f"└{'─' * 44}")

        sys.stdout.write(f"{_ts()} 🩺 {_BOLD}{banner}{_RESET}\n")
        for line in lines:
            sys.stdout.write(f"           {line}\n")
        sys.stdout.flush()

    # ----------------------------------------------------------- app status

    def status(self, message: str) -> None:
        _line("ℹ", message)

    def dictation(self, message: str) -> None:
        _line("🎙", message)

    def warn(self, message: str) -> None:
        _line("⚠", f"\033[33m{message}{_RESET}")
