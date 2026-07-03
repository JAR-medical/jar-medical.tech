"""SQLite layer: create-on-sight, partial updates, merging, outbox."""

import pytest

from hub.database import Database
from hub.models import PatientUpdate, TriageCategory, Vitals


@pytest.fixture
def db(tmp_path):
    database = Database(tmp_path / "test.db")
    yield database
    database.close()


def test_ensure_patient_is_idempotent(db):
    p1, created1 = db.ensure_patient(5)
    p2, created2 = db.ensure_patient(5)
    assert created1 is True and created2 is False
    assert p1.marker_id == p2.marker_id == 5
    assert p1.category == TriageCategory.UNSIGHTED


def test_apply_update_merges_lists_and_overwrites_scalars(db):
    db.ensure_patient(1)
    db.apply_update(
        1,
        PatientUpdate(
            category=TriageCategory.SK2,
            injuries=["Fraktur"],
            vitals=Vitals(pulse=110),
        ),
        source="dictation", author="RTW-1",
    )
    patient = db.apply_update(
        1,
        PatientUpdate(
            category=TriageCategory.SK1,           # deterioration
            injuries=["Fraktur", "Starke Blutung"],  # dedup + extend
            treatments=["Tourniquet"],
            vitals=Vitals(pulse=135, spo2=90),
        ),
        source="dictation", author="RTW-2",
    )
    assert patient.category == TriageCategory.SK1
    assert patient.injuries == ["Fraktur", "Starke Blutung"]
    assert patient.treatments == ["Tourniquet"]
    assert patient.vitals.pulse == 135
    assert patient.vitals.spo2 == 90
    assert patient.version == 2


def test_apply_update_creates_missing_patient(db):
    patient = db.apply_update(
        99, PatientUpdate(category=TriageCategory.SK3), source="radio"
    )
    assert patient.marker_id == 99
    assert db.get_patient(99) is not None


def test_protocol_trail(db):
    db.apply_update(
        2, PatientUpdate(note="erster Kontakt"), source="dictation",
        author="RTW-1", transcript="erster Kontakt",
    )
    db.apply_update(
        2, PatientUpdate(category=TriageCategory.SK2), source="radio",
        transcript="Patient 2 gelb",
    )
    protocol = db.list_protocol(2)
    assert len(protocol) == 2
    assert protocol[0].source == "radio"       # newest first
    assert protocol[1].author == "RTW-1"


def test_sync_outbox_lifecycle(db):
    db.ensure_patient(3)
    db.apply_update(3, PatientUpdate(category=TriageCategory.SK1), source="dashboard")
    assert db.outbox_size() >= 2  # patient rows + protocol entry
    batch = db.peek_outbox()
    db.ack_outbox([row_id for row_id, _, _ in batch])
    assert db.outbox_size() == 0


def test_radio_log_roundtrip(db):
    db.add_radio_entry("Patient 4 jetzt rot", [4], {"category": "SK1"})
    entries = db.list_radio_log()
    assert entries[0].patient_refs == [4]
    assert entries[0].structured["category"] == "SK1"
