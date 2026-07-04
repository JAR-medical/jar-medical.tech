"""TriARge Hub — FastAPI application.

Run with:  python -m hub.main   (or scripts/run_hub.sh)

Endpoints:
  GET  /                                   dashboard (Einsatzleitung web UI)
  GET  /api/health                         liveness + subsystem status
  GET  /api/patients                       all patients
  GET  /api/patients/{marker_id}           one patient
  POST /api/patients/{marker_id}/claim     create-on-first-sight (client marker hit)
  PATCH /api/patients/{marker_id}          manual structured update (dashboard/client)
  POST /api/patients/{marker_id}/dictation WAV audio -> STT -> structuring -> update
  GET  /api/patients/{marker_id}/protocol  audit trail for one patient
  GET  /api/radio/log                      recent radio transmissions
  POST /api/radio/start | /api/radio/stop  radio monitor control
  GET  /api/sync/status                    Supabase sync state
  WS   /ws                                 live event stream (see hub/events.py)
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .ai.structurer import MedicalStructurer
from .ai.stt import SpeechToText, STTUnavailable
from .ai.radio import RadioMonitor
from .config import CONFIG
from .events import BUS
from .models import PatientUpdate
from .sessions import SessionManager
from .sync.supabase_sync import SupabaseSync
from .teams import TeamRegistry

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s: %(message)s",
)
log = logging.getLogger("triarge.hub")

sessions = SessionManager(CONFIG)
stt = SpeechToText(CONFIG.stt_model, CONFIG.stt_language, CONFIG.stt_compute_type)
structurer = MedicalStructurer(
    CONFIG.ollama_url, CONFIG.ollama_model, CONFIG.ollama_timeout_s
)
radio = RadioMonitor(CONFIG, sessions, BUS, stt, structurer)
sync = SupabaseSync(CONFIG, sessions, BUS)
teams = TeamRegistry(CONFIG.data_dir / "teams.json")


@asynccontextmanager
async def lifespan(app: FastAPI):
    BUS.bind_loop(asyncio.get_running_loop())
    CONFIG.audio_dir.mkdir(parents=True, exist_ok=True)
    sync.start()
    log.info(
        "TriARge hub v%s ready on %s:%s (session=%s, stt=%s, structurer=%s)",
        __version__, CONFIG.host, CONFIG.port, sessions.current_name,
        "available" if stt.available else "MISSING",
        structurer.engine_name,
    )
    yield
    radio.stop()
    sync.stop()
    sessions.close()


app = FastAPI(title="TriARge Hub", version=__version__, lifespan=lifespan)


@app.middleware("http")
async def no_cache_ui(request: Request, call_next):
    """Dashboard HTML/JS/CSS must never be served stale: a browser running
    a cached old app.js against new markup dies on load ('blank page').
    The assets are tiny and served over the local LAN — caching buys
    nothing and has already cost debugging time twice."""
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.startswith(("/static", "/patient")):
        response.headers["Cache-Control"] = "no-store, must-revalidate"
    return response


# ------------------------------------------------------------------ health

@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "version": __version__,
        "session": sessions.current_name,
        "stt_available": stt.available,
        "structurer": structurer.engine_name,
        "radio": radio.status,
        "sync": sync.status,
        "patients": len(sessions.db.list_patients()),
    }


# ---------------------------------------------------------------- sessions

@app.get("/api/sessions")
def list_sessions() -> list[dict]:
    return sessions.list_sessions()


@app.post("/api/sessions")
async def create_session(name: str = Query("")) -> dict:
    """Start a fresh session (Einsatz). Nothing is deleted — the previous
    session's database stays on disk and can be reactivated any time."""
    info = sessions.new_session(name or None)
    await _announce_session_change()
    log.info("new session started: %s", sessions.current_name)
    return info


@app.post("/api/sessions/{name}/activate")
async def activate_session(name: str) -> dict:
    try:
        info = sessions.switch(name)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    await _announce_session_change()
    log.info("switched to session: %s", sessions.current_name)
    return info


async def _announce_session_change() -> None:
    _sightings.clear()
    await BUS.publish("session.changed", {
        "name": sessions.current_name,
        "sessions": sessions.list_sessions(),
    })


# ------------------------------------------------------- teams (Trupps)

@app.get("/api/teams")
def list_teams() -> list[dict]:
    return teams.list()


@app.post("/api/teams")
async def add_team(name: str = Query(...), note: str = Query("")) -> dict:
    if not name.strip():
        raise HTTPException(status_code=400, detail="team name required")
    created = teams.add(name, note)
    await BUS.publish("teams", teams.list())
    return {"name": name.strip(), "created": created}


@app.delete("/api/teams/{name}")
async def remove_team(name: str) -> dict:
    if not teams.remove(name):
        raise HTTPException(status_code=404, detail=f"unknown team {name!r}")
    await BUS.publish("teams", teams.list())
    return {"deleted": name}


@app.post("/api/teams/{name}/heartbeat")
async def team_heartbeat(name: str, marker: int | None = Query(None)) -> dict:
    if teams.touch(name, marker):
        await BUS.publish("teams", teams.list())
    return {"ok": True}


# ---------------------------------------------------------------- patients

# Ephemeral presence: which client last had eyes on which marker. Kept in
# memory only — it is situational awareness, not part of the medical record.
_sightings: dict[int, dict] = {}


@app.get("/api/patients")
def list_patients() -> list[dict]:
    return [
        p.model_dump(mode="json") | {"last_seen": _sightings.get(p.marker_id)}
        for p in sessions.db.list_patients()
    ]


