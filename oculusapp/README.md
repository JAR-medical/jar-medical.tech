# J.A.R. AR-Client — Sichtung im Blickfeld

The **paramedic ("Trupp") client** for J.A.R. Medical / **TriARge**. It runs in the
headset browser on **PICO 4 (Enterprise)** and **Meta Quest** through WebXR, and
flat on a phone or laptop. It is the field counterpart to the Einsatzleitung
dashboard in `../demo`: the same living patient record, but worn on the head.

The whole field workflow, end to end:

```
Lage ausrichten ─▶ Lagekarte ─▶ zum Patienten gehen ─▶ „Sichtung starten“
     ─▶ mSTaRT-Schema (6 Fragen) ─▶ Sichtungskategorie
     ─▶ Patientenumhängekarte scannen ─▶ nächster Patient
```

- **See-through (Passthrough)** — an `immersive-ar` WebXR session shows the real
  world through the headset cameras.
- **Es ist ein HUD, kein Fenster.** Randinformation sitzt an den Rändern des
  Blickfelds und ist kopffest: Zustand oben links, Zählung oben rechts,
  Lagekarte unten links, Hinweis unten rechts. Die Mitte bleibt frei.
- **Patientendaten hängen im Raum.** Über jedem Patienten in der Nähe steht sein
  Schild (Nummer, Feld, Kategorie) an seiner Position — es bleibt dort, wenn man
  den Kopf dreht. Die Handlungskarte mit Frage und Antwortknöpfen steht ebenfalls
  raumfest beim Patienten, den man gerade sichtet.
- **Bedienung ist Handtracking** — zeigen und pinchen, keine Controller.
- **Lagekarte** — das Ablage-Raster aus dem Datensatz (`C2`, `B3`, …) als Karte,
  mit der eigenen Position und Blickrichtung. Hohle Punkte stehen noch aus,
  gefüllte sind gesichtet.
- **mSTaRT** — sechs Ja/Nein-Fragen, jede vorgelesen, Schritt-zurück inklusive.
- **Patientenumhängekarte** — der QR-Code der Karte bucht die Kategorie auf genau
  diese Karte; eine fremde Nummer wird nicht still übernommen, sondern erfragt.

⚠️ **Übungszweck** — Schülerprojekt, kein Medizinprodukt. Die Sichtungskategorie
ist ein Vorschlag, die Verantwortung bleibt bei der Person mit der Brille.

Everything is a **static web app** (no build step, no backend) — the scenario data
(the A9 coach MANV, patients #1–#12) is bundled and mirrors the dashboard demo 1:1.

---

## Run it

WebXR requires **HTTPS** (or `localhost`).

**A) The deployed copy** — this folder is served from the project website; open it
in the **PICO Browser** and tap **AR-Modus**.

**B) Local**
```sh
python3 -m http.server 8765          # http://<mac-ip>:8765
```
`localhost` is a secure context; for AR on a headset over the network you still
need HTTPS (a tunnel like `cloudflared`, or the deployed copy).

Print the cards: open `assets/markers/markers.html` and print, or use the
individual `assets/markers/JAR-P<n>.svg` files.

---

## The three modes

| Mode | What it does | Where it runs |
|------|--------------|---------------|
| **AR-Modus** | Passthrough, Lagekarte und Ablauf auf einer WebGL-Ebene, bedient per Handtracking. | PICO / Quest browser |
| **Kamera-Modus** | Derselbe Ablauf flach, dazu **echtes QR-Scannen** der Umhängekarte über die Gerätekamera. | Handy / Laptop |
| **Simulation** | Derselbe Ablauf ohne Kamera und ohne Headset. | überall |

The landing screen probes the device and disables what it cannot do.

**Deep link:** `index.html?mode=sim&patient=8` jumps straight into a mode (and
optional patient) — handy for demos and kiosks.

---

## ⚠️ Kamera und Kartenschritt

Kein Headset-Browser bekommt Zugriff auf die Passthrough-Kameras — auf der
**Quest 2** gibt es ihn für gar keine App, auf **Quest 3** und **PICO 4
Enterprise** nur für native Apps, nicht für Webseiten. Der Kartenschritt läuft
deshalb je nach Gerät unterschiedlich, aber nie ins Leere:

- **AR-Modus:** die Karte wird **manuell bestätigt** — die Nummer steht gedruckt
  auf der Umhängekarte, der Trupp bestätigt sie mit einem Pinch.
- **Kamera-Modus (Handy/Laptop):** die Kamera ist da, der QR-Code wird wirklich
  gelesen und die Kategorie auf die gescannte Karte gebucht.
- **Nativ auf PICO 4 Enterprise:** dort geht es in der Brille — siehe
  `Unity/README-PICO.md`.

---

## Files

