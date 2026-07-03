"""Turn free-form medical speech into a structured ``PatientUpdate``.

Two engines, tried in order:

1. ``OllamaStructurer`` — a local LLM (via Ollama) constrained to a JSON
   schema. Best quality for messy real-world dictation.
2. ``RuleBasedStructurer`` — a deterministic German/English pattern
   extractor with zero dependencies. Always available, fully offline,
   and used to validate/fall back whenever the LLM path is missing,
   slow, or returns garbage.

Both only ever emit fields they actually found; the raw transcript is
preserved verbatim in the protocol either way, so no information is lost
even when extraction misses something.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any, Optional

import httpx

from ..models import PatientUpdate, TriageCategory, Vitals

log = logging.getLogger("triarge.structurer")


# --------------------------------------------------------------------------
# Rule-based extractor
# --------------------------------------------------------------------------

_CATEGORY_PATTERNS: list[tuple[TriageCategory, re.Pattern[str]]] = [
    (TriageCategory.DECEASED,
     re.compile(r"\b(verstorben|exitus|todesfeststellung|schwarz|deceased|black tag)\b", re.I)),
    (TriageCategory.SK4,
     re.compile(r"\b(sk\s*(?:4|iv)|kategorie\s*(?:4|iv)|sichtungskategorie\s*(?:4|iv)|blau)\b", re.I)),
    (TriageCategory.SK1,
     re.compile(r"\b(sk\s*(?:1|i)|kategorie\s*(?:1|i)|sichtungskategorie\s*(?:1|i)|rot|red tag|immediate)\b", re.I)),
    (TriageCategory.SK2,
     re.compile(r"\b(sk\s*(?:2|ii)|kategorie\s*(?:2|ii)|sichtungskategorie\s*(?:2|ii)|gelb|yellow|delayed)\b", re.I)),
    (TriageCategory.SK3,
     re.compile(r"\b(sk\s*(?:3|iii)|kategorie\s*(?:3|iii)|sichtungskategorie\s*(?:3|iii)|gr(?:ü|ue?)n|green|minor)\b", re.I)),
]

_VITAL_PATTERNS: dict[str, re.Pattern[str]] = {
    "breathing_rate": re.compile(
        r"\b(?:atemfrequenz|af|atmung|respiratory rate|rr breaths)\D{0,12}?(\d{1,2})\b", re.I),
    "pulse": re.compile(
        r"\b(?:puls|herzfrequenz|hf|pulse|heart rate)\D{0,12}?(\d{2,3})\b", re.I),
    "spo2": re.compile(
        r"\b(?:spo2|s[aä]ttigung|sauerstoffs[aä]ttigung|saturation)\D{0,12}?(\d{2,3})\b", re.I),
    "gcs": re.compile(r"\b(?:gcs|glasgow)\D{0,12}?(\d{1,2})\b", re.I),
}

_BP_PATTERN = re.compile(
    r"\b(?:rr|blutdruck|blood pressure)\D{0,12}?(\d{2,3})\s*(?:zu|auf|/|to)\s*(\d{2,3})\b",
    re.I,
)
_BP_SYS_ONLY = re.compile(
    r"\b(?:rr|blutdruck|blood pressure)\s*(?:systolisch)?\D{0,8}?(\d{2,3})\b", re.I)

_AGE_PATTERN = re.compile(
    r"\b(?:ca\.?|circa|etwa|ungef[aä]hr|about|approx\.?)?\s*(\d{1,3})\s*"
    r"(?:jahre|jahre alt|j[aä]hrig\w*|years? old|yo)\b", re.I)

_PATIENT_REF = re.compile(
    r"\b(?:patient(?:in)?|marker|pat\.?)\s*(?:nummer|nr\.?|#)?\s*(\d{1,3})\b", re.I)

# (canonical label, pattern) — canonical labels keep the dashboard tidy even
# when five medics phrase the same injury five different ways.
_INJURY_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Spannungspneumothorax", re.compile(r"spannungspneu", re.I)),
    ("Pneumothorax", re.compile(r"(?<!spannungs)pneumothorax", re.I)),
    ("SHT", re.compile(r"\b(sht|sch[aä]del-?hirn-?trauma|head injury)\b", re.I)),
    ("Thoraxtrauma", re.compile(r"\bthoraxtrauma\b", re.I)),
    ("Abdominaltrauma", re.compile(r"\b(abdominaltrauma|bauchtrauma)\b", re.I)),
    ("Polytrauma", re.compile(r"\bpolytrauma\b", re.I)),
    ("Fraktur", re.compile(r"\b(fraktur|bruch|fracture)\b", re.I)),
    ("Amputation", re.compile(r"\bamputat", re.I)),
    ("Starke Blutung", re.compile(r"\b(starke?|massive?|spritzende?)\s+blutung|hemorrhage", re.I)),
    ("Verbrennung", re.compile(r"\bverbrenn|burn\b", re.I)),
    ("Inhalationstrauma", re.compile(r"\binhalationstrauma\b", re.I)),
    ("Wirbelsäulentrauma", re.compile(r"\bwirbels[aä]ule|spinal\b", re.I)),
    ("Bewusstlosigkeit", re.compile(r"\bbewusstlos|unconscious\b", re.I)),
]

_TREATMENT_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("Tourniquet", re.compile(r"\btourniquet\b", re.I)),
    ("Druckverband", re.compile(r"\bdruckverband\b", re.I)),
    ("Thoraxdrainage", re.compile(r"\bthoraxdrainage|entlastungspunktion\b", re.I)),
    ("i.v. Zugang", re.compile(r"\b(i\.?\s?v\.?\s?zugang|venenzugang|zugang gelegt|iv access)\b", re.I)),
    ("i.o. Zugang", re.compile(r"\bi\.?\s?o\.?\s?zugang|intraoss[aä]r\b", re.I)),
    ("Sauerstoffgabe", re.compile(r"\b(sauerstoff(?:gabe)?|o2)\b", re.I)),
    ("Guedel-Tubus", re.compile(r"\bguedel\b", re.I)),
    ("Intubation", re.compile(r"\bintubiert|intubation\b", re.I)),
    ("Stabile Seitenlage", re.compile(r"\bseitenlage\b", re.I)),
    ("Beckenschlinge", re.compile(r"\bbeckenschlinge\b", re.I)),
    ("HWS-Immobilisation", re.compile(r"\b(stifneck|hws[- ]?immobilisation|zervikalst[üu]tze)\b", re.I)),
    ("Analgesie", re.compile(r"\banalgesie|schmerzmittel|fentanyl|ketamin|esketamin\b", re.I)),
    ("Reanimation", re.compile(r"\breanimation|cpr\b", re.I)),
]

_AMBULATORY_YES = re.compile(r"\b(gehf[aä]hig|kann (?:gehen|laufen)|walking|ambulatory)\b", re.I)
_AMBULATORY_NO = re.compile(
    r"\b(nicht gehf[aä]hig|gehunf[aä]hig|kann nicht (?:gehen|laufen)|non-?ambulatory)\b", re.I)
_CONSCIOUS_NO = re.compile(r"\b(bewusstlos|nicht ansprechbar|unconscious|unresponsive)\b", re.I)
_CONSCIOUS_YES = re.compile(r"\b(ansprechbar|wach|bei bewusstsein|conscious|alert)\b", re.I)
_AIRWAY_NO = re.compile(r"\batemweg\w*\s+(?:verlegt|nicht frei)|airway (?:obstructed|blocked)\b", re.I)
_AIRWAY_YES = re.compile(r"\batemweg\w*\s+frei|airway (?:clear|patent)\b", re.I)

_SEX_M = re.compile(r"\b(m[aä]nnlich|male)\b", re.I)
_SEX_W = re.compile(r"\b(weiblich|female)\b", re.I)


def extract_patient_refs(text: str) -> list[int]:
    """Marker/patient numbers mentioned in a transcript (e.g. radio traffic)."""
    refs: list[int] = []
    for m in _PATIENT_REF.finditer(text):
        n = int(m.group(1))
        if n not in refs:
            refs.append(n)
    return refs


class RuleBasedStructurer:
    """Deterministic extraction. Precision over recall: it only sets fields
    it is confident about; everything else stays in the transcript note."""

    def structure(self, transcript: str) -> PatientUpdate:
        text = transcript.strip()
        update = PatientUpdate()

        for category, pattern in _CATEGORY_PATTERNS:
            if pattern.search(text):
                update.category = category
                break

        vitals_found: dict[str, Any] = {}
        for field, pattern in _VITAL_PATTERNS.items():
            m = pattern.search(text)
            if m:
                vitals_found[field] = int(m.group(1))
        bp = _BP_PATTERN.search(text)
        if bp:
            vitals_found["bp_systolic"] = int(bp.group(1))
            vitals_found["bp_diastolic"] = int(bp.group(2))
        else:
            bp_sys = _BP_SYS_ONLY.search(text)
            if bp_sys:
                vitals_found["bp_systolic"] = int(bp_sys.group(1))
        if vitals_found:
            update.vitals = Vitals(**vitals_found)

        if _AMBULATORY_NO.search(text):
            update.ambulatory = False
        elif _AMBULATORY_YES.search(text):
            update.ambulatory = True

        if _CONSCIOUS_NO.search(text):
            update.conscious = False
        elif _CONSCIOUS_YES.search(text):
            update.conscious = True

        if _AIRWAY_NO.search(text):
            update.airway_clear = False
        elif _AIRWAY_YES.search(text):
            update.airway_clear = True

        if _SEX_M.search(text):
            update.sex = "m"
        elif _SEX_W.search(text):
            update.sex = "w"

        age = _AGE_PATTERN.search(text)
        if age:
            value = int(age.group(1))
            if 0 < value <= 120:
                update.age_estimate = value

        update.injuries = [
            label for label, pattern in _INJURY_PATTERNS if pattern.search(text)
        ]
        update.treatments = [
            label for label, pattern in _TREATMENT_PATTERNS if pattern.search(text)
        ]
        update.note = text or None
        return update


# --------------------------------------------------------------------------
# Ollama (local LLM) extractor
# --------------------------------------------------------------------------

_LLM_SYSTEM_PROMPT = """\
Du bist ein Assistenzsystem für die Sichtung bei einem Massenanfall von
Verletzten (MANV). Du bekommst das rohe Diktat eines Rettungsdienstlers und
extrahierst daraus NUR explizit genannte medizinische Fakten als JSON.

