# TriARge — AR-gestützte MANV-Sichtung

TriARge replaces paper triage tags at mass casualty incidents (MANV/MCI)
with **ArUco markers on patients + AR overlays for paramedics + a local
AI-driven incident command hub**. The entire system runs offline on the
incident LAN; an optional hybrid Supabase sync replicates state to the
cloud whenever internet happens to be available.

```
                        Einsatzstelle (offline LAN / field WiFi)
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│   Paramedic Client (AR glasses / macOS simulation)                      │
│   ┌──────────────────────────────────────────────┐                      │
│   │ Camera ─► ArUco detect ─► Anchor tracking    │   REST + WebSocket   │
│   │ (occlusion-robust: LK optical flow coasting) │◄────────────────────┐│
│   │ Mic ─► push-to-talk dictation (WAV)          │                     ││
│   │ CLI logger = simulated AR display            │                     ││
│   └──────────────────────────────────────────────┘                     ││
│                                                                        ▼│
│   Incident Command Hub (Einsatzleitung)                     ┌───────────┴──┐
│   ┌──────────────────────────────────────────────────────┐ │  Web Dashboard│
│   │ FastAPI + WebSocket event bus                        │ │  (live board, │
│   │ Local AI: faster-whisper STT + Ollama/rule structurer│ │  radio log,   │
│   │ Radio monitor: mic/AUX ─► VAD ─► STT ─► analysis     │ │  protocol)    │
│   │ SQLite (source of truth) + sync outbox               │ └───────────────┘
│   └───────────────────────────┬──────────────────────────┘               │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │ optional, best-effort
                                ▼
                     Supabase (hybrid cloud replica)
```

## Components

| Path | What it is |
|---|---|
| `hub/` | Incident command server: REST/WS API, dashboard, local AI pipeline, radio monitor, SQLite + Supabase outbox sync |
| `client/` | Paramedic client: ArUco detection, occlusion-robust patient anchoring, voice protocoling, CLI "AR display" |
| `tools/generate_markers.py` | Printable ArUco patient markers (A4 sheets, 300 DPI) |
| `supabase/schema.sql` | Cloud replica schema for the optional hybrid sync |
| `tests/` | Structurer, database, and API tests |

## Quick start

**One-click demo:** double-click `Start-TriARge.command` (or run it in a
terminal). It creates missing venvs, starts the hub in its own Terminal
window, opens the dashboard, and launches two Einsatztrupp clients
(`Trupp-1`, `Trupp-2`) in separate Terminal windows. Both squads appear
in the dashboard's *Einsatztrupps* panel with live online status.

Manual setup below. Python 3.11/3.12 recommended (prebuilt wheels for
`ctranslate2`/OpenCV); create venvs via `uv venv` if your Python is
uv-managed.

### 1. Hub (command computer)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements/hub.txt
pip install -r requirements/hub-ai.txt   # local STT (optional but recommended)
python -m hub.main                        # → http://localhost:8087
```

Open `http://<hub-ip>:8087` for the Einsatzleitung dashboard. Everything
degrades gracefully: without `hub-ai.txt` the hub runs but voice/radio
transcription returns 503; without Ollama the structurer falls back to the
built-in rule-based German medical extractor automatically.

**Offline preparation (do this once while online):** run one dictation (or
`python -c "from faster_whisper import WhisperModel; WhisperModel('small')"`)
so the whisper weights are cached locally, and `ollama pull llama3.1:8b`
if you want LLM structuring.

### 2. Markers

```bash
./.venv-client/bin/python tools/generate_markers.py --count 24 --size-mm 50
```

Print `markers_out/sheet_*.png` at 300 DPI, laminate, deploy on patients.

### 3. Paramedic client (AR simulation on a Mac)

```bash
uv venv --python 3.12 .venv-client
uv pip install --python .venv-client -r requirements/client.txt
./.venv-client/bin/python -m client.main --hub http://<hub-ip>:8087 --medic-id RTW-1
```

(Note: uv-managed Python builds cannot create venvs via plain
`python3.12 -m venv` — always go through `uv venv`.)

