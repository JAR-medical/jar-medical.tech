// Course 1: "AR-Gesamtsystem: Brille, RFID & Edge-Hub" (DE + EN)
// Covers the complete J.A.R. AR architecture: RFID/NFC plaster (180 B) and
// QR/ArUco hanging tags (JAR-P1..P12) with Lucas-Kanade optical-flow coasting,
// the "Heiligenschein" helmet unit across HoloLens 2 (additive 43°x29°, fitToFov),
// PICO 4 Enterprise (OpenVSTCamera) and Meta Quest, the 6-field ArUco forearm
// wristband, the 13-region MakeHuman CC0 3D body model, the Client-Side Compute
// Unit (on-device ASR, 2 GiB crash-safe spool, UDP port 45454 discovery) and
// the local Incident Command Hub with GBNF + provenance verification.
export default {
  id: "ar-gesamtsystem",
  version: 1,
  section: "understand",
  icon: "arSystem",
  title: {
    de: "AR-Gesamtsystem: Brille, RFID & Edge-Hub",
    en: "AR System: Glasses, RFID & Edge Hub",
  },
  subtitle: {
    de: "Brille, RFID/NFC-Scanner, Armband & Hub im Zusammenspiel",
    en: "Glasses, RFID/NFC scanner, wristband & hub in action",
  },
  summary: {
    de: "Erkunden Sie in einer interaktiven Systemvisualisierung, wie alle Bausteine unseres AR-Systems zusammenarbeiten: vom 180-Byte-RFID/NFC-Pflaster und der QR-/ArUco-Karte am Patienten über den Einsatzhelm „Heiligenschein“ (HoloLens 2, PICO 4 Enterprise, Meta Quest), das ArUco-Papierarmband und das 13-Regionen-Körpermodell bis zur Client-Side Compute Unit und dem lokalen Edge-KI-Hub im Einsatzleitfahrzeug.",
    en: "Explore in an interactive system visualisation how every building block of our AR system works together: from the 180-byte RFID/NFC plaster and QR/ArUco tag on the patient, through the “Heiligenschein” helmet unit (HoloLens 2, PICO 4 Enterprise, Meta Quest), the ArUco paper wristband and the 13-region body model, to the Client-Side Compute Unit and the local Edge AI hub in the command vehicle.",
  },
  audience: {
    de: "Für Partnerorganisationen, technische Leiter, Einsatzkräfte und Forschungspartner, die den aktuellen Entwicklungsstand des J.A.R.-AR-Systems im Detail verstehen möchten.",
    en: "For partner organisations, technical leads, responders and research partners who want a detailed understanding of the current J.A.R. AR system.",
  },
  minutes: 23,
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: "ar-architektur-datenfluss",
      title: {
        de: "Das AR-Gesamtsystem: Vom Patienten bis zur Einsatzleitung",
        en: "The full AR system: from patient to incident command",
      },
      minutes: 8,
      blocks: [
        {
          type: "p",
          text: {
            de: "Bei einem Massenanfall von Verletzten (MANV) arbeiten Sichtungstrupps unter Zeitdruck, Lärm und oft ohne stabiles Mobilfunknetz. Unser AR-System (TriARge / „Heiligenschein“) ersetzt die isolierte Papierkarte durch eine vierstufige, vollständig lokal arbeitende Systemkette: **Patienten-Kennzeichnung** → **AR-Brille & Sensorik** → **Client-Side Compute Unit** → **Einsatzleitfahrzeug (Hub & Edge-KI)**.",
            en: "In a mass-casualty incident (MCI), triage teams work under time pressure, noise and often without mobile network coverage. Our AR system (TriARge / “Heiligenschein”) replaces isolated paper tags with a four-tier, fully local system chain: **patient identification** → **AR glasses & sensors** → **client-side compute unit** → **command vehicle (hub & edge AI)**.",
          },
        },
        {
          type: "ar-system-visual",
          mode: "architecture",
        },
        {
          type: "h",
          text: {
            de: "Wie RFID-/NFC-Scanner und optisches Tracking ineinandergreifen",
            en: "How the RFID/NFC scanner and optical tracking work together",
          },
        },
        {
          type: "p",
          text: {
            de: "Damit eine Sichtungskategorie niemals über dem falschen Patienten eingeblendet wird, kombiniert J.A.R. eine **kontaktlose Funk-Identifikation (RFID / NFC)** mit **optischem Marker-Tracking (QR + ArUco)** und **räumlichen 3D-Bodenankern**:",
            en: "To ensure a triage category is never displayed above the wrong patient, J.A.R. combines **contactless radio identification (RFID / NFC)** with **optical marker tracking (QR + ArUco)** and **spatial 3D ground anchors**:",
          },
        },
        {
          type: "table",
          head: {
            de: ["Ebene", "Komponente", "Technische Umsetzung im Projekt"],
            en: ["Tier", "Component", "Technical implementation in the project"],
          },
          rows: {
            de: [
              [
                "Patient (Funk-ID)",
                "RFID- / NFC-Pflaster",
                "Im Pflaster integriertes Tag mit ca. 180 Byte EEPROM; speichert Patienten-UUID, Sichtungskategorie und Zeitstempel direkt am Körper.",
              ],
              [
                "Patient (Optik)",
                "QR- & ArUco-Umhängekarte",
                "Nummerierte Rohlinge (JAR-P1 bis JAR-P12) mit QR-Fehlerkorrektur H und 50-mm-ArUco-Marker; bei Verdeckung hält Lucas-Kanade Optical-Flow-Coasting das Overlay stabil.",
              ],
              [
                "Sanitäter (Kopf)",
                "AR-Brille („Heiligenschein“)",
                "Läuft auf Microsoft HoloLens 2, PICO 4 Enterprise und Meta Quest; zeigt das kopffeste Rand-HUD, den Bodenmarker-Ring und das 13-Regionen-Körpermodell.",
              ],
              [
                "Sanitäter (Arm & Körper)",
                "ArUco-Armband & Compute Unit",
                "6-Felder-Papierarmband am linken Unterarm + tragbare Recheneinheit für lokale Spracherkennung (Whisper ONNX / Parakeet-TDT) und 2-GiB-Offline-Spool.",
              ],
              [
                "Einsatzleitfahrzeug",
                "Docker-Hub & Edge-LLM",
                "FastAPI + Postgres + Redis für bis zu 20 Brillen; 4-DoF-Map-Stitcher, Sprechfunk-Monitor (AUX) und lokales LLM (qwen2.5:7b / LFM2-1.2B per GBNF).",
              ],
            ],
            en: [
              [
                "Patient (RF ID)",
                "RFID / NFC plaster tag",
                "Plaster-integrated tag with approx. 180 bytes EEPROM; stores patient UUID, triage category and timestamp directly on the patient.",
              ],
              [
                "Patient (Optical)",
                "QR & ArUco hanging tag",
                "Numbered blanks (JAR-P1 to JAR-P12) with QR error correction H and 50 mm ArUco marker; Lucas-Kanade optical-flow coasting holds the overlay during occlusion.",
              ],
              [
                "Paramedic (Head)",
                "AR glasses (“Heiligenschein”)",
                "Runs on Microsoft HoloLens 2, PICO 4 Enterprise and Meta Quest; renders the peripheral HUD, ground ring marker and 13-region body model.",
              ],
              [
                "Paramedic (Arm & Body)",
                "ArUco wristband & compute unit",
                "6-field paper wristband on the left forearm + body-worn compute unit for local speech recognition (Whisper ONNX / Parakeet-TDT) and 2 GiB offline spool.",
              ],
              [
                "Command vehicle",
                "Docker hub & edge LLM",
                "FastAPI + Postgres + Redis for up to 20 headsets; 4-DoF map stitcher, radio monitor (AUX) and local LLM (qwen2.5:7b / LFM2-1.2B via GBNF).",
              ],
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Wie viel Speicher besitzt das im Konzept vorgesehene RFID-/NFC-Tag im Pflaster am Patienten, und wofür wird es genutzt?",
            en: "How much memory does the plaster-integrated RFID/NFC tag carry, and what is it used for?",
          },
          options: [
            {
              de: "Rund 180 Byte für die eindeutige Patienten-ID, Sichtungskategorie und Basisdaten direkt am Patienten",
              en: "Roughly 180 bytes for the unique patient ID, triage category and core metadata right on the patient",
            },
            {
              de: "64 Gigabyte für mehrstündige Videoaufnahmen der Brille",
              en: "64 gigabytes for multi-hour video recordings from the glasses",
            },
            {
              de: "Es speichert gar nichts und dient nur als optischer Reflektor",
              en: "It stores nothing and serves only as an optical reflector",
            },
          ],
          answer: 0,
          explain: {
            de: "Das im Pflaster integrierte NFC-/RFID-Tag verfügt über rund 180 Byte Speicher, sodass Patienten-ID und Sichtungsstatus direkt am Körper abrufbar sind.",
            en: "The plaster-integrated NFC/RFID tag holds roughly 180 bytes so patient ID and triage status can be read directly at the patient.",
          },
        },
        {
          q: {
            de: "Was passiert im optischen AR-Tracking, wenn der ArUco-Marker am Patienten während der Behandlung kurzzeitig durch eine Hand verdeckt wird?",
            en: "What happens in optical AR tracking when a responder's hand briefly covers the patient's ArUco marker during treatment?",
          },
          options: [
            {
              de: "Lucas-Kanade Optical-Flow-Coasting hält das Overlay stabil; erst nach Ablauf des Coast-Timeouts ohne Re-Verifikation schließt die Anzeige sicherheitsgerichtet (fail-closed).",
              en: "Lucas-Kanade optical-flow coasting keeps the overlay anchored; only after the coast timeout expires without re-verification does it drop fail-closed.",
            },
            {
              de: "Die Patientenakte springt sofort auf einen zufälligen anderen Patienten im Raum.",
              en: "The patient record immediately jumps to a random other patient in the room.",
            },
            {
              de: "Das gesamte Headset startet neu.",
              en: "The entire headset reboots.",
            },
          ],
          answer: 0,
          explain: {
            de: "Durch Optical-Flow-Coasting überbrückt der Anker kurze Verdeckungen, verwirft das Overlay aber nach dem Timeout („fail-closed“), um Verwechslungen auszuschließen.",
            en: "Optical-flow coasting bridges brief occlusions, then drops the overlay after the timeout (“fail-closed”) to prevent patient mix-ups.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 2
    {
      id: "brillen-optik-rfid-armband",
      title: {
        de: "AR-Brillen, RFID/NFC-Scanner, Armband & Körpermodell",
        en: "AR headsets, RFID/NFC scanner, wristband & body model",
      },
      minutes: 8,
      blocks: [
        {
          type: "p",
          text: {
            de: "Eine Microsoft HoloLens 2 hat eine völlig andere Optik als eine PICO 4 Enterprise oder Meta Quest: Ein **additives Waveguide-Display** kann Licht nur hinzufügen, niemals abdunkeln – Schwarz ist dort schlicht die durchsichtige Wirklichkeit. Unser Modul `display.js` erkennt die Optik der Brille zur Laufzeit und passt Palette sowie Blickfeld (`fitToFov`) automatisch an.",
            en: "A Microsoft HoloLens 2 uses a fundamentally different optical principle from a PICO 4 Enterprise or Meta Quest: an **additive waveguide display** can only add light, never darken it – black is simply transparent reality. Our `display.js` module detects the headset's blend mode at runtime and adapts the palette and field of view (`fitToFov`) automatically.",
          },
        },
        {
          type: "ar-system-visual",
          mode: "visor",
        },
        {
          type: "h",
          text: {
            de: "Optische Anpassung, Feder-Physik und das ArUco-Papierarmband",
            en: "Optical adaptation, spring physics and the ArUco paper wristband",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Blickfeld aus der Projektionsmatrix messen (`fitToFov`):** Auf der HoloLens 2 (43°×29° Blickfeld) wird die Handlungskarte auf 28°×20° eingepasst, keine dunklen Hintergründe gezeichnet und die Bildrate durch zweigeteilte Neuzeichnung (`_hudSignature`: Eingabe sofort, Lagekarte max. alle 80 ms) geschont.",
              "**Kopffestes Rand-HUD mit Federn (`motion.js`):** Das HUD lässt die Blickmitte für den Patienten frei und zieht erst nach, wenn der Blick um rund 40° abgewandert ist – gesteuert über kritisch gedämpfte Federn (`damping 1.0`, getrennt für Gier und Neigung), die jederzeit ohne Ruck umgelenkt werden können.",
              "**ArUco-Papierarmband durch Verdeckung bedienen (`wristband.js`):** Sechs Felder (**Ja, Nein, Zurück, Patient, Tätigkeit, Lagebild**) plus zwei Rand-Anker am linken Unterarm. Ist genau ein Feld für mindestens 200 ms durch einen Finger verdeckt, während ein Rand-Anker sichtbar bleibt, löst der Befehl aus.",
              "**13-Regionen-Körpermodell (`body.js`):** Das geschlechtsneutrale MakeHuman-Basisnetz (CC0, 13.380 Punkte, 26.756 Dreiecke) ist über Knochen-Abstände in 13 Regionen unterteilt und steht raumfest über dem Bodenmarker des Patienten.",
            ],
            en: [
              "**Measure FoV from the projection matrix (`fitToFov`):** on HoloLens 2 (43°×29° FoV) the action card is fitted to 28°×20°, dark backdrops are omitted, and framerate is preserved via split redrawing (`_hudSignature`: input instant, minimap throttled to 80 ms).",
              "**Peripheral HUD with spring physics (`motion.js`):** the HUD keeps the centre of view clear for the patient and follows only once gaze shifts by roughly 40° – driven by critically damped springs (`damping 1.0`, separate yaw and pitch) that can be redirected mid-motion.",
              "**ArUco paper wristband via occlusion (`wristband.js`):** six fields (**Yes, No, Back, Patient, Task, Operating picture**) plus two edge anchors on the left forearm. When exactly one field is covered by a finger for at least 200 ms while an edge anchor stays visible, the command fires.",
              "**13-region body model (`body.js`):** the gender-neutral MakeHuman base mesh (CC0, 13,380 vertices, 26,756 triangles) is partitioned by bone distance into 13 regions and remains anchored in world space above the patient's ground ring.",
            ],
          },
        },
        {
          type: "link",
          href: "../demo/paramedic/",
          label: {
            de: "Sanitäter- & AR-Client-Simulation im Browser öffnen →",
            en: "Open Paramedic & AR Client Simulation in browser →",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Warum tauscht `display.js` auf einer Microsoft HoloLens 2 die Farbpalette auf den additiven Modus um?",
            en: "Why does `display.js` switch the colour palette to additive mode on a Microsoft HoloLens 2?",
          },
          options: [
            {
              de: "Weil ein additives Glas Licht nur hinzufügen kann (Schwarz ist durchsichtig) und das kleinere Blickfeld (43°×29°) über die Projektionsmatrix eingepasst werden muss",
              en: "Because an additive waveguide can only add light (black is transparent) and the smaller FoV (43°×29°) must be fitted via the projection matrix",
            },
            {
              de: "Weil die HoloLens 2 nur Graustufen darstellen kann",
              en: "Because the HoloLens 2 can only render greyscale",
            },
            {
              de: "Um die Batterie der Patienten-Umhängekarte zu laden",
              en: "To charge the battery of the patient's hanging tag",
            },
          ],
          answer: 0,
          explain: {
            de: "Auf additivem Glas sind dunkle Unterlagen unsichtbar; Lesbarkeit entsteht dort durch kräftigere Linien, sattere Farben und exaktes Einpassen per `fitToFov`.",
            en: "On additive glass dark backdrops are invisible; legibility comes from heavier strokes, saturated colours and exact FoV fitting via `fitToFov`.",
          },
        },
        {
          q: {
            de: "Wie erkennt die Kamera-Betriebsart einen Tastendruck auf dem ArUco-Papierarmband am Unterarm?",
            en: "How does camera mode detect a button press on the forearm ArUco paper wristband?",
          },
          options: [
            {
              de: "Über gezielte Marker-Verdeckung: Genau ein Befehlsfeld ist für mind. 200 ms verdeckt, während mindestens ein Rand-Anker sichtbar bleibt",
              en: "Via targeted marker occlusion: exactly one command field is covered for at least 200 ms while at least one edge anchor remains visible",
            },
            {
              de: "Über eingebaute Drucksensoren und Bluetooth im Papier",
              en: "Via built-in pressure sensors and Bluetooth inside the paper",
            },
            {
              de: "Indem alle sechs Marker gleichzeitig aus dem Kamerabild gehalten werden",
              en: "By moving all six markers out of the camera frame at once",
            },
          ],
          answer: 0,
          explain: {
            de: "Fehlt genau ein Feldmarker, während ein Rand-Anker zu sehen ist, liegt dort ein Finger; fehlen mehrere, ist das Band nur schräg im Bild und löst nichts aus.",
            en: "When exactly one field marker disappears while an edge anchor is visible, a finger is resting on it; if several disappear, the band is merely angled and nothing triggers.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 3
    {
      id: "compute-unit-spool-hub",
      title: {
        de: "Compute Unit, Offline-Spool & Hub-Protokollierung",
        en: "Compute unit, offline spool & hub protocol generation",
      },
      minutes: 7,
      blocks: [
        {
          type: "p",
          text: {
            de: "Die Verbindung zwischen den bis zu **20 AR-Brillen** und dem **Einsatzleitfahrzeug (Hub)** ist in `contract/PROTOCOL.md` fest definiert. Oberstes Prinzip: **Die Aufnahme am Patienten wartet niemals auf das Netzwerk.** Kartierung, Spracherkennung und HUD laufen ohne Hub weiter; alle Daten werden lokal gepuffert und bei Funkkontakt automatisch übertragen.",
            en: "The link between up to **20 AR headsets** and the **command vehicle (hub)** is strictly specified in `contract/PROTOCOL.md`. The primary rule: **capture at the patient never blocks on the network.** Mapping, speech recognition and the HUD keep running with no hub in sight; all data is spooled locally and drained automatically on connect.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Automatische WLAN-Entdeckung (UDP Port 45454):** Der Hub sendet alle 2 s einen Broadcast-Beacon; antwortet keiner binnen 6 s, schickt die Brille aktive UDP-Probes mit Nonce und exponentiellem Backoff.",
              "**Crash-sicherer Offline-Spool (2 GiB Mesh + 100.000 Segmente):** Sollte der Speicher jemals volllaufen, verwirft das Gerät ausschließlich die ältesten Raumgeometrie-Revisionen – **niemals gesprochene Transkript-Segmente**.",
              "**5-Sekunden-Heartbeat & Befehlsrückkanal:** Jede Brille meldet alle 5 s Akkustand, CPU-Last, Temperatur, Tracking-FPS, aktives ASR-Modell und Spool-Tiefe und empfängt Hub-Kommandos (`flush_spool`, `set_asr_model`, `set_session`).",
              "**Dreifach abgesicherte LLM-Protokollierung am Hub:** Das lokale Sprachmodell (`qwen2.5:7b-instruct` bzw. `LFM2-1.2B` mit GBNF) gruppiert Segmente nach Patienten-ID. Jeder Eintrag muss durch ein wörtliches Zitat (`provenance`) im Transkript belegt sein und physiologische Plausibilitätschecks (`rr_systolisch` größer als `rr_diastolisch`) bestehen; das Protokoll startet immer als `ungeprueft`.",
            ],
            en: [
              "**Automatic Wi-Fi discovery (UDP port 45454):** the hub broadcasts a beacon every 2 s; if none is heard within 6 s, the headset sends active UDP probes with nonce and exponential backoff.",
              "**Crash-safe offline spool (2 GiB mesh + 100,000 segments):** if local storage ever hits its cap, the device drops only the oldest mesh revisions – **never spoken transcript segments**.",
              "**5-second heartbeat & command channel:** every headset reports battery, CPU load, thermal state, tracking FPS, active ASR model and spool depth every 5 s and receives hub commands (`flush_spool`, `set_asr_model`, `set_session`).",
              "**Triple-guarded LLM protocol drafting on the hub:** the local language model (`qwen2.5:7b-instruct` or `LFM2-1.2B` with GBNF) clusters segments by patient ID. Every populated value must be backed by a verbatim quote (`provenance`) and pass physiological checks (`rr_systolisch` greater than `rr_diastolisch`); every protocol starts as `ungeprueft`.",
            ],
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "**Medizinische Sicherheit durch Provenienz-Zwang:** Erfindet das Sprachmodell einen Wert ohne wörtliches Zitat im Transkript oder vertauscht es systolischen und diastolischen Blutdruck, streicht der Hub den Wert mechanisch auf `null` und setzt ihn auf die Liste `offene_punkte` für die ärztliche Prüfung.",
            en: "**Clinical safety through mandatory provenance:** if the language model invents a value with no verbatim quote in the transcript or transposes systolic and diastolic blood pressure, the hub mechanically strips the value to `null` and lists it under `offene_punkte` for human review.",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Was verwirft der lokale Offline-Spool einer AR-Brille zuerst, falls die Speichergrenze bei langem Verbindungsausfall erreicht wird?",
            en: "What does an AR headset's local offline spool drop first if its storage cap is reached during a prolonged network outage?",
          },
          options: [
            {
              de: "Ausschließlich die ältesten Raumgeometrie-Revisionen (Mesh-Chunks), niemals gesprochene Transkript-Segmente",
              en: "Exclusively the oldest spatial mesh revisions, never spoken transcript segments",
            },
            {
              de: "Zuerst alle gesprochenen Patienten-Transkripte und Vitalwerte",
              en: "All spoken patient transcripts and vital signs first",
            },
            {
              de: "Das Betriebssystem der Brille",
              en: "The headset's operating system",
            },
          ],
          answer: 0,
          explain: {
            de: "Raumgeometrie lässt sich jederzeit erneut scannen, gesprochene Aussagen am Patienten hingegen nicht – deshalb werden Transkript-Segmente niemals verworfen.",
            en: "Spatial geometry is re-observable, whereas spoken clinical statements are not – so transcript segments are never dropped.",
          },
        },
        {
          q: {
            de: "Wie verhindert der J.A.R.-Hub, dass ein halluzinierter Vitalwert des Sprachmodells ungeprüft ins Einsatzprotokoll gelangt?",
            en: "How does the J.A.R. hub prevent a hallucinated vital sign from reaching the care protocol unchecked?",
          },
          options: [
            {
              de: "Durch mechanische Provenienz-Prüfung (jeder Wert braucht ein verifiziertes Wort-Zitat im Segment), Plausibilitätschecks und den Startstatus „ungeprueft“",
              en: "Through mechanical provenance verification (every value requires a verified verbatim quote in the segment), plausibility checks and the initial state “ungeprueft”",
            },
            {
              de: "Indem fehlende Werte durch Durchschnittswerte ersetzt werden",
              en: "By replacing missing values with population averages",
            },
            {
              de: "Gar nicht – die Ausgabe des Modells wird blind gespeichert",
              en: "Not at all – the model's output is stored blindly",
            },
          ],
          answer: 0,
          explain: {
            de: "Jedes belegte Feld muss ein echtes Zitat im genannten Transkript-Segment nachweisen; unbelegte oder unplausible Werte werden auf null gesetzt und unter offene_punkte gelistet.",
            en: "Every populated field must point to a verified quote in the cited transcript segment; unbacked or implausible values are nulled and listed under offene_punkte.",
          },
        },
      ],
    },
  ],
};
