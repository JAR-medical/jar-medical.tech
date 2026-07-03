"""Push-to-talk dictation recorder.

Captures mono 16 kHz PCM from the default microphone (the glasses' mic on
real hardware) between start() and stop(), and returns a WAV blob ready to
POST to the hub. The heavy AI (STT + structuring) deliberately lives on the
hub — the glasses only ship audio, which keeps the client light enough for
wearable compute.
"""

from __future__ import annotations

import io
import threading
import wave
from typing import Optional

import numpy as np


class DictationRecorder:
    def __init__(self, sample_rate: int = 16000) -> None:
        self._sample_rate = sample_rate
        self._chunks: list[np.ndarray] = []
        self._stream = None
        self._lock = threading.Lock()

    @property
    def recording(self) -> bool:
        return self._stream is not None

    def start(self) -> None:
        if self.recording:
            return
        import sounddevice as sd

        self._chunks = []

        def _callback(indata, frames, time_info, status) -> None:
            with self._lock:
                self._chunks.append(indata[:, 0].copy())

        self._stream = sd.InputStream(
            channels=1,
            samplerate=self._sample_rate,
            dtype="float32",
            callback=_callback,
        )
        self._stream.start()

    def stop(self) -> Optional[bytes]:
        """Stop recording and return the captured audio as WAV bytes
        (None if nothing usable was captured)."""
        if not self.recording:
            return None
        self._stream.stop()
        self._stream.close()
        self._stream = None
        with self._lock:
            chunks, self._chunks = self._chunks, []
        if not chunks:
            return None
        audio = np.concatenate(chunks)
        if audio.size < self._sample_rate // 4:  # < 250 ms — accidental tap
            return None
        pcm16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self._sample_rate)
            wf.writeframes(pcm16.tobytes())
        return buf.getvalue()
