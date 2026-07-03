"""WebSocket event bus.

Every state change on the hub is broadcast as a JSON event to all connected
clients — the dashboard and every paramedic client. This is what makes an
update dictated by one paramedic appear instantly in the overlay of the
next paramedic who walks up to the same patient.

Event envelope: {"type": "<event>", "payload": {...}}

Event types:
  patient.created   payload = Patient
  patient.updated   payload = Patient
  radio.transcript  payload = RadioLogEntry
  radio.status      payload = {"running": bool, "device": str}
  sync.status       payload = {"connected": bool, "pending": int}
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

log = logging.getLogger("triarge.events")


class EventBus:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()
        self._lock = asyncio.Lock()
        self._loop: asyncio.AbstractEventLoop | None = None

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Remember the server loop so worker threads can publish safely."""
        self._loop = loop

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)
        log.info("ws client connected (%d total)", len(self._clients))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self._clients.discard(ws)
        log.info("ws client disconnected (%d total)", len(self._clients))

    async def publish(self, event_type: str, payload: Any) -> None:
        message = json.dumps(
            {"type": event_type, "payload": _jsonable(payload)},
            ensure_ascii=False,
        )
        async with self._lock:
            clients = list(self._clients)
        dead: list[WebSocket] = []
        for ws in clients:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self._clients.discard(ws)

    def publish_threadsafe(self, event_type: str, payload: Any) -> None:
        """Publish from a non-async worker thread (radio monitor, sync)."""
        if self._loop is None or self._loop.is_closed():
            return
        asyncio.run_coroutine_threadsafe(
            self.publish(event_type, payload), self._loop
        )


def _jsonable(payload: Any) -> Any:
    if hasattr(payload, "model_dump"):
        return payload.model_dump(mode="json")
    return payload


BUS = EventBus()
