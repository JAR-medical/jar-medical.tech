"""Session (Einsatz) management.

A session is one self-contained incident: its own SQLite database under
``data/sessions/<name>.db``. "Reset" therefore never deletes anything —
it opens a fresh database and leaves the previous one untouched on disk,
and any earlier session can be reactivated later (e.g. to review or
continue an exercise).

The active session name is persisted so a hub restart resumes where it
left off. A pre-session legacy database (``data/triarge.db``) is migrated
into the sessions directory as ``einsatz-1`` on first start.
"""

from __future__ import annotations

import re
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import HubConfig
from .database import Database

_NAME_RE = re.compile(r"[^a-z0-9äöüß_-]+")


def _slugify(name: str) -> str:
    slug = _NAME_RE.sub("-", name.strip().lower()).strip("-")
    return slug[:64]


class SessionManager:
    def __init__(self, config: HubConfig) -> None:
        self._config = config
        self._dir = config.data_dir / "sessions"
        self._dir.mkdir(parents=True, exist_ok=True)
        self._active_file = config.data_dir / "active_session.txt"
        self._lock = threading.Lock()
        self._migrate_legacy()

        name = ""
        if self._active_file.exists():
            name = self._active_file.read_text(encoding="utf-8").strip()
        if not name or not self._path(name).exists():
            existing = self._names()
            name = existing[-1] if existing else self._default_name()
        self._current = name
        self.db = Database(self._path(name))
        self._save_active()

    # ------------------------------------------------------------------ api

    @property
    def current_name(self) -> str:
        return self._current

    def list_sessions(self) -> list[dict[str, Any]]:
        sessions = []
        for name in self._names():
            path = self._path(name)
            sessions.append({
                "name": name,
                "active": name == self._current,
                "modified": datetime.fromtimestamp(path.stat().st_mtime)
                .isoformat(timespec="seconds"),
                "size_kb": path.stat().st_size // 1024,
            })
        sessions.sort(key=lambda s: s["modified"], reverse=True)
        return sessions

    def new_session(self, name: str | None = None) -> dict[str, Any]:
        """Start a fresh, empty session and switch to it."""
        slug = _slugify(name) if name else self._default_name()
        if not slug:
            slug = self._default_name()
        base, n = slug, 2
        while self._path(slug).exists():
            slug = f"{base}-{n}"
            n += 1
        return self.switch(slug, create=True)

    def switch(self, name: str, create: bool = False) -> dict[str, Any]:
        """Activate a session. Existing DB connections drain naturally: the
        old database is closed only after the new one is live."""
        path = self._path(name)
        if not create and not path.exists():
            raise FileNotFoundError(f"unknown session {name!r}")
        with self._lock:
            if name == self._current:
                return {"name": name, "created": False}
            old_db = self.db
            self.db = Database(path)
            self._current = name
            self._save_active()
            old_db.close()
        return {"name": name, "created": create}

    def close(self) -> None:
        self.db.close()

    # ------------------------------------------------------------ internals

    def _path(self, name: str) -> Path:
        return self._dir / f"{name}.db"

    def _names(self) -> list[str]:
        return sorted(p.stem for p in self._dir.glob("*.db"))

    @staticmethod
    def _default_name() -> str:
        return datetime.now().strftime("einsatz-%Y%m%d-%H%M%S")

    def _save_active(self) -> None:
        self._active_file.write_text(self._current, encoding="utf-8")

    def _migrate_legacy(self) -> None:
        legacy = self._config.data_dir / "triarge.db"
        if legacy.exists() and not any(self._dir.glob("*.db")):
            for suffix in ("", "-wal", "-shm"):
                src = Path(str(legacy) + suffix)
                if src.exists():
                    src.rename(self._dir / f"einsatz-1.db{suffix}")