```
oculusapp/
├─ index.html            Landing + Bühne (Ablaufschirm, Lagekarte, Akte)
├─ css/hud.css           Styling (Triage-Palette wie im Lagebild)
├─ js/
│  ├─ data.js            Patientendatensatz (wie im Dashboard) + Schreibfunktionen
│  ├─ mstart.js          das mSTaRT-Schema als Entscheidungsbaum (reine Logik)
│  ├─ layout.js          Rasterzellen → Meter, Raumausrichtung, Lagekarten-Koordinaten
│  ├─ workflow.js        der Ablauf als Zustandsmaschine — kennt keine Darstellung
│  ├─ hudscreen.js       zeichnet die drei AR-Ebenen (Rand-HUD, Handlungskarte,
│  │                     Patientenschilder) und liefert die Trefferflächen
│  ├─ xr.js              WebXR-Sitzung: kopffestes HUD, raumfeste Karte und
│  │                     Schilder, Handstrahl und Pinch
│  ├─ hudcanvas.js       Patientenakte auf Canvas
│  ├─ hud.js             Patientenakte als DOM
│  ├─ qr.js              QR: BarcodeDetector → jsQR-Fallback; liest JAR-P<n>
│  ├─ voice.js           Sprachausgabe (und ein Kommando-Parser für den Quest-Build)
│  └─ app.js             Verdrahtung: Betriebsarten, DOM-Darstellung, Deep-Links
├─ tests/
│  ├─ logic.test.mjs     90 Prüfungen: mSTaRT, Raster, Ablauf
│  ├─ probe_flow.html    rendert alle AR-Schirme nacheinander
│  └─ probe_dom.html     klickt den flachen Ablauf durch
├─ Unity/                nativer PICO-/Quest-Build (siehe Unity/README-PICO.md)
├─ vendor/jsQR.min.js    QR-Decoder-Fallback
├─ make_markers.py       erzeugt die druckbaren Karten (segno)
└─ assets/markers/       JAR-P1..JAR-P12.svg + markers.html (Druckbogen)
```

### Prüfen

```sh
node tests/logic.test.mjs
```

Die Darstellung lässt sich headless ansehen: `tests/probe_flow.html` zeichnet
jeden AR-Schirm auf eine Canvas, `tests/probe_dom.html` klickt den flachen Ablauf
durch — beide über einen lokalen Server öffnen und mit `--screenshot` abgreifen.

### Karten neu erzeugen
```sh
python3 make_markers.py
```
Nutzt `segno`. Die Nutzlast ist `JAR-P<id>`; `qr.js` versteht `JAR-P7`, `JAR:7`,
`.../patient/7` und die nackte `7`.

---

## Das mSTaRT-Schema

`js/mstart.js` bildet den mSTaRT-Algorithmus für Erwachsene ab — das modifizierte
"Simple Triage and Rapid Treatment" von Feuerwehr München und LMU (Kanz et al.,
*Notfall + Rettungsmedizin*, 2006), auf das sich auch die Übungslagen in `../demo`
beziehen:

| # | Frage | ja | nein |
|---|---|---|---|
| 1 | Kritische Blutung? | Blutstillung → **SK I** | weiter |
| 2 | Gehfähig? | **SK III** | weiter |
| 3 | Atmung vorhanden? | weiter zu 4 | Atemwege freimachen → 3a |
| 3a | Atmung nach Freimachen? | **SK I** | **verstorben** |
| 4 | AF < 10 oder > 30/min? | **SK I** | weiter |
| 5 | Radialispuls tastbar? | weiter | **SK I** |
| 6 | Befolgt Aufforderungen? | **SK II** | **SK I** |

Zwei bewusste Entscheidungen, beide im Code kommentiert:

- **Die Blutung wird zuerst geprüft.** Publizierte Fassungen unterscheiden sich
  darin; zuerst heißt, dass ein gehfähiger Patient mit spritzender Blutung nicht
  grün herauskommen kann. Der Baum steht in einer Datenstruktur (`NODES`),
  Umstellen ist eine Änderung an einer Stelle.
- **SK IV (blau) vergibt der Algorithmus nie.** Das ist eine ärztliche Entscheidung
  (LNA) und keine Vorsichtung — es gibt sie nur als ausdrücklich beschrifteten
  Override, und sie wird als solcher protokolliert.

---

## How it maps to the real product

In production the records stream from the FastAPI hub over REST + WebSocket, and a
booked card on the glasses updates the shared Lagebild the Einsatzleitung sees.
Here, with no backend on a static host, `js/data.js` stands in for that hub using
the same record shape — including the `location` grid cells the Lagekarte is built
from, so glasses and command board describe the same field from one data set.

Every write goes through `setCategory` / `addTreatment` / `addInjury` /
`pushProtocol` and nowhere else: finishing a Sichtung writes the category, the
Sofortmaßnahmen as treatments, and two protocol lines (the answer trail and the
deciding rationale). Those four functions are the seam where the real
`PATCH /api/patients/{id}` + WebSocket sync attaches.

## Next steps
- **Backend sync:** replace the bundled roster with the hub's REST/WebSocket stream.
- **World-locked panel:** anchor the Ablaufschirm near the patient (WebXR anchors)
  instead of body-locking it to the medic.
- **Native PICO build:** `Unity/README-PICO.md` — dort ist der Kartenschritt ein
  echter Scan über die Enterprise-Kamera-API.
- **Offline edge-STT:** dictation for free-text findings, as the product plans.
