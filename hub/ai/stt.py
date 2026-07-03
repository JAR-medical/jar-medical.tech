"""Local speech-to-text.

faster-whisper runs entirely offline (model weights are cached locally on
first load — pre-download them before deployment, see README). If the
package or the model is unavailable, the hub still runs: transcription
requests return a clear error instead of crashing, and everything that
doesn't need STT keeps working.
"""

from __future__ import annotations

import io
import logging
import threading
import wave
from dataclasses import dataclass
from typing import Optional

import numpy as np

log = logging.getLogger("triarge.stt")


class STTUnavailable(RuntimeError):
    pass


@dataclass
class Transcription:
    text: str
    language: str
    duration_s: float


class SpeechToText:
    """Lazy-loading wrapper around faster-whisper.

    The model loads on first use (in whatever worker thread hits it first)
    behind a lock, so hub startup stays instant even with a large model.
    """

    def __init__(self, model_size: str, language: str, compute_type: str) -> None:
        self._model_size = model_size
        self._language = language
        self._compute_type = compute_type
        self._model = None
        self._load_error: Optional[str] = None
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        try:
            import faster_whisper  # noqa: F401
            return True
        except ImportError:
            return False

    def _ensure_model(self):
        with self._lock:
            if self._model is not None:
                return self._model
            if self._load_error is not None:
                raise STTUnavailable(self._load_error)
            try:
                from faster_whisper import WhisperModel
            except ImportError:
                self._load_error = (
                    "faster-whisper is not installed"
                    " (pip install -r requirements/hub-ai.txt)"
                )
                raise STTUnavailable(self._load_error)
            try:
                log.info("loading whisper model '%s' ...", self._model_size)
                self._model = WhisperModel(
                    self._model_size,
                    device="auto",
                    compute_type=self._compute_type,
                )
                log.info("whisper model ready")
            except Exception as exc:  # model download failed offline, etc.
                self._load_error = f"whisper model load failed: {exc}"
                raise STTUnavailable(self._load_error)
            return self._model

    def transcribe_wav_bytes(self, wav_bytes: bytes) -> Transcription:
        audio, sample_rate = _decode_wav(wav_bytes)
        return self.transcribe_pcm(audio, sample_rate)

    def transcribe_pcm(self, audio: np.ndarray, sample_rate: int) -> Transcription:
        """Transcribe mono float32 PCM in [-1, 1]."""
        model = self._ensure_model()
        if sample_rate != 16000:
            audio = _resample(audio, sample_rate, 16000)
        segments, info = model.transcribe(
            audio,
            language=self._language,
            beam_size=5,
            vad_filter=True,
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        return Transcription(
            text=text,
            language=info.language,
            duration_s=float(info.duration),
        )


def _decode_wav(wav_bytes: bytes) -> tuple[np.ndarray, int]:
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        sample_rate = wf.getframerate()
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())
    if width == 2:
        audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
    elif width == 4:
        audio = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
    else:
        raise ValueError(f"unsupported WAV sample width: {width} bytes")
    if channels > 1:
        audio = audio.reshape(-1, channels).mean(axis=1)
    return audio, sample_rate


def _resample(audio: np.ndarray, src_rate: int, dst_rate: int) -> np.ndarray:
    """Linear-interpolation resampler — sufficient for speech STT input."""
    if src_rate == dst_rate or audio.size == 0:
        return audio
    duration = audio.size / src_rate
    dst_n = int(duration * dst_rate)
    src_t = np.linspace(0.0, duration, num=audio.size, endpoint=False)
    dst_t = np.linspace(0.0, duration, num=dst_n, endpoint=False)
    return np.interp(dst_t, src_t, audio).astype(np.float32)
