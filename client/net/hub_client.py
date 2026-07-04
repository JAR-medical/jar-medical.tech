"""Hub connectivity: REST client, live WebSocket event feed and an
offline dictation spool.

Field networks drop. The client therefore:
- caches patient records so an already-fetched overlay keeps working
  through hub outages,
- spools dictations to disk when the hub is unreachable and replays them
  automatically on reconnect (nothing a medic says is ever lost),
- reconnects the WebSocket with backoff and re-fetches state on reconnect.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Awaitable, Callable, Optional

import httpx
import websockets

log = logging.getLogger("triarge.client.net")

PatientCallback = Callable[[dict[str, Any]], Awaitable[None]]


class HubClient:
    def __init__(self, hub_url: str, ws_url: str, medic_id: str, spool_dir: str) -> None:
        self._hub_url = hub_url.rstrip("/")
        self._ws_url = ws_url
        self._medic_id = medic_id
        self._spool = Path(spool_dir)
        self._spool.mkdir(parents=True, exist_ok=True)
        self._http = httpx.AsyncClient(base_url=self._hub_url, timeout=60.0)
        self._cache: dict[int, dict[str, Any]] = {}
        self._on_patient: Optional[PatientCallback] = None
        self._on_connection_change: Optional[Callable[[bool], Awaitable[None]]] = None
        self._on_session_change: Optional[Callable[[str], Awaitable[None]]] = None
        self._connected = False
        self._tasks: list[asyncio.Task] = []

    @property
    def connected(self) -> bool:
        return self._connected

    def patient_cached(self, marker_id: int) -> Optional[dict[str, Any]]:
        return self._cache.get(marker_id)

    def start(
        self,
        on_patient: PatientCallback,
        on_connection_change: Optional[Callable[[bool], Awaitable[None]]] = None,
        on_session_change: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> None:
        self._on_patient = on_patient
        self._on_connection_change = on_connection_change
        self._on_session_change = on_session_change
        self._tasks.append(asyncio.create_task(self._ws_loop(), name="hub-ws"))
        self._tasks.append(asyncio.create_task(self._spool_loop(), name="spool"))

    async def close(self) -> None:
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        await self._http.aclose()

    # ------------------------------------------------------------------ REST

    async def claim_patient(self, marker_id: int) -> Optional[dict[str, Any]]:
        """First marker sight: fetch-or-create the patient record."""
        try:
            resp = await self._http.post(f"/api/patients/{marker_id}/claim")
            resp.raise_for_status()
            patient = resp.json()
            self._cache[marker_id] = patient
            return patient
        except httpx.HTTPError as exc:
            log.warning("claim %d failed (%s) — using cache", marker_id, exc)
            return self._cache.get(marker_id)

    async def update_patient(
        self, marker_id: int, update: dict[str, Any]
    ) -> Optional[dict[str, Any]]:
        try:
            resp = await self._http.patch(
                f"/api/patients/{marker_id}",
                params={"source": "client", "author": self._medic_id},
                json=update,
            )
            resp.raise_for_status()
            patient = resp.json()
            self._cache[marker_id] = patient
            return patient
        except httpx.HTTPError as exc:
            log.warning("update %d failed: %s", marker_id, exc)
            return None

    async def report_seen(self, marker_id: int) -> None:
        """Fire-and-forget presence ping ('this medic sees this marker')."""
        try:
            await self._http.post(
                f"/api/patients/{marker_id}/seen",
                params={"author": self._medic_id},
                timeout=5.0,
            )
        except httpx.HTTPError:
            pass  # presence is best-effort; never disturb the client for it

    async def send_dictation(
        self, marker_id: int, wav_bytes: bytes
    ) -> Optional[dict[str, Any]]:
        """POST dictation audio; on network failure spool it for later."""
        try:
            resp = await self._http.post(
                f"/api/patients/{marker_id}/dictation",
                params={"author": self._medic_id},
                content=wav_bytes,
                headers={"Content-Type": "audio/wav"},
                timeout=120.0,  # whisper on a big model can take a moment
            )
            resp.raise_for_status()
            result = resp.json()
            if patient := result.get("patient"):
                self._cache[marker_id] = patient
            return result
        except httpx.HTTPError as exc:
            self._spool_dictation(marker_id, wav_bytes)
            log.warning("hub unreachable — dictation for #%d spooled (%s)", marker_id, exc)
            return None

    # ------------------------------------------------------------- websocket

    async def _ws_loop(self) -> None:
        backoff = 1.0
        while True:
            try:
                async with websockets.connect(self._ws_url) as ws:
                    await self._set_connected(True)
                    backoff = 1.0
                    async for raw in ws:
                        await self._handle_event(json.loads(raw))
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                log.debug("ws disconnected: %s", exc)
            await self._set_connected(False)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 15.0)

    async def _handle_event(self, event: dict[str, Any]) -> None:
        event_type = event.get("type")
        if event_type in ("patient.created", "patient.updated"):
            patient = event["payload"]
            marker_id = patient["marker_id"]
            self._cache[marker_id] = patient
            if self._on_patient is not None:
                await self._on_patient(patient)
        elif event_type == "patient.deleted":
            self._cache.pop(event["payload"]["marker_id"], None)
        elif event_type == "session.changed":
            # New incident: everything cached belongs to the old session.
            self._cache.clear()
            if self._on_session_change is not None:
                await self._on_session_change(event["payload"].get("name", ""))

    async def _set_connected(self, connected: bool) -> None:
        if connected == self._connected:
            return
        self._connected = connected
        if self._on_connection_change is not None:
            await self._on_connection_change(connected)

    # ----------------------------------------------------------------- spool

    def _spool_dictation(self, marker_id: int, wav_bytes: bytes) -> None:
        stem = f"{int(time.time() * 1000)}_{marker_id}_{uuid.uuid4().hex[:6]}"
        (self._spool / f"{stem}.wav").write_bytes(wav_bytes)

    async def _spool_loop(self) -> None:
        """Replay spooled dictations whenever the hub is reachable again."""
        while True:
            await asyncio.sleep(5.0)
            if not self._connected:
                continue
            for wav_path in sorted(self._spool.glob("*.wav")):
                try:
                    marker_id = int(wav_path.stem.split("_")[1])
                except (IndexError, ValueError):
                    wav_path.unlink(missing_ok=True)
                    continue
                wav_bytes = wav_path.read_bytes()
                try:
                    resp = await self._http.post(
                        f"/api/patients/{marker_id}/dictation",
                        params={"author": self._medic_id},
                        content=wav_bytes,
                        headers={"Content-Type": "audio/wav"},
                        timeout=120.0,
                    )
                    resp.raise_for_status()
                except httpx.HTTPError:
                    break  # still flaky; retry the whole spool next round
                wav_path.unlink(missing_ok=True)
                log.info("spooled dictation for #%d delivered", marker_id)
