# J.A.R. AR-Client — Sichtung im Blickfeld

Der **Trupp-Teil** von J.A.R. Medical / **TriARge**. Läuft im Headset-Browser auf
**PICO 4 (Enterprise)** und **Meta Quest** über WebXR, flach auch auf Handy oder
Laptop. Gegenstück zum Lagebild der Einsatzleitung in `../demo`.

Der Ablauf, von vorn bis hinten:

```
Tätigkeit wählen ─▶ Lagekarte ─▶ „Neuer Patient" (Stelle am Boden zeigen)
                 ─▶ was die Tätigkeit vorsieht ─▶ nächster
```

- **Zuerst die Tätigkeit.** Im MANV macht nicht dieselbe Person alles. Beim Start
  wird gewählt, worin man eingesetzt ist — **Vorsichtung**, **Sichtung
  (ärztlich)**, **Registrierung** oder **Behandlung & Transport**. Das ist keine
  Beschriftung: die Wahl bestimmt, was passiert, wenn du einen Patienten
  öffnest, und ob du überhaupt neue anlegen kannst. Gewechselt wird jederzeit
  über die Lage. Siehe [Die vier Tätigkeiten](#die-vier-tätigkeiten).
- **Kein mitgelieferter Datensatz.** Der Einsatz beginnt leer. Wer vor dir liegt,
  wird angelegt — in AR **an der Stelle, auf die du zeigst**: ein Ring wandert
  über den Boden, auslösen setzt ihn fest. Flach (Handy, Laptop) entsteht der
  Patient dort, wo du stehst. Diese Position hält die Lagekarte fest.
- **Karte kommt zuletzt.** Erst sichten, dann eine Umhängekarte umhängen und ihre
  Nummer zuweisen — per Scan oder von Hand. Die Karten sind austauschbare
  Rohlinge; welche an welchen Patienten geht, entscheidet sich im Einsatz. Eine
  Karte kann nur an einem Hals hängen, und die App bucht sie nicht still um.
- **Es ist ein HUD, kein Fenster.** Randinformation kopffest an den Rändern des
  Blickfelds, die Mitte bleibt frei. Es steht still, bis der Blick 40°
  abgewandert ist, und zieht dann in einem Zug um. Solange kein Schritt ansteht,
  gibt es **gar keinen großen Schirm**: „Neuer Patient" und „Tätigkeit" sind zwei
  kleine Knöpfe am unteren Rand, sonst schaust du einfach durch.
- **Marker liegen am Boden.** Über jedem angelegten Patienten liegt ein Ring an
  seiner Stelle — gefüllt in der Sichtungsfarbe, gestrichelt solange ungesichtet.
  Der Marker **ist** die Schaltfläche: einen Patienten öffnest du, indem du
  seinen Marker anklickst. Von selbst geht nichts auf.
- **Die Handlungskarte** steht beim Patienten, an dem du arbeitest, und wird
  herangeholt, wenn du sie länger nicht im Blick hast.
- **Bedienung im Browser: Blick + Verweilen.** Fadenkreuz in der Blickmitte, 1,1 s
  auf einem Knopf löst aus. Controller gehen auch (Strahl + Trigger).
  **Handtracking gibt es hier nicht:** der PICO-Browser stellt die
  WebXR-Hand-Input-Schnittstelle nicht bereit. Wer es will, nimmt den nativen
  Build (`Unity/README-PICO.md`).
- **mSTaRT** — sechs Ja/Nein-Fragen, jede vorgelesen, Schritt-zurück inklusive.

⚠️ **Übungszweck** — Schülerprojekt, kein Medizinprodukt. Die Sichtungskategorie
ist ein Vorschlag, die Verantwortung bleibt bei der Person mit der Brille.

Alles ist eine **statische Web-App** (kein Build, kein Backend); der Einsatz lebt
im Speicher der Sitzung.

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

**Umhängekarten drucken:** `assets/markers/patientenkarten.pdf` (A4, 3 Seiten,
12 Karten) — oder `patientenkarten.html` im Browser drucken, **ohne Skalierung**.
Ausschneiden, oben rechts lochen. Es sind nummerierte Rohlinge: welchem
Patienten eine Karte gehört, entscheidest du im Einsatz.

---

## The three modes

| Modus | Was er tut | Wo er läuft |
|------|--------------|---------------|
| **AR-Modus** | Passthrough, Lagekarte und Ablauf auf einer WebGL-Ebene, bedient per Blick. | PICO / Quest |
| **Kamera-Modus** | Derselbe Ablauf flach, mit echtem QR-Scan der Karte. | Handy / Laptop |
| **Simulation** | Derselbe Ablauf ohne Kamera und ohne Headset. | überall |

Die Startseite prüft das Gerät und sperrt, was es nicht kann.

**Deep link:** `index.html?mode=sim` springt direkt in eine Betriebsart.

---

## Die vier Tätigkeiten

Der erste Schirm fragt: **Was machst du gerade?** Die Antwort steht danach oben
links im Blickfeld und in **jeder Protokollzeile** — sonst ließe sich später
nicht mehr sagen, ob eine Kategorie aus der Vorsichtung des Trupps oder aus der
ärztlichen Sichtung stammt.

| Tätigkeit | Am Patienten passiert | Neue anlegen? |
|---|---|---|
| **Vorsichtung** | mSTaRT, sechs Fragen → Kategorie → Umhängekarte | ja |
| **Sichtung (ärztlich)** | Kategorie direkt wählen, **SK IV regulär** statt als Override | ja |
| **Registrierung** | direkt in den Kartenschritt — zuweisen oder Nummer ändern | ja |
| **Behandlung & Transport** | Maßnahmen festhalten (nochmal antippen nimmt zurück), Abtransport buchen | nein |

Behandlung legt bewusst niemanden an: wer behandelt, arbeitet an Patienten, die
schon auf der Lagekarte stehen. Abtransportierte bleiben dort, wo sie lagen — das
gehört zum Lagebild —, treten aber zurück: Marker und Kartenpunkt werden matt.

Eine fünfte Tätigkeit ist ein Eintrag in der Tabelle in `js/tasks.js` plus ein
Zweig in `Workflow._atPatient()`.

---

## ⚠️ Kamera und Kartenschritt

Die App **fordert die Kamera überall an**, auch im Headset — ob eine kommt,
beantwortet nur das Gerät. Bekommt sie eine, wird die Umhängekarte wirklich
gescannt; bekommt sie keine, steht der Grund unten rechts und die Nummer wird
mit **−/+** gewählt. Der Ablauf läuft in beiden Fällen durch.

Erfahrungsgemäß geben Headset-Browser die Passthrough-Kameras nicht heraus (auf
der Quest 2 gar keiner App, auf Quest 3 und PICO 4 Enterprise nur nativen Apps).
Zum echten Scannen: Handy im Kamera-Modus, oder der native Build
(`Unity/README-PICO.md`).

---

## Files

```
oculusapp/
├─ index.html            Landing + Bühne (Ablaufschirm, Lagekarte, Akte)
├─ css/hud.css           Styling (Triage-Palette wie im Lagebild)
├─ js/
│  ├─ data.js            Akten dieses Einsatzes (leer beim Start) + Schreibfunktionen
│  ├─ tasks.js           die vier Tätigkeiten als Tabelle (Ablauf, Rechte, Beschriftung)
│  ├─ mstart.js          das mSTaRT-Schema als Entscheidungsbaum (reine Logik)
│  ├─ layout.js          Lagekarte: Weltpositionen → Kartenfläche, Ausschnitt, Distanzen
│  ├─ workflow.js        der Ablauf als Zustandsmaschine — kennt keine Darstellung
│  ├─ hudscreen.js       zeichnet die vier AR-Ebenen (Rand-HUD mit Kleinknöpfen,
│  │                     Handlungskarte, Bodenmarker, Anlege-Ring) und liefert
│  │                     die Trefferflächen
│  ├─ xr.js              WebXR-Sitzung: kopffestes HUD, raumfeste Karte,
│  │                     anklickbare Bodenmarker, Stelle am Boden zeigen,
│  │                     Strahl und Auslösen
│  ├─ hudcanvas.js       Patientenakte auf Canvas
│  ├─ hud.js             Patientenakte als DOM
│  ├─ qr.js              QR: BarcodeDetector → jsQR-Fallback; liest JAR-P<n>
│  ├─ voice.js           Sprachausgabe (und ein Kommando-Parser für den Quest-Build)
│  └─ app.js             Verdrahtung: Betriebsarten, DOM-Darstellung, Deep-Links
├─ tests/
│  ├─ logic.test.mjs     131 Prüfungen: mSTaRT, Akten, Lagekarte, Ablauf,
│  │                     Stelle am Boden, alle vier Tätigkeiten
│  ├─ probe_flow.html    rendert alle AR-Schirme nacheinander
│  ├─ probe_dom.html     klickt den flachen Ablauf durch
│  └─ probe_qr.html      decodiert jede gedruckte Karte mit jsQR
├─ Unity/                nativer PICO-/Quest-Build (siehe Unity/README-PICO.md)
├─ vendor/jsQR.min.js    QR-Decoder-Fallback
├─ make_cards.py         erzeugt den Druckbogen der Umhängekarten (segno)
├─ make_markers.py       erzeugt die nackten QR-Marker (segno)
└─ assets/markers/       patientenkarten.pdf/.html (Umhängekarten, zum Drucken)
                         JAR-P1..JAR-P12.svg + markers.html (nackte Marker)
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
../../.venv/bin/python make_cards.py
```
Nutzt `segno`. Die Nutzlast ist `JAR-P<id>`; `qr.js` versteht `JAR-P7`, `JAR:7`,
`.../patient/7` und die nackte `7`.

Zwei Dinge daran sind nicht verhandelbar und stehen deshalb im Skript
kommentiert: **Fehlerkorrektur H** (bei niedrigeren Stufen wählt segno für so
kurze Nutzlasten ein Micro-QR, und jsQR liest Micro-QR nicht) und eine
**viewBox** am SVG (ohne sie rastert die Grafik beim Verkleinern falsch und ist
nicht mehr scanbar). `tests/probe_qr.html` prüft beides, indem es jeden Code aus
dem fertigen Bogen mit jsQR decodiert — klar, in Kameragröße und schräg mit
Rauschen.

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

## Wo das an das echte Produkt anschließt

Im Produkt kommen die Akten vom FastAPI-Hub über REST + WebSocket, und eine
zugewiesene Karte taucht sofort im Lagebild der Einsatzleitung auf. Hier, ohne
Backend auf statischem Hosting, hält `js/data.js` den Einsatz im Speicher — mit
derselben Satzform.

Jeder Schreibzugriff geht durch `createPatient` / `assignCard` / `setCategory` /
`addTreatment` / `removeTreatment` / `markTransported` / `pushProtocol` und
nirgends sonst. Eine abgeschlossene Sichtung schreibt Kategorie,
Sofortmaßnahmen und zwei Protokollzeilen (Antwortpfad und ausschlaggebende
Begründung). Genau diese Funktionen sind die Naht, an der `POST /api/patients`
und `PATCH /api/patients/{id}` andocken.

Die gewählte Tätigkeit hängt an der Sitzung, nicht an der Akte
(`setActiveTask`), und wird auf jede Protokollzeile gestempelt — im Produkt wäre
das die Rolle am angemeldeten Gerät.

## Next steps
- **Hub-Anbindung:** die Sitzung gegen REST/WebSocket tauschen.
- **Räumliche Anker:** Positionen über WebXR-Anchors halten, damit sie ein
  Neuladen überleben.
- **Nativer PICO-Build:** `Unity/README-PICO.md` — dort scannt die Brille wirklich.
- **Diktat:** Freitext-Befunde per Offline-STT, wie im Produkt vorgesehen.
