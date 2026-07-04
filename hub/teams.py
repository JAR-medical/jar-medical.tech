"""Einsatztrupp (field team) registry.

The roster (names + notes) is persisted globally in ``data/teams.json`` —
teams survive session switches and hub restarts, because a squad doesn't
dissolve when a new incident starts. Liveness is ephemeral: clients send
periodic heartbeats (and every sighting/dictation counts as activity), so
the dashboard can show who is online and which patient they are looking at
without any of it polluting the medical record.

Unknown call signs auto-register on first contact — in the field, a new
Trupp joining the net must never be blocked by missing bookkeeping.
"""

from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

ONLINE_WINDOW_S = 40.0  # heartbeats come every ~15 s; allow two misses


class TeamRegistry:
    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._teams: dict[str, dict[str, Any]] = {}
        self._activity: dict[str, dict[str, Any]] = {}  # name -> {at, marker}
        self._load()

    # ------------------------------------------------------------------ api

    def list(self) -> list[dict[str, Any]]:
        now = time.time()
        with self._lock:
            rows = []
            for name, team in sorted(self._teams.items()):
                activity = self._activity.get(name)
                rows.append({
                    "name": name,
                    "note": team.get("note", ""),
                    "created_at": team.get("created_at", ""),
                    "online": bool(activity and now - activity["at"] < ONLINE_WINDOW_S),
                    "last_active": (
                        datetime.fromtimestamp(activity["at"], timezone.utc)
                        .isoformat(timespec="seconds") if activity else None
                    ),
                    "last_marker": activity.get("marker") if activity else None,
                })
            return rows

    def add(self, name: str, note: str = "") -> bool:
        name = name.strip()
        if not name:
            return False
        with self._lock:
            if name in self._teams:
                if note and self._teams[name].get("note") != note:
                    self._teams[name]["note"] = note
                    self._save_locked()
                return False
            self._teams[name] = {
                "note": note,
                "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            }
            self._save_locked()
            return True

    def remove(self, name: str) -> bool:
        with self._lock:
            if name not in self._teams:
                return False
            del self._teams[name]
            self._activity.pop(name, None)
            self._save_locked()
            return True

    def touch(self, name: str, marker: Optional[int] = None) -> bool:
        """Record activity for a team (auto-registering unknown call signs).
        Returns True if the *visible* status changed (came online, marker
        changed, new team) — the caller only broadcasts on real changes."""
        name = name.strip()
        if not name:
            return False
        now = time.time()
        with self._lock:
            changed = False
            if name not in self._teams:
                self._teams[name] = {
                    "note": "",
                    "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                }
                self._save_locked()
                changed = True
            previous = self._activity.get(name)
            was_online = bool(previous and now - previous["at"] < ONLINE_WINDOW_S)
            marker = marker if marker is not None else (previous or {}).get("marker")
            self._activity[name] = {"at": now, "marker": marker}
            if not was_online or (previous or {}).get("marker") != marker:
                changed = True
            return changed

    # ------------------------------------------------------------ internals

    def _load(self) -> None:
        if self._path.exists():
            try:
                self._teams = json.loads(self._path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                self._teams = {}

    def _save_locked(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(self._teams, ensure_ascii=False, indent=2), encoding="utf-8"
        )
