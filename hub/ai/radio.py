"""Radio (Sprechfunk) monitor.

Captures the audio input of the incident-command computer — built-in
microphone or an AUX/line-in cable from the radio set — segments speech
with an energy gate, transcribes each transmission locally and mines it
for patient references and medical facts.

Every transmission lands in the radio log (and on the dashboard live).
If a transmission unambiguously references marker numbers ("Patient 12
jetzt Sichtungskategorie rot"), the extracted facts are applied to those
patients with source="radio", so radio traffic keeps the triage picture
current even for patients no paramedic client is currently looking at.
"""

from __future__ import annotations

import logging
import queue
import threading
from typing import Callable, Optional

import numpy as np

from ..config import HubConfig
from ..database import Database
from ..events import EventBus
from ..models import PatientUpdate
from .structurer import MedicalStructurer, extract_patient_refs
from .stt import SpeechToText, STTUnavailable

log = logging.getLogger("triarge.radio")


class RadioMonitor:
    def __init__(
        self,
        config: HubConfig,
        db: Database,
        bus: EventBus,
        stt: SpeechToText,
        structurer: MedicalStructurer,
    ) -> None:
        self._config = config
        self._db = db
        self._bus = bus
        self._stt = stt
        self._structurer = structurer

        self._stream = None
        self._worker: Optional[threading.Thread] = None
        self._running = threading.Event()
        self._blocks: "queue.Queue[np.ndarray]" = queue.Queue(maxsize=256)
        self._device_label = ""
        self._last_error = ""

    # ------------------------------------------------------------ lifecycle

    @property
    def running(self) -> bool:
        return self._running.is_set()

    @property
    def status(self) -> dict:
        return {
            "running": self.running,
            "device": self._device_label,
            "stt_available": self._stt.available,
            "error": self._last_error,
        }

    def start(self) -> None:
        if self.running:
            return
        try:
            import sounddevice as sd
        except ImportError as exc:
            self._last_error = f"sounddevice not installed: {exc}"
            raise RuntimeError(self._last_error)

        device = self._resolve_device(sd)
        self._last_error = ""
        self._running.set()
        self._worker = threading.Thread(
            target=self._process_loop, name="radio-worker", daemon=True
        )
        self._worker.start()

        def _callback(indata, frames, time_info, status) -> None:
            if status:
                log.debug("radio stream status: %s", status)
            try:
                self._blocks.put_nowait(indata[:, 0].copy())
            except queue.Full:
                pass  # transcription is behind; dropping audio beats blocking capture

        self._stream = sd.InputStream(
            device=device,
            channels=1,
            samplerate=self._config.radio_sample_rate,
            blocksize=int(self._config.radio_sample_rate * 0.1),
            dtype="float32",
            callback=_callback,
        )
        self._stream.start()
        log.info("radio monitor started on device %r", self._device_label)
        self._bus.publish_threadsafe("radio.status", self.status)

    def stop(self) -> None:
        if not self.running:
            return
        self._running.clear()
        if self._stream is not None:
            try:
                self._stream.stop()
                self._stream.close()
            finally:
                self._stream = None
        if self._worker is not None:
            self._worker.join(timeout=5)
            self._worker = None
        log.info("radio monitor stopped")
        self._bus.publish_threadsafe("radio.status", self.status)

    def _resolve_device(self, sd) -> Optional[int]:
        spec = self._config.radio_device.strip()
        if not spec:
            self._device_label = "default input"
            return None
        if spec.isdigit():
            self._device_label = f"device #{spec}"
            return int(spec)
        for idx, dev in enumerate(sd.query_devices()):
            if dev["max_input_channels"] > 0 and spec.lower() in dev["name"].lower():
                self._device_label = dev["name"]
                return idx
        raise RuntimeError(f"no input device matching {spec!r}")

    # ------------------------------------------------------- speech gating

    def _process_loop(self) -> None:
        """Energy-gated segmentation: accumulate while above threshold,
        flush a segment after `hangover_s` of silence or `max_segment_s`."""
        sr = self._config.radio_sample_rate
        threshold = self._config.radio_vad_threshold
        hangover_blocks = max(1, int(self._config.radio_hangover_s / 0.1))
        max_blocks = int(self._config.radio_max_segment_s / 0.1)
        min_samples = int(self._config.radio_min_speech_s * sr)

        segment: list[np.ndarray] = []
        silent_blocks = 0
        in_speech = False

        while self._running.is_set():
            try:
                block = self._blocks.get(timeout=0.5)
            except queue.Empty:
                continue
            rms = float(np.sqrt(np.mean(block**2)))
            if rms >= threshold:
                in_speech = True
                silent_blocks = 0
                segment.append(block)
            elif in_speech:
                silent_blocks += 1
                segment.append(block)
                if silent_blocks >= hangover_blocks:
                    self._flush_segment(segment, min_samples, sr)
                    segment, in_speech, silent_blocks = [], False, 0
            if in_speech and len(segment) >= max_blocks:
                self._flush_segment(segment, min_samples, sr)
                segment, in_speech, silent_blocks = [], False, 0

        if segment:
            self._flush_segment(segment, min_samples, sr)

    def _flush_segment(
        self, segment: list[np.ndarray], min_samples: int, sample_rate: int
    ) -> None:
        audio = np.concatenate(segment)
        if audio.size < min_samples:
            return
        try:
            result = self._stt.transcribe_pcm(audio, sample_rate)
        except STTUnavailable as exc:
            self._last_error = str(exc)
            log.warning("radio STT unavailable: %s", exc)
            self._bus.publish_threadsafe("radio.status", self.status)
            return
        except Exception:
            log.exception("radio transcription failed")
            return
        text = result.text.strip()
        if not text:
            return
        self._handle_transmission(text)

    # ---------------------------------------------------------- processing

    def _handle_transmission(self, text: str) -> None:
        refs = extract_patient_refs(text)
        update = self._structurer.structure(text)
        structured = update.model_dump(exclude_none=True, exclude_defaults=True)
        structured.pop("note", None)

        entry = self._db.add_radio_entry(text, refs, structured)
        self._bus.publish_threadsafe("radio.transcript", entry)
        log.info("radio: %s (refs=%s)", text, refs)

        if not refs or update.is_empty():
            return
        # Apply extracted facts to each referenced patient. Radio-sourced
        # notes are prefixed so their provenance stays visible in the record.
        for marker_id in refs:
            applied = PatientUpdate(**update.model_dump(exclude={"note"}))
            applied.note = f"[Funk] {text}"
            patient = self._db.apply_update(
                marker_id, applied, source="radio", author="funk",
                transcript=text,
            )
            self._bus.publish_threadsafe("patient.updated", patient)
