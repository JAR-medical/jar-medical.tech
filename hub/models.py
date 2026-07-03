"""Domain models shared across the hub.

Triage follows the German Sichtungskategorien (SK I–IV) used at MCI
(MANV) scenes, plus DECEASED and UNSIGHTED (marker deployed, patient not
yet triaged).
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class TriageCategory(str, Enum):
    SK1 = "SK1"            # rot — akute vitale Bedrohung, Sofortbehandlung
    SK2 = "SK2"            # gelb — schwer verletzt, aufgeschobene Behandlung
    SK3 = "SK3"            # gruen — leicht verletzt, spätere Behandlung
    SK4 = "SK4"            # blau — ohne Überlebenschance, betreuende Behandlung
    DECEASED = "DECEASED"  # schwarz
    UNSIGHTED = "UNSIGHTED"

    @property
    def display(self) -> str:
        return _CATEGORY_DISPLAY[self]


_CATEGORY_DISPLAY = {
    TriageCategory.SK1: "SK I (rot)",
    TriageCategory.SK2: "SK II (gelb)",
    TriageCategory.SK3: "SK III (grün)",
    TriageCategory.SK4: "SK IV (blau)",
    TriageCategory.DECEASED: "verstorben (schwarz)",
    TriageCategory.UNSIGHTED: "ungesichtet",
}


class Vitals(BaseModel):
    """Sparse vital signs — only fields that were actually assessed are set."""

    breathing_rate: Optional[int] = None   # Atemfrequenz /min
    pulse: Optional[int] = None            # Puls /min
    spo2: Optional[int] = None             # Sauerstoffsättigung %
    bp_systolic: Optional[int] = None      # RR systolisch mmHg
    bp_diastolic: Optional[int] = None
    gcs: Optional[int] = None              # Glasgow Coma Scale 3–15
    capillary_refill_s: Optional[float] = None


class PatientUpdate(BaseModel):
    """A partial update to a patient record.

    Produced by the AI structurer (dictation / radio), the dashboard or a
    field client. Only non-None / non-empty fields are applied; list fields
    are merged (union), never truncated — field protocols only ever grow.
    """

    category: Optional[TriageCategory] = None
    sex: Optional[str] = None              # "m" / "w" / "d"
    age_estimate: Optional[int] = None
    ambulatory: Optional[bool] = None      # gehfähig
    conscious: Optional[bool] = None       # ansprechbar
    airway_clear: Optional[bool] = None
    location: Optional[str] = None
    vitals: Optional[Vitals] = None
    injuries: list[str] = Field(default_factory=list)
    treatments: list[str] = Field(default_factory=list)
    note: Optional[str] = None

    def is_empty(self) -> bool:
        scalar_fields = (
            self.category, self.sex, self.age_estimate, self.ambulatory,
            self.conscious, self.airway_clear, self.location, self.note,
        )
        has_vitals = self.vitals is not None and bool(
            self.vitals.model_dump(exclude_none=True)
        )
        return (
            not any(v is not None for v in scalar_fields)
            and not self.injuries
            and not self.treatments
            and not has_vitals
        )


class Patient(BaseModel):
    """Full patient record. ``marker_id`` is the ArUco marker on the patient
    and the primary identifier throughout the whole system."""

    marker_id: int
    category: TriageCategory = TriageCategory.UNSIGHTED
    sex: Optional[str] = None
    age_estimate: Optional[int] = None
    ambulatory: Optional[bool] = None
    conscious: Optional[bool] = None
    airway_clear: Optional[bool] = None
    location: Optional[str] = None
    vitals: Vitals = Field(default_factory=Vitals)
    injuries: list[str] = Field(default_factory=list)
    treatments: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    version: int = 0
    created_at: str = ""
    updated_at: str = ""


class ProtocolEntry(BaseModel):
    """One immutable entry in a patient's protocol (audit trail)."""

    id: int = 0
    marker_id: int
    timestamp: str = ""
    source: str = "manual"                 # dictation | radio | dashboard | client
    author: str = ""                       # medic call sign / dashboard user
    transcript: str = ""                   # raw speech-to-text output
    structured: dict[str, Any] = Field(default_factory=dict)
    audio_file: str = ""                   # archived raw audio, if any


class RadioLogEntry(BaseModel):
    id: int = 0
    timestamp: str = ""
    transcript: str = ""
    patient_refs: list[int] = Field(default_factory=list)
    structured: dict[str, Any] = Field(default_factory=dict)
