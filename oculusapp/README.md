# J.A.R. AR-Client — Sichtung im Blickfeld

The **paramedic ("Trupp") client** for J.A.R. Medical / **TriARge**, built to run on a
**Meta Quest 2** through the browser (WebXR). It is the field counterpart to the
Einsatzleitung dashboard in `../Website/demo`: the same living patient record, but
worn on the head.

Workflow:

```
Marker erkennen ──▶ Patientendaten als HUD im Passthrough ──▶ Befunde per Sprache dokumentieren
```

- **See-through (Passthrough)** — an `immersive-ar` WebXR session shows the real
  world through the Quest's cameras with the patient HUD floating on top.
- **Patient identifizieren** — printed QR markers (`JAR-P<n>`) name the patient.
  In *Kamera-Modus* the app scans them live; in *AR-Modus* on the Quest 2 you pick
  the patient by voice or controller (see the camera note below).
- **Sprechen mit der Brille** — the glasses read the patient aloud (SpeechSynthesis)
  and take spoken commands: re-triage, log treatments/findings, dictate notes.

Everything is a **static web app** (no build step, no backend) — the scenario data
(the A9 coach MANV, patients #1–#12) is bundled, mirroring the dashboard demo 1:1.

---

## Run it on the Quest 2

WebXR requires **HTTPS** (or `localhost`). Two easy paths:

**A) GitHub Pages / any static host** (recommended — same as `../Website`)
1. Copy this `Oculus App/` folder to a host that serves over HTTPS.
2. On the Quest 2 open the **Meta Quest Browser** and navigate to the URL.
3. Tap **AR-Modus** → allow the immersive session → passthrough starts.

**B) Local test over your network**
```sh
cd "Oculus App"
../.venv/bin/python -m http.server 8765          # serves at http://<mac-ip>:8765
```
`localhost` is a secure context, but the Quest is a different device, so for AR on
the headset you still need HTTPS (use a tunnel like `cloudflared`/`ngrok`, or host
it). `http://<ip>:8765` is fine for **Kamera-Modus** / **Simulation** on a phone or
laptop.

Then print the markers: open `assets/markers/markers.html` and print, or use the
individual `assets/markers/JAR-P<n>.svg` files.

---

## The three modes

