"""SQLite persistence layer.

Design goals:
- Zero external dependencies, WAL mode, safe under FastAPI's threadpool
  (single connection guarded by a lock; every write is one transaction).
- Local DB is the single source of truth. Every mutation also enqueues a
  row into ``sync_outbox`` so the optional Supabase pusher can replicate
  state when internet happens to be available, without the request path
  ever depending on connectivity.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from .models import (
    Patient,
    PatientUpdate,
    ProtocolEntry,
    RadioLogEntry,
    TriageCategory,
)

_SCHEMA = """
CREATE TABLE IF NOT EXISTS patients (
    marker_id     INTEGER PRIMARY KEY,
    category      TEXT NOT NULL DEFAULT 'UNSIGHTED',
    sex           TEXT,
    age_estimate  INTEGER,
    ambulatory    INTEGER,
    conscious     INTEGER,
    airway_clear  INTEGER,
    location      TEXT,
    vitals        TEXT NOT NULL DEFAULT '{}',
    injuries      TEXT NOT NULL DEFAULT '[]',
    treatments    TEXT NOT NULL DEFAULT '[]',
    notes         TEXT NOT NULL DEFAULT '[]',
    version       INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS protocol_entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    marker_id   INTEGER NOT NULL REFERENCES patients(marker_id),
    timestamp   TEXT NOT NULL,
    source      TEXT NOT NULL,
    author      TEXT NOT NULL DEFAULT '',
    transcript  TEXT NOT NULL DEFAULT '',
    structured  TEXT NOT NULL DEFAULT '{}',
    audio_file  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_protocol_marker ON protocol_entries(marker_id);

CREATE TABLE IF NOT EXISTS radio_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp    TEXT NOT NULL,
    transcript   TEXT NOT NULL,
    patient_refs TEXT NOT NULL DEFAULT '[]',
    structured   TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS sync_outbox (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    payload    TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


class Database:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        with self._lock, self._conn:
            self._conn.executescript(_SCHEMA)

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    # ------------------------------------------------------------- patients

    def get_patient(self, marker_id: int) -> Optional[Patient]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM patients WHERE marker_id = ?", (marker_id,)
            ).fetchone()
        return self._row_to_patient(row) if row else None

    def list_patients(self) -> list[Patient]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM patients ORDER BY marker_id"
            ).fetchall()
        return [self._row_to_patient(r) for r in rows]

    def ensure_patient(self, marker_id: int) -> tuple[Patient, bool]:
        """Get the patient for a marker, creating the record on first sight.

        Returns (patient, created).
        """
        with self._lock, self._conn:
            row = self._conn.execute(
                "SELECT * FROM patients WHERE marker_id = ?", (marker_id,)
            ).fetchone()
            if row:
                return self._row_to_patient(row), False
            now = _now()
            self._conn.execute(
                "INSERT INTO patients (marker_id, created_at, updated_at)"
                " VALUES (?, ?, ?)",
                (marker_id, now, now),
            )
            patient = Patient(marker_id=marker_id, created_at=now, updated_at=now)
            self._enqueue_sync_locked("patients", self._patient_sync_payload(patient))
            return patient, True

    def apply_update(
        self,
        marker_id: int,
        update: PatientUpdate,
        *,
        source: str,
        author: str = "",
        transcript: str = "",
        audio_file: str = "",
    ) -> Patient:
        """Apply a partial update atomically and record a protocol entry.

        List fields (injuries/treatments/notes) are merged, scalars are
        overwritten by newer information — last writer wins, which matches
        field reality: the most recent assessment supersedes older ones.
        """
        with self._lock, self._conn:
            row = self._conn.execute(
                "SELECT * FROM patients WHERE marker_id = ?", (marker_id,)
            ).fetchone()
            if row is None:
                now = _now()
                self._conn.execute(
                    "INSERT INTO patients (marker_id, created_at, updated_at)"
                    " VALUES (?, ?, ?)",
                    (marker_id, now, now),
                )
                patient = Patient(marker_id=marker_id, created_at=now, updated_at=now)
            else:
                patient = self._row_to_patient(row)

            data = patient.model_dump()
            for field in ("category", "sex", "age_estimate", "ambulatory",
                          "conscious", "airway_clear", "location"):
                value = getattr(update, field)
                if value is not None:
                    data[field] = value
            if update.vitals is not None:
                for k, v in update.vitals.model_dump(exclude_none=True).items():
                    data["vitals"][k] = v
            data["injuries"] = _merge(data["injuries"], update.injuries)
            data["treatments"] = _merge(data["treatments"], update.treatments)
            if update.note:
                data["notes"] = _merge(data["notes"], [update.note])
            data["version"] = patient.version + 1
            data["updated_at"] = _now()
            updated = Patient(**data)

            self._conn.execute(
                """UPDATE patients SET category=?, sex=?, age_estimate=?,
                   ambulatory=?, conscious=?, airway_clear=?, location=?,
                   vitals=?, injuries=?, treatments=?, notes=?,
                   version=?, updated_at=? WHERE marker_id=?""",
                (
                    updated.category.value, updated.sex, updated.age_estimate,
                    _b(updated.ambulatory), _b(updated.conscious),
                    _b(updated.airway_clear), updated.location,
                    updated.vitals.model_dump_json(),
                    json.dumps(updated.injuries, ensure_ascii=False),
                    json.dumps(updated.treatments, ensure_ascii=False),
                    json.dumps(updated.notes, ensure_ascii=False),
                    updated.version, updated.updated_at, marker_id,
                ),
            )
            structured = update.model_dump(exclude_none=True, exclude_defaults=True)
            entry_ts = updated.updated_at
            cur = self._conn.execute(
                """INSERT INTO protocol_entries
                   (marker_id, timestamp, source, author, transcript,
                    structured, audio_file)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    marker_id, entry_ts, source, author, transcript,
                    json.dumps(structured, ensure_ascii=False, default=str),
                    audio_file,
                ),
            )
            self._enqueue_sync_locked("patients", self._patient_sync_payload(updated))
            self._enqueue_sync_locked(
                "protocol_entries",
                {
                    "local_id": cur.lastrowid,
                    "marker_id": marker_id,
                    "timestamp": entry_ts,
                    "source": source,
                    "author": author,
                    "transcript": transcript,
                    "structured": structured,
                },
            )
            return updated

    def delete_patient(self, marker_id: int) -> bool:
        """Remove a patient entirely (e.g. one created by a marker misread).
        The protocol trail goes with it; a deletion marker is queued so an
        optional cloud replica removes the row too."""
        with self._lock, self._conn:
            self._conn.execute(
                "DELETE FROM protocol_entries WHERE marker_id = ?", (marker_id,)
            )
            cur = self._conn.execute(
                "DELETE FROM patients WHERE marker_id = ?", (marker_id,)
            )
            if cur.rowcount == 0:
                return False
            self._enqueue_sync_locked("patients:delete", {"marker_id": marker_id})
            return True

    # ------------------------------------------------------------- protocol

    def list_protocol(self, marker_id: int) -> list[ProtocolEntry]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM protocol_entries WHERE marker_id = ?"
                " ORDER BY id DESC",
                (marker_id,),
            ).fetchall()
        return [
            ProtocolEntry(
                id=r["id"], marker_id=r["marker_id"], timestamp=r["timestamp"],
                source=r["source"], author=r["author"], transcript=r["transcript"],
                structured=json.loads(r["structured"]), audio_file=r["audio_file"],
            )
            for r in rows
        ]

    # ------------------------------------------------------------ radio log

    def add_radio_entry(
        self, transcript: str, patient_refs: list[int], structured: dict[str, Any]
    ) -> RadioLogEntry:
        ts = _now()
        with self._lock, self._conn:
            cur = self._conn.execute(
                "INSERT INTO radio_log (timestamp, transcript, patient_refs,"
                " structured) VALUES (?, ?, ?, ?)",
                (
                    ts, transcript, json.dumps(patient_refs),
                    json.dumps(structured, ensure_ascii=False, default=str),
                ),
            )
            entry = RadioLogEntry(
                id=cur.lastrowid or 0, timestamp=ts, transcript=transcript,
                patient_refs=patient_refs, structured=structured,
            )
            self._enqueue_sync_locked(
                "radio_log", entry.model_dump(exclude={"id"}) | {"local_id": entry.id}
            )
            return entry

    def list_radio_log(self, limit: int = 100) -> list[RadioLogEntry]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM radio_log ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [
            RadioLogEntry(
                id=r["id"], timestamp=r["timestamp"], transcript=r["transcript"],
                patient_refs=json.loads(r["patient_refs"]),
                structured=json.loads(r["structured"]),
            )
            for r in rows
        ]

    # ---------------------------------------------------------- sync outbox

    def _enqueue_sync_locked(self, table: str, payload: dict[str, Any]) -> None:
        """Caller must hold self._lock and be inside a transaction."""
        self._conn.execute(
            "INSERT INTO sync_outbox (table_name, payload, created_at)"
            " VALUES (?, ?, ?)",
            (table, json.dumps(payload, ensure_ascii=False, default=str), _now()),
        )

    def peek_outbox(self, limit: int = 50) -> list[tuple[int, str, dict[str, Any]]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT id, table_name, payload FROM sync_outbox"
                " ORDER BY id LIMIT ?",
                (limit,),
            ).fetchall()
        return [(r["id"], r["table_name"], json.loads(r["payload"])) for r in rows]

    def ack_outbox(self, ids: list[int]) -> None:
        if not ids:
            return
        with self._lock, self._conn:
            self._conn.executemany(
                "DELETE FROM sync_outbox WHERE id = ?", [(i,) for i in ids]
            )

    def outbox_size(self) -> int:
        with self._lock:
            row = self._conn.execute("SELECT COUNT(*) AS n FROM sync_outbox").fetchone()
        return int(row["n"])

    # -------------------------------------------------------------- helpers

    @staticmethod
    def _patient_sync_payload(p: Patient) -> dict[str, Any]:
        payload = p.model_dump()
        payload["category"] = p.category.value
        return payload

    @staticmethod
    def _row_to_patient(row: sqlite3.Row) -> Patient:
        return Patient(
            marker_id=row["marker_id"],
            category=TriageCategory(row["category"]),
            sex=row["sex"],
            age_estimate=row["age_estimate"],
            ambulatory=_ib(row["ambulatory"]),
            conscious=_ib(row["conscious"]),
            airway_clear=_ib(row["airway_clear"]),
            location=row["location"],
            vitals=json.loads(row["vitals"]),
            injuries=json.loads(row["injuries"]),
            treatments=json.loads(row["treatments"]),
            notes=json.loads(row["notes"]),
            version=row["version"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


def _merge(existing: list[str], new: list[str]) -> list[str]:
    """Order-preserving union with case-insensitive dedup."""
    seen = {e.strip().lower() for e in existing}
    merged = list(existing)
    for item in new:
        key = item.strip().lower()
        if key and key not in seen:
            seen.add(key)
            merged.append(item.strip())
    return merged


def _b(value: Optional[bool]) -> Optional[int]:
    return None if value is None else int(value)


def _ib(value: Optional[int]) -> Optional[bool]:
    return None if value is None else bool(value)
