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
    hub.main.sessions.close()


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


def test_delete_patient(client):
    client.post("/api/patients/37/claim")
    assert client.delete("/api/patients/37").json() == {"deleted": 37}
    assert client.get("/api/patients/37").status_code == 404
    assert client.delete("/api/patients/37").status_code == 404


def test_seen_ping_appears_in_listing(client):
    client.post("/api/patients/4/claim")
    client.post("/api/patients/4/seen?author=RTW-1")
    patients = client.get("/api/patients").json()
    assert patients[0]["last_seen"]["by"] == "RTW-1"


def test_session_reset_and_switch_back(client):
    # Work in the initial session.
    first = client.get("/api/health").json()["session"]
    client.post("/api/patients/1/claim")
    client.patch("/api/patients/1", json={"category": "SK1"})
    assert len(client.get("/api/patients").json()) == 1

    # "Reset": new session — board is empty, nothing was deleted.
    created = client.post("/api/sessions?name=uebung-2").json()
    assert created["name"] == "uebung-2"
    assert client.get("/api/health").json()["session"] == "uebung-2"
    assert client.get("/api/patients").json() == []
    client.post("/api/patients/9/claim")

    # Both sessions listed, new one active.
    sessions = client.get("/api/sessions").json()
    assert {s["name"] for s in sessions} == {first, "uebung-2"}
    assert next(s for s in sessions if s["active"])["name"] == "uebung-2"

    # Switch back: old data intact, category preserved.
    client.post(f"/api/sessions/{first}/activate")
    patients = client.get("/api/patients").json()
    assert [p["marker_id"] for p in patients] == [1]
    assert patients[0]["category"] == "SK1"

    # And forward again.
    client.post("/api/sessions/uebung-2/activate")
    assert [p["marker_id"] for p in client.get("/api/patients").json()] == [9]


def test_session_change_is_broadcast(client):
    with client.websocket_connect("/ws") as ws:
        client.post("/api/sessions?name=manv-neu")
        event = ws.receive_json()
        assert event["type"] == "session.changed"
        assert event["payload"]["name"] == "manv-neu"
        assert any(s["name"] == "manv-neu" for s in event["payload"]["sessions"])


def test_activate_unknown_session_404(client):
    assert client.post("/api/sessions/gibts-nicht/activate").status_code == 404
