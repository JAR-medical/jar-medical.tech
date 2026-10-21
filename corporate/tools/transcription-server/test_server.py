"""HTTP-layer tests with a stand-in engine (no models, no GPU needed).

Run: python -m pytest test_server.py   or   python test_server.py
"""
import os

os.environ.setdefault("STT_PER_IP_PER_HOUR", "5")
os.environ.setdefault("STT_MAX_BYTES", "1000")

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402

SITE = "https://jar-medical.tech"


def fake_engine(path, language):
    with open(path, "rb") as f:
        assert f.read()
    return {"language": language, "segments": server.to_contract([
        {"start": 0.0, "end": 2.4, "speaker": "SPEAKER_00", "text": " Patient vierzehn, Tag gelesen. "},
        {"start": 2.6, "end": 3.1, "text": "Ja."},  # no speaker found
        {"start": 3.2, "end": 3.4, "speaker": "SPEAKER_01", "text": "   "},  # empty, dropped
    ])}


def client():
    server.engine = fake_engine
    server.recent.clear()
    return TestClient(server.app)


def post(c, data=b"webm-bytes", language="de", ip="1.2.3.4"):
    return c.post("/transcribe", files={"audio": ("aufnahme.webm", data, "audio/webm")},
                  data={"language": language}, headers={"Origin": SITE, "cf-connecting-ip": ip})


def test_contract():
    r = post(client())
    assert r.status_code == 200, r.text
    assert r.headers["access-control-allow-origin"] == SITE
    body = r.json()
    assert body["language"] == "de"
    assert body["segments"] == [
        {"start": 0.0, "end": 2.4, "speaker": "SPEAKER_00", "text": "Patient vierzehn, Tag gelesen."},
        {"start": 2.6, "end": 3.1, "speaker": "UNKNOWN", "text": "Ja."},
    ]


def test_rejects():
    c = client()
    assert post(c, language="fr").status_code == 400
    assert post(c, data=b"").status_code == 400
    assert post(c, data=b"x" * 2000).status_code == 413


def test_other_origin_gets_no_cors():
    r = client().post("/transcribe", files={"audio": ("a.webm", b"x", "audio/webm")},
                      data={"language": "en"}, headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in r.headers


def test_busy_and_rate_limit():
    c = client()
    server.busy.acquire()
    try:
        assert post(c).status_code == 503
    finally:
        server.busy.release()
    codes = [post(c, ip="9.9.9.9").status_code for _ in range(6)]
    assert codes == [200] * 5 + [429], codes  # STT_PER_IP_PER_HOUR = 5
    assert post(c, ip="8.8.8.8").status_code == 200


def test_health():
    r = client().get("/health")
    assert r.status_code == 200 and r.json()["ok"] is True


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok -", name)