| Mode | What it does | Where it's meant to run |
|------|--------------|--------------------------|
| **AR-Modus** | Quest passthrough + HUD overlay. Patient chosen by **voice** ("Patient sieben") or **controller**/**picker**. | Meta Quest 2/3 browser |
| **Kamera-Modus** | **Live QR scanning** via the device camera → loads the patient automatically. | Phone / laptop (real camera) |
| **Simulation** | No camera/headset — tap a marker in the picker to preview the HUD. | Anywhere |

The landing screen auto-detects device capabilities and enables/disables modes
accordingly (AR-Modus is greyed out where WebXR `immersive-ar` isn't available).

**Deep link:** `index.html?mode=sim&patient=8` jumps straight into a mode (and
optional patient) — handy for demos and kiosks.

---

## ⚠️ Important: the Quest 2 camera limitation

Live QR scanning **from the headset's passthrough cameras is not possible on the
Quest 2** — Meta does not expose the passthrough cameras to *any* app, native or
web. Camera access for computer vision (the *Passthrough Camera API*) exists only
on **Quest 3 / 3S**. This is a hard platform constraint, not something this app can
work around.

So the app handles identification honestly per device:

- **Quest 2 (AR-Modus):** the printed `JAR-P<n>` marker tells the medic the patient
  number; they load it hands-free by **voice** ("Patient acht") or with the
  **controller** via the on-HUD picker. Passthrough + HUD + voice all work fully.
- **Phone / laptop (Kamera-Modus):** the camera *is* available, so QR codes are
  scanned for real and the patient loads automatically. This is the mode where the
  scanner genuinely fires — verified end-to-end (jsQR decodes the generated markers).
- **Quest 3 / 3S:** the same Kamera-Modus scanning can be extended to the passthrough
  cameras once the Passthrough Camera API is wired in — see *Next steps*.

---

## Voice — "talk to the glasses"

Tap **Mikro** (or say nothing and use the text box). Commands are German,
substring-tolerant. Spoken and typed commands go through the **same parser**.

| Say… | Effect |
|------|--------|
| „Zusammenfassung" / „Status" / „Patient" | reads the patient aloud |
| „Vitalwerte" | reads the vitals aloud |
| „rot" / „gelb" / „grün" / „blau" / „schwarz" | re-triage (SK1–SK4 / verstorben) |
| „Maßnahme Tourniquet" | logs a treatment |
| „Befund offene Fraktur" | logs an injury/finding |
| „Notiz Patient wird transportiert" | adds a protocol note |
| „nächster" / „scannen" | back to scanning |
| „schließen" / „beenden" | exit |
| „Hilfe" | lists the commands aloud |

**SpeechSynthesis** (the glasses talking) is broadly supported, including the Quest
Browser. **SpeechRecognition** (understanding you) is *not* guaranteed on the Quest —
where it's missing, the app shows a **text command box** that does exactly the same
thing, and TTS still works. A bare number in that box (e.g. `8`) loads that patient.

---

## Files

```
Oculus App/
├─ index.html            landing + running "stage" (HUD overlay root for WebXR)
├─ css/hud.css           HUD + panel styling (triage palette shared with the dashboard)
├─ js/
│  ├─ data.js            patient roster (mirrors the dashboard) + live store/edits/protocol
│  ├─ qr.js              QR scanning: BarcodeDetector → jsQR fallback; parses JAR-P<n>
│  ├─ voice.js           SpeechSynthesis talk-back + SpeechRecognition command parser
│  ├─ xr.js              WebXR immersive-ar passthrough via dom-overlay (transparent GL layer)
│  ├─ hud.js             HUD DOM rendering + spoken-summary text
│  └─ app.js             orchestration: modes, state machine, wiring, deep links
├─ vendor/jsQR.min.js    QR decode fallback (used when BarcodeDetector is absent)
├─ make_markers.py       regenerates the printable markers (segno)
└─ assets/markers/       JAR-P1..JAR-P12.svg + markers.html (print sheet)
```

### Regenerating the markers
```sh
cd "Oculus App"
../.venv/bin/python make_markers.py
```
Uses `segno` (pure-Python; installed into the repo venv). The payload is
`JAR-P<id>`; `qr.js` parses `JAR-P7`, `JAR:7`, `.../patient/7` and bare `7`.
Standard (non-Micro) QR with a 4-module quiet zone — decodable by phone scanners
and the app's own jsQR path (verified in a real browser).

---

## How it maps to the real product

In production the records stream from the FastAPI hub over REST + WebSocket, and a
scan on the glasses updates the shared Lagebild that the Einsatzleitung sees. Here,
with no backend on a static host, `js/data.js` stands in for that hub using the same
record shape, so a marker scanned on the glasses shows exactly the patient the
dashboard demo shows. The edit/protocol functions (`setCategory`, `addTreatment`,
`addInjury`, `pushProtocol`) are the seams where the real `PATCH /api/patients/{id}`
+ WebSocket sync would attach.

## Next steps (to make it a field-grade native app)
- **Quest 3 passthrough-camera QR:** wire the Passthrough Camera API to feed frames
  into the same `qr.js` decode path for true in-headset scanning.
- **Backend sync:** replace the bundled roster with the hub's REST/WebSocket stream
  (the edit functions already isolate every write).
- **World-locked HUD:** anchor the panel in 3D near the patient (WebXR anchors /
  a Three.js layer) instead of the current head-locked dom-overlay.
- **Offline edge-STT:** swap the browser SpeechRecognition for the on-device model
  the product uses, for offline dictation.