@app.get("/api/patients/{marker_id}")
def get_patient(marker_id: int) -> dict:
    patient = sessions.db.get_patient(marker_id)
    if patient is None:
        raise HTTPException(status_code=404, detail=f"no patient for marker {marker_id}")
    return patient.model_dump(mode="json")


@app.post("/api/patients/{marker_id}/claim")
async def claim_patient(marker_id: int) -> dict:
    """Called by a paramedic client the moment it first detects a marker.
    Idempotent: returns the existing record if the marker is already known."""
    patient, created = sessions.db.ensure_patient(marker_id)
    if created:
        await BUS.publish("patient.created", patient)
        log.info("marker %d claimed — new patient record", marker_id)
    return patient.model_dump(mode="json")


@app.patch("/api/patients/{marker_id}")
async def update_patient(
    marker_id: int,
    update: PatientUpdate,
    source: str = Query("dashboard"),
    author: str = Query(""),
) -> dict:
    if update.is_empty():
        raise HTTPException(status_code=400, detail="empty update")
    patient = sessions.db.apply_update(marker_id, update, source=source, author=author)
    await BUS.publish("patient.updated", patient)
    return patient.model_dump(mode="json")


@app.get("/api/patients/{marker_id}/protocol")
def get_protocol(marker_id: int) -> list[dict]:
    return [e.model_dump(mode="json") for e in sessions.db.list_protocol(marker_id)]


@app.post("/api/patients/{marker_id}/seen")
async def patient_seen(marker_id: int, author: str = Query("")) -> dict:
    """Throttled presence ping from a field client that currently has the
    marker in view. Feeds the 'gesehen von …' indicator on the dashboard."""
    from datetime import datetime, timezone

    info = {
        "marker_id": marker_id,
        "by": author,
        "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    _sightings[marker_id] = info
    await BUS.publish("patient.seen", info)
    if author and teams.touch(author, marker_id):
        await BUS.publish("teams", teams.list())
    return info


@app.delete("/api/patients/{marker_id}")
async def delete_patient(marker_id: int) -> dict:
    """Remove a patient record entirely — for phantom patients created by
    marker misreads. Real records should be recategorized, not deleted."""
    if not sessions.db.delete_patient(marker_id):
        raise HTTPException(status_code=404, detail=f"no patient for marker {marker_id}")
    _sightings.pop(marker_id, None)
    await BUS.publish("patient.deleted", {"marker_id": marker_id})
    log.info("patient %d deleted", marker_id)
    return {"deleted": marker_id}


# --------------------------------------------------------------- dictation

@app.post("/api/patients/{marker_id}/dictation")
async def dictate(marker_id: int, request: Request, author: str = Query("")) -> dict:
    """Voice protocoling: raw WAV body in, structured patient update out.

    The heavy lifting (whisper + LLM) runs in a worker thread so the event
    loop keeps serving the dashboard and other clients meanwhile.
    """
    wav_bytes = await request.body()
    if len(wav_bytes) < 128:
        raise HTTPException(status_code=400, detail="no audio received")

    audio_file = CONFIG.audio_dir / f"dictation_{marker_id}_{int(time.time() * 1000)}.wav"
    audio_file.write_bytes(wav_bytes)

    try:
        transcription = await asyncio.to_thread(stt.transcribe_wav_bytes, wav_bytes)
    except STTUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        log.exception("dictation transcription failed")
        raise HTTPException(status_code=500, detail=f"transcription failed: {exc}")

    if not transcription.text.strip():
        return {"transcript": "", "applied": False,
                "detail": "no speech recognized"}

    update = await asyncio.to_thread(structurer.structure, transcription.text)
    patient = sessions.db.apply_update(
        marker_id, update,
        source="dictation", author=author,
        transcript=transcription.text, audio_file=audio_file.name,
    )
    await BUS.publish("patient.updated", patient)
    if author and teams.touch(author, marker_id):
        await BUS.publish("teams", teams.list())
    log.info("dictation for marker %d by %r: %s", marker_id, author, transcription.text)
    return {
        "transcript": transcription.text,
        "applied": True,
        "structured": update.model_dump(mode="json", exclude_none=True, exclude_defaults=True),
        "patient": patient.model_dump(mode="json"),
    }


# ------------------------------------------------------------------- radio

@app.post("/api/radio/start")
async def radio_start() -> dict:
    try:
        await asyncio.to_thread(radio.start)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return radio.status


@app.post("/api/radio/stop")
async def radio_stop() -> dict:
    await asyncio.to_thread(radio.stop)
    return radio.status


@app.get("/api/radio/log")
def radio_log(limit: int = Query(100, le=500)) -> list[dict]:
    return [e.model_dump(mode="json") for e in sessions.db.list_radio_log(limit)]


# -------------------------------------------------------------------- sync

@app.get("/api/sync/status")
def sync_status() -> dict:
    return sync.status


# --------------------------------------------------------------- websocket

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await BUS.connect(ws)
    try:
        while True:
            # Clients only listen; we read to detect disconnects/pings.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await BUS.disconnect(ws)


# --------------------------------------------------------------- dashboard

_STATIC_DIR = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")


@app.get("/")
def dashboard() -> FileResponse:
    return FileResponse(_STATIC_DIR / "index.html")


@app.get("/patient/{marker_id}")
def patient_window(marker_id: int) -> FileResponse:
    """Standalone live patient window (opened from the dashboard board)."""
    return FileResponse(_STATIC_DIR / "patient.html")


@app.exception_handler(404)
async def not_found(request: Request, exc) -> JSONResponse:
    return JSONResponse(status_code=404, content={"detail": "not found"})


def run() -> None:
    import uvicorn

    uvicorn.run(app, host=CONFIG.host, port=CONFIG.port, log_level="info")


if __name__ == "__main__":
    run()
