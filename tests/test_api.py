"""End-to-end API tests against the FastAPI app (no audio hardware needed)."""

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("TRIARGE_DATA_DIR", str(tmp_path))
    # Re-import with the temp data dir so tests never touch real state.
    import hub.config
    importlib.reload(hub.config)
    import hub.main
    importlib.reload(hub.main)
    with TestClient(hub.main.app) as test_client:
        yield test_client
    hub.main.db.close()


def test_health(client):
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["patients"] == 0


def test_claim_and_update_flow(client):
    # Paramedic client sees marker 7 for the first time.
    created = client.post("/api/patients/7/claim").json()
    assert created["category"] == "UNSIGHTED"

    # Second claim is idempotent.
    assert client.post("/api/patients/7/claim").json()["version"] == created["version"]

    # Structured update (as the dashboard or a client would send).
    updated = client.patch(
        "/api/patients/7?source=client&author=RTW-1",
        json={"category": "SK1", "injuries": ["Polytrauma"],
              "vitals": {"pulse": 130}},
    ).json()
    assert updated["category"] == "SK1"
    assert updated["vitals"]["pulse"] == 130

    # Protocol recorded the change.
    protocol = client.get("/api/patients/7/protocol").json()
    assert protocol[0]["source"] == "client"
    assert protocol[0]["author"] == "RTW-1"

    # Board endpoint sees it.
    patients = client.get("/api/patients").json()
    assert len(patients) == 1


def test_empty_update_rejected(client):
    client.post("/api/patients/1/claim")
    resp = client.patch("/api/patients/1", json={})
    assert resp.status_code == 400


def test_unknown_patient_404(client):
    assert client.get("/api/patients/999").status_code == 404


def test_websocket_broadcasts_updates(client):
    with client.websocket_connect("/ws") as ws:
        client.post("/api/patients/3/claim")
        event = ws.receive_json()
        assert event["type"] == "patient.created"
        assert event["payload"]["marker_id"] == 3

        client.patch("/api/patients/3", json={"category": "SK2"})
        event = ws.receive_json()
        assert event["type"] == "patient.updated"
        assert event["payload"]["category"] == "SK2"


def test_dictation_without_stt_returns_503(client):
    resp = client.post(
        "/api/patients/1/dictation",
        content=b"\x00" * 4096,
        headers={"Content-Type": "audio/wav"},
    )
    # In the test environment faster-whisper is not installed; the endpoint
    # must fail gracefully with 503 (or 500 for the invalid WAV), never hang.
    assert resp.status_code in (500, 503)


def test_patient_window_served(client):
    resp = client.get("/patient/5")
    assert resp.status_code == 200
    assert "patient.js" in resp.text
