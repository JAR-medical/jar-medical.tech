"""Best-effort push replication to Supabase.

The hub is offline-first: SQLite is the source of truth and every mutation
is journaled into ``sync_outbox`` (see database.py). This worker drains the
outbox to Supabase's PostgREST API whenever the internet happens to be
reachable — and silently backs off when it isn't. Nothing on the request
path ever waits for the cloud.

Rows are upserted keyed on (incident_id, marker_id) for patients and
(incident_id, local_id) for append-only tables, so re-pushes after flaky
connections are idempotent. The Supabase schema lives in
``supabase/schema.sql``.
"""

from __future__ import annotations

import json
import logging
import threading
from typing import Any

import httpx

from ..config import HubConfig
from ..database import Database
from ..events import EventBus

log = logging.getLogger("triarge.sync")


class SupabaseSync:
    def __init__(self, config: HubConfig, db: Database, bus: EventBus) -> None:
        self._config = config
        self._db = db
        self._bus = bus
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._connected = False

    @property
    def enabled(self) -> bool:
        return bool(
            self._config.supabase_enabled
            and self._config.supabase_url
            and self._config.supabase_key
        )

    @property
    def status(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "connected": self._connected,
            "pending": self._db.outbox_size(),
        }

    def start(self) -> None:
        if not self.enabled:
            log.info("supabase sync disabled (no URL/key configured) — running fully local")
            return
        self._thread = threading.Thread(
            target=self._run, name="supabase-sync", daemon=True
        )
        self._thread.start()
        log.info("supabase sync worker started (%s)", self._config.supabase_url)

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)

    def _run(self) -> None:
        headers = {
            "apikey": self._config.supabase_key,
            "Authorization": f"Bearer {self._config.supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        }
        base = self._config.supabase_url.rstrip("/") + "/rest/v1"
        client = httpx.Client(headers=headers, timeout=10.0)
        try:
            while not self._stop.wait(self._config.supabase_interval_s):
                self._drain_once(client, base)
        finally:
            client.close()

    def _drain_once(self, client: httpx.Client, base: str) -> None:
        batch = self._db.peek_outbox(limit=50)
        if not batch:
            return
        # Group by target table; latest patient state wins within a batch.
        by_table: dict[str, dict[Any, tuple[int, dict[str, Any]]]] = {}
        for row_id, table, payload in batch:
            key = payload.get("marker_id") if table == "patients" else payload.get("local_id", row_id)
            by_table.setdefault(table, {})[key] = (row_id, payload)

        acked: list[int] = []
        all_ok = True
        for table, rows in by_table.items():
            records = [
                self._to_record(table, payload) for _, payload in rows.values()
            ]
            try:
                resp = client.post(f"{base}/{table}", content=json.dumps(records))
                if resp.status_code >= 400:
                    log.warning(
                        "supabase push to %s failed: %s %s",
                        table, resp.status_code, resp.text[:200],
                    )
                    all_ok = False
                    continue
            except httpx.HTTPError as exc:
                if self._connected:
                    log.info("supabase unreachable, backing off: %s", exc)
                self._set_connected(False)
                return
            acked.extend(row_id for row_id, _ in rows.values())

        # A batch can contain several outbox rows for the same key; the ones
        # not in `rows.values()` were superseded and are safe to drop too.
        if all_ok:
            acked = [row_id for row_id, _, _ in batch]
        self._db.ack_outbox(acked)
        self._set_connected(True)

    def _to_record(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        record = dict(payload)
        record["incident_id"] = self._config.incident_id
        # Postgres columns are jsonb; nested dicts/lists pass through as-is.
        return record

    def _set_connected(self, connected: bool) -> None:
        if connected != self._connected:
            self._connected = connected
            self._bus.publish_threadsafe("sync.status", self.status)