The webcam plays the role of the glasses camera. Point it at a printed
marker: the client claims/fetches the patient from the hub and prints the
"overlay". Cover the marker with your hand — the anchor **coasts on
optical flow** and the overlay stays attached; after `--coast-timeout`
seconds without re-verification it fails closed and drops the overlay.

Client commands: `d` (push-to-talk dictation for the focused patient),
`f <id>` (manual focus), `ls`, `show <id>`, `cat <id> SK1`, `q`.

### 4. Voice protocoling flow

1. Medic looks at patient (marker focused), types `d`, speaks:
   *„Patient männlich, circa 40, Sichtungskategorie rot,
   Spannungspneumothorax, Atemfrequenz 32, nicht gehfähig,
   Entlastungspunktion durchgeführt."*
2. Types `d` again → WAV goes to the hub.
3. Hub: whisper STT → structurer (Ollama or rules) → SQLite update +
   protocol entry (raw transcript + archived audio preserved).
4. The update is broadcast over WebSocket: the dashboard board flashes,
   and **every other client currently anchored to that patient re-renders
   its overlay instantly**.

### 5. Radio (Sprechfunk) analysis

Connect the radio's speaker output to the command computer via AUX (or
just use the built-in mic) and click **„Funk"** in the dashboard header.
Transmissions are segmented by an energy gate, transcribed locally, and
mined for patient references — *„Patient 12 jetzt Sichtungskategorie
rot"* updates patient 12 with `source=radio`, fully auditable in the
protocol. Select a specific input with `TRIARGE_RADIO_DEVICE`.

### 6. Optional Supabase hybrid sync

Fully optional — without it the system is 100 % local. Apply
`supabase/schema.sql`, then:

```bash
export TRIARGE_SUPABASE_URL=https://<project>.supabase.co
export TRIARGE_SUPABASE_KEY=<service-role-key>
export TRIARGE_INCIDENT_ID=manv-2026-07-03
```

Every mutation is journaled into a local outbox and pushed opportunistically
(idempotent upserts). Connectivity loss never touches the request path;
the dashboard shows sync state (`lokal` / `cloud sync ✓` / `offline, N
ausstehend`).

## Design decisions

- **Marker = identity, fail closed.** Only a positively decoded ArUco
  marker establishes *who* the patient is. Optical-flow coasting keeps the
  overlay anchored through occlusion, but if the track degenerates or the
  marker isn't re-verified within the coast timeout, the overlay is
  dropped rather than risk showing SK-I data over the wrong patient.
- **AI lives on the hub, not the glasses.** Clients ship raw audio and
  render results — wearable-friendly, and models upgrade in one place.
- **Everything is auditable.** Raw transcripts and audio files are kept
  alongside every structured update (`source` = dictation / radio /
  dashboard / client), which is essential in a medico-legal context.
- **Offline-first, not offline-only.** SQLite is the source of truth;
  cloud sync is an opportunistic replica via an outbox — the classic
  pattern for unreliable links.

## Tests

```bash
pip install -r requirements/dev.txt
python -m pytest tests/ -v
```

## Repository layout

```
hub/
  main.py            FastAPI app (REST, WS, dashboard hosting)
  config.py          env-based configuration
  models.py          Patient / PatientUpdate / protocol models (SK I–IV)
  database.py        SQLite + sync outbox
  events.py          WebSocket event bus
  ai/stt.py          faster-whisper wrapper (lazy, degradable)
  ai/structurer.py   Ollama structurer + rule-based fallback
  ai/radio.py        Sprechfunk monitor (VAD → STT → analysis)
  sync/supabase_sync.py
  static/            Einsatzleitung dashboard (vanilla JS)
client/
  main.py            orchestrator + REPL (simulated glasses UX)
  vision/aruco_detector.py
  vision/anchor.py   occlusion-robust anchoring state machine
  audio/dictation.py push-to-talk recorder
  net/hub_client.py  REST/WS + offline spool
  overlay/cli_renderer.py
```

⚠️ **Prototype for exercises/simulation.** Not a certified medical device;
not for use in real emergency operations without regulatory clearance.
