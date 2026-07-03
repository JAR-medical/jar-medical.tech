"""Hub configuration.

Everything is configurable through environment variables so the same build
runs on an offline incident-command laptop and on a connected machine with
Supabase sync enabled. No config file parsing, no non-stdlib dependencies.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _env_bool(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class HubConfig:
    # Networking — bind to all interfaces so clients on the incident LAN
    # (e.g. a field WiFi access point) can reach the hub.
    host: str = os.environ.get("TRIARGE_HOST", "0.0.0.0")
    port: int = int(os.environ.get("TRIARGE_PORT", "8087"))

    # Storage
    data_dir: Path = field(
        default_factory=lambda: Path(os.environ.get("TRIARGE_DATA_DIR", "data"))
    )

    # Local speech-to-text (faster-whisper). "small" is a good latency/quality
    # tradeoff for German medical dictation on Apple Silicon; use "medium"
    # if the command computer has headroom.
    stt_model: str = os.environ.get("TRIARGE_STT_MODEL", "small")
    stt_language: str = os.environ.get("TRIARGE_STT_LANGUAGE", "de")
    stt_compute_type: str = os.environ.get("TRIARGE_STT_COMPUTE", "int8")

    # Local LLM structuring via Ollama. If Ollama is not running the hub
    # falls back to the built-in rule-based extractor automatically.
    ollama_url: str = os.environ.get("TRIARGE_OLLAMA_URL", "http://127.0.0.1:11434")
    ollama_model: str = os.environ.get("TRIARGE_OLLAMA_MODEL", "llama3.1:8b")
    ollama_timeout_s: float = float(os.environ.get("TRIARGE_OLLAMA_TIMEOUT", "30"))

    # Radio (Sprechfunk) capture on the command computer. Device may be a
    # sounddevice index or a substring of the device name ("" = default input,
    # i.e. built-in mic or the AUX/line-in interface).
    radio_device: str = os.environ.get("TRIARGE_RADIO_DEVICE", "")
    radio_sample_rate: int = int(os.environ.get("TRIARGE_RADIO_SR", "16000"))
    # Energy-gate voice activity detection tuning.
    radio_vad_threshold: float = float(os.environ.get("TRIARGE_RADIO_VAD", "0.012"))
    radio_min_speech_s: float = 0.6
    radio_max_segment_s: float = 30.0
    radio_hangover_s: float = 0.9

    # Optional hybrid Supabase sync (outbox push; local DB stays the source
    # of truth). Leave URL empty to run fully offline.
    supabase_url: str = os.environ.get("TRIARGE_SUPABASE_URL", "")
    supabase_key: str = os.environ.get("TRIARGE_SUPABASE_KEY", "")
    supabase_interval_s: float = float(os.environ.get("TRIARGE_SUPABASE_INTERVAL", "10"))
    supabase_enabled: bool = _env_bool("TRIARGE_SUPABASE_ENABLED", True)

    # Incident identifier, stamped on synced rows so multiple MCIs can share
    # one Supabase project.
    incident_id: str = os.environ.get("TRIARGE_INCIDENT_ID", "local-incident")

    @property
    def db_path(self) -> Path:
        return self.data_dir / "triarge.db"

    @property
    def audio_dir(self) -> Path:
        """Raw dictation/radio audio is archived for medico-legal traceability."""
        return self.data_dir / "audio"


CONFIG = HubConfig()
