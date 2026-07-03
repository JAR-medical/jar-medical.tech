"""Rule-based medical structurer — the offline-guaranteed extraction path."""

from hub.ai.structurer import RuleBasedStructurer, extract_patient_refs
from hub.models import TriageCategory


def structure(text: str):
    return RuleBasedStructurer().structure(text)


def test_full_german_dictation():
    update = structure(
        "Patient männlich, circa 40 Jahre, Sichtungskategorie rot, "
        "Spannungspneumothorax rechts, Atemfrequenz 32, Puls 128, "
        "Sättigung 84, nicht gehfähig, ansprechbar, "
        "Entlastungspunktion durchgeführt, Sauerstoffgabe läuft."
    )
    assert update.category == TriageCategory.SK1
    assert update.sex == "m"
    assert update.age_estimate == 40
    assert update.vitals.breathing_rate == 32
    assert update.vitals.pulse == 128
    assert update.vitals.spo2 == 84
    assert update.ambulatory is False
    assert update.conscious is True
    assert "Spannungspneumothorax" in update.injuries
    assert "Thoraxdrainage" in update.treatments
    assert "Sauerstoffgabe" in update.treatments


def test_category_variants():
    assert structure("SK 2, stabile Fraktur").category == TriageCategory.SK2
    assert structure("Kategorie grün, gehfähig").category == TriageCategory.SK3
    assert structure("Sichtungskategorie IV").category == TriageCategory.SK4
    assert structure("Patient ist verstorben").category == TriageCategory.DECEASED
    assert structure("Puls 80, unauffällig").category is None


def test_blood_pressure_and_gcs():
    update = structure("RR 90 zu 60, GCS 9, bewusstlos")
    assert update.vitals.bp_systolic == 90
    assert update.vitals.bp_diastolic == 60
    assert update.vitals.gcs == 9
    assert update.conscious is False


def test_patient_refs_for_radio():
    refs = extract_patient_refs(
        "Florian an Einsatzleitung: Patient 12 jetzt rot, Patientin Nummer 7 "
        "wird transportiert, Marker 12 bleibt vor Ort."
    )
    assert refs == [12, 7]


def test_empty_transcript_extracts_nothing_but_keeps_note():
    update = structure("Wetter ist schön heute.")
    assert update.category is None
    assert update.injuries == []
    assert update.note == "Wetter ist schön heute."


def test_transcript_is_preserved_as_note():
    text = "SK1, starke Blutung am Bein, Tourniquet angelegt"
    update = structure(text)
    assert update.note == text
    assert "Starke Blutung" in update.injuries
    assert "Tourniquet" in update.treatments