Antworte ausschließlich mit einem JSON-Objekt mit diesen optionalen Feldern:
  category: "SK1" | "SK2" | "SK3" | "SK4" | "DECEASED"
      (rot=SK1, gelb=SK2, gruen=SK3, blau=SK4, schwarz/verstorben=DECEASED)
  sex: "m" | "w" | "d"
  age_estimate: integer
  ambulatory: boolean (gehfähig)
  conscious: boolean (ansprechbar)
  airway_clear: boolean
  location: string (Fundort/Ablageort, falls genannt)
  vitals: { breathing_rate, pulse, spo2, bp_systolic, bp_diastolic, gcs }
  injuries: [string]   (kurze deutsche Fachbegriffe)
  treatments: [string] (durchgeführte Maßnahmen)

Regeln: Lasse Felder weg, die nicht genannt wurden. Erfinde nichts.
Keine Erklärungen, kein Markdown — nur das JSON-Objekt.
"""

_ALLOWED_KEYS = {
    "category", "sex", "age_estimate", "ambulatory", "conscious",
    "airway_clear", "location", "vitals", "injuries", "treatments",
}


class OllamaStructurer:
    def __init__(self, url: str, model: str, timeout_s: float) -> None:
        self._url = url.rstrip("/")
        self._model = model
        self._timeout = timeout_s

    def is_available(self) -> bool:
        try:
            resp = httpx.get(f"{self._url}/api/tags", timeout=2.0)
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    def structure(self, transcript: str) -> Optional[PatientUpdate]:
        """Returns None on any failure so the caller can fall back."""
        try:
            resp = httpx.post(
                f"{self._url}/api/chat",
                json={
                    "model": self._model,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.0},
                    "messages": [
                        {"role": "system", "content": _LLM_SYSTEM_PROMPT},
                        {"role": "user", "content": transcript},
                    ],
                },
                timeout=self._timeout,
            )
            resp.raise_for_status()
            raw = resp.json()["message"]["content"]
            data = json.loads(raw)
        except Exception as exc:
            log.warning("ollama structuring failed, falling back: %s", exc)
            return None
        if not isinstance(data, dict):
            return None
        cleaned = {k: v for k, v in data.items() if k in _ALLOWED_KEYS}
        try:
            update = PatientUpdate(**cleaned)
        except Exception as exc:
            log.warning("LLM returned invalid schema, falling back: %s", exc)
            return None
        update.note = transcript.strip() or None
        return update


# --------------------------------------------------------------------------
# Facade
# --------------------------------------------------------------------------

class MedicalStructurer:
    """LLM first, rules as guaranteed fallback."""

    def __init__(self, ollama_url: str, ollama_model: str, timeout_s: float) -> None:
        self._llm = OllamaStructurer(ollama_url, ollama_model, timeout_s)
        self._rules = RuleBasedStructurer()
        self._llm_checked = False
        self._llm_available = False

    @property
    def engine_name(self) -> str:
        return "ollama" if self._llm_ok() else "rules"

    def _llm_ok(self) -> bool:
        if not self._llm_checked:
            self._llm_available = self._llm.is_available()
            self._llm_checked = True
            log.info(
                "structuring engine: %s",
                "ollama" if self._llm_available else "rule-based (no ollama)",
            )
        return self._llm_available

    def structure(self, transcript: str) -> PatientUpdate:
        if self._llm_ok():
            update = self._llm.structure(transcript)
            if update is not None:
                return update
            # Ollama died mid-incident — stop retrying it on the hot path.
            self._llm_available = False
        return self._rules.structure(transcript)
