"""J.A.R. transcription server for the "Demo: transcription" course.

Implements the contract in corporate/README.md ("Transkriptions-Server"):

    POST /transcribe   multipart/form-data: audio (file), language ("de" | "en")
    → 200 {"language": "de", "segments": [{"start", "end", "speaker", "text"}]}

Speech recognition and word timing come from WhisperX, speakers from the
pyannote diarization pipeline. The models load once at start-up; one recording
is processed at a time (a second request while busy gets 503, which the
website shows as "server busy"). Settings come from environment variables,
see README.md in this folder.
"""
import inspect
import logging
import os
import tempfile
import threading
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

log = logging.getLogger("jar-stt")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

MODEL = os.environ.get("STT_MODEL", "large-v3")
DEVICE = os.environ.get("STT_DEVICE", "cuda")
COMPUTE = os.environ.get("STT_COMPUTE", "float16" if DEVICE == "cuda" else "int8")
HF_TOKEN = os.environ.get("HF_TOKEN", "")
ORIGINS = [o.strip() for o in os.environ.get(
    "STT_ORIGINS", "https://jar-medical.tech,https://www.jar-medical.tech").split(",") if o.strip()]
MAX_BYTES = int(os.environ.get("STT_MAX_BYTES", str(20 * 1024 * 1024)))
MAX_SECONDS = float(os.environ.get("STT_MAX_SECONDS", "70"))  # the site stops at 60 s
PER_IP_PER_HOUR = int(os.environ.get("STT_PER_IP_PER_HOUR", "30"))
LANGUAGES = {"de", "en"}
SAMPLE_RATE = 16000


class Engine:
    """WhisperX + alignment + pyannote, loaded once."""

    def __init__(self):
        import whisperx  # heavy import, only in the real server

        self.wx = whisperx
        log.info("loading %s on %s (%s)", MODEL, DEVICE, COMPUTE)
        self.asr = whisperx.load_model(MODEL, DEVICE, compute_type=COMPUTE)
        self.align = {}  # language → (model, metadata), loaded on first use
        try:
            from whisperx.diarize import DiarizationPipeline
        except ImportError:  # whisperx < 3.4
            DiarizationPipeline = whisperx.DiarizationPipeline
        params = inspect.signature(DiarizationPipeline).parameters
        token_arg = "token" if "token" in params else "use_auth_token"
        self.diarizer = DiarizationPipeline(**{token_arg: HF_TOKEN or None}, device=DEVICE)
        log.info("models ready")

    def __call__(self, path, language):
        audio = self.wx.load_audio(path)
        seconds = len(audio) / SAMPLE_RATE
        if seconds > MAX_SECONDS:
            raise HTTPException(413, f"recording longer than {MAX_SECONDS:.0f} s")
        result = self.asr.transcribe(audio, batch_size=16, language=language)
        if not result.get("segments"):
            return {"language": language, "segments": []}
        if language not in self.align:
            self.align[language] = self.wx.load_align_model(language_code=language, device=DEVICE)
        model_a, meta = self.align[language]
        result = self.wx.align(result["segments"], model_a, meta, audio, DEVICE, return_char_alignments=False)
        result = self.wx.assign_word_speakers(self.diarizer(audio), result)
        return {"language": language, "segments": to_contract(result["segments"])}


def to_contract(segments):
    """WhisperX segments → the website's segment shape (speaker always set)."""
    out = []
    for s in segments:
        text = str(s.get("text", "")).strip()
        start, end = s.get("start"), s.get("end")
        if not text or start is None or end is None:
            continue
        start, end = round(float(start), 2), round(float(end), 2)
        out.append({"start": max(0.0, start), "end": max(start, end),
                    "speaker": str(s.get("speaker") or "UNKNOWN"), "text": text})
    return out


engine = None  # set at start-up; tests replace it
busy = threading.Lock()
recent = defaultdict(deque)  # client ip → request times in the last hour


@asynccontextmanager
async def lifespan(_app):
    global engine
    if engine is None:
        engine = Engine()
    yield


app = FastAPI(title="J.A.R. transcription", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["POST", "GET"], allow_headers=[], max_age=3600)


def client_ip(request):
    # Behind the Cloudflare Tunnel every request comes from localhost;
    # Cloudflare passes the visitor's address in this header.
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "?")


def check_rate(ip):
    now = time.monotonic()
    q = recent[ip]
    while q and now - q[0] > 3600:
        q.popleft()
    if len(q) >= PER_IP_PER_HOUR:
        raise HTTPException(429, "too many recordings, try again later")
    q.append(now)


@app.get("/health")
def health():
    return {"ok": engine is not None, "busy": busy.locked(), "model": MODEL}


@app.post("/transcribe")
def transcribe(request: Request, audio: UploadFile = File(...), language: str = Form("de")):
    if language not in LANGUAGES:
        raise HTTPException(400, "language must be de or en")
    if engine is None:
        raise HTTPException(503, "models are still loading")
    check_rate(client_ip(request))
    if not busy.acquire(blocking=False):
        raise HTTPException(503, "busy")
    path = None
    try:
        size = 0
        with tempfile.NamedTemporaryFile(prefix="jar-stt-", delete=False) as tmp:
            path = tmp.name
            while chunk := audio.file.read(1 << 20):
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(413, "recording too large")
                tmp.write(chunk)
        if size == 0:
            raise HTTPException(400, "empty recording")
        started = time.monotonic()
        try:
            result = engine(path, language)
        except HTTPException:
            raise
        except Exception:
            log.exception("transcription failed")
            raise HTTPException(500, "transcription failed")
        log.info("%s: %d bytes, %d segments, %.1f s", language, size, len(result["segments"]), time.monotonic() - started)
        return result
    finally:
        busy.release()
        if path:
            try:
                os.unlink(path)  # recordings are never kept
            except OSError:
                pass
