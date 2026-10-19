// Interactive visual representation of the entire J.A.R. AR system:
//   1. End-to-end 4-tier architecture diagram (Patient with RFID/NFC plaster &
//      QR/ArUco hanging tag -> AR Glasses "Heiligenschein" + Paper Wristband ->
//      Client-Side Compute Unit -> Incident Command Hub & Edge AI) with
//      clickable hardware/software nodes and live protocol inspector.
//   2. Interactive AR Visor, RFID/NFC Scanner, ArUco Wristband & 13-Region
//      3D Body Model simulator (PICO 4 / Quest Passthrough vs. HoloLens 2
//      Additive 43°x29° display, mSTaRT pre-triage & live packet flow).
// Built exclusively with DOM/SVG nodes via el()/replace() (never innerHTML).
import { el, replace } from "./ui.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    node.setAttribute(k, String(v));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const NODES = [
  {
    id: "rfid",
    tier: "01 · Patient",
    col: 0,
    x: 24,
    y: 58,
    w: 192,
    h: 92,
    accent: "#8ec7b8",
    badge: "NFC / RFID · 180 B",
    title: {
      de: "RFID- / NFC-Pflaster",
      en: "RFID / NFC Plaster Tag",
    },
    sub: {
      de: "Kontaktlose Patienten-ID am Körper",
      en: "Contactless on-body patient ID",
    },
    detail: {
      de: "Im Zielsystem trägt jeder Patient ein direkt ins Pflaster integriertes RFID-/NFC-Tag mit rund 180 Byte nichtflüchtigem Speicher. Der Scanner an der Einsatzkraft liest und beschreibt das Tag kontaktlos auf wenige Zentimeter: eindeutige Patienten-ID, aktuelle Sichtungskategorie (SK I–IV) und Zeitstempel der Erstversorgung sind physisch am Patienten gespeichert – selbst vor jeder Funkverbindung.",
      en: "In the target system every patient wears an RFID/NFC tag integrated directly into a plaster with roughly 180 bytes of non-volatile memory. The responder's scanner reads and writes the tag contactlessly within a few centimetres: unique patient ID, current triage category (SK I–IV) and timestamp of initial care are stored physically on the patient – even before any radio link exists.",
    },
    specs: {
      de: [
        ["Speicher & Bauform", "ca. 180 Byte EEPROM im Pflaster (wasser- & schmutzfest)"],
        ["Erfassung", "Kontaktloser RFID-/NFC-Scan beim Herantreten an den Patienten"],
        ["Gespeicherte Felder", "Patienten-UUID, SK-Status, Erstkontakt-Zeit, Checksumme"],
        ["Sicherheitsregel", "1:1-Bindung („fail-closed“) – kein stilles Umbuchen auf zweite Person"],
      ],
      en: [
        ["Memory & form factor", "approx. 180 bytes EEPROM in plaster (water & dirt resistant)"],
        ["Capture", "Contactless RFID/NFC scan when approaching the patient"],
        ["Stored fields", "Patient UUID, triage status, first-contact time, checksum"],
        ["Safety rule", "1:1 binding (“fail-closed”) – never silently reassigned to another patient"],
      ],
    },
  },
  {
    id: "qraruco",
    tier: "01 · Patient",
    col: 0,
    x: 24,
    y: 168,
    w: 192,
    h: 92,
    accent: "#f0b45c",
    badge: "QR + ArUco · 50 mm",
    title: {
      de: "QR- & ArUco-Umhängekarte",
      en: "QR & ArUco Hanging Tag",
    },
    sub: {
      de: "Optischer Anker & Optical-Flow",
      en: "Optical anchor & optical flow",
    },
    detail: {
      de: "Ergänzend zum RFID-/NFC-Tag nutzt der aktuelle Feldprototyp matt gedruckte Umhängekarten (JAR-P1 bis JAR-P12) mit QR-Code (Fehlerkorrekturstufe H) und 50-mm-ArUco-Marker. Sobald die Brillenkamera den Marker erfasst, wird das AR-Overlay räumlich am Patienten verankert. Wird der Marker während der Behandlung durch Hände verdeckt, hält Lucas-Kanade Optical-Flow-Coasting das Overlay stabil an Ort und Stelle.",
      en: "Alongside the RFID/NFC tag, the current field prototype uses matte-printed hanging tags (JAR-P1 to JAR-P12) carrying a QR code (error correction level H) and a 50 mm ArUco marker. Once the headset camera detects the marker, the AR overlay is spatially anchored to the patient. If hands briefly occlude the marker during treatment, Lucas-Kanade optical-flow coasting keeps the overlay anchored.",
    },
    specs: {
      de: [
        ["Nutzlast & Format", "JAR-P1..P12 · QR Level H (kein Micro-QR) + 50 mm ArUco (300 DPI matt)"],
        ["Verdeckungs-Schutz", "Lucas-Kanade Optical-Flow-Coasting; Fail-Closed nach Coast-Timeout"],
        ["Stich-Anker", "POST /api/v1/mesh/anchors (kind: qr, accuracy_m: 0.05)"],
        ["Rückfallebene", "Manuelle Nummernwahl (−/+) + klassische Papier-Sichtungskarte"],
      ],
      en: [
        ["Payload & format", "JAR-P1..P12 · QR level H (no Micro-QR) + 50 mm ArUco (300 DPI matte)"],
        ["Occlusion handling", "Lucas-Kanade optical-flow coasting; fail-closed after coast timeout"],
        ["Stitch anchor", "POST /api/v1/mesh/anchors (kind: qr, accuracy_m: 0.05)"],
        ["Fallback", "Manual number selection (−/+) + standard paper triage tag"],
      ],
    },
  },
  {
    id: "marker3d",
    tier: "01 · Patient",
    col: 0,
    x: 24,
    y: 278,
    w: 192,
    h: 92,
    accent: "#f0776e",
    badge: "13 Regionen · CC0 Mesh",
    title: {
      de: "3D-Bodenmarker & Körpermodell",
      en: "3D Ground Ring & Body Model",
    },
    sub: {
      de: "Raumfeste Akte & Verletzungsorte",
      en: "World-locked card & injury sites",
    },
    detail: {
      de: "Über jedem angelegten Patienten liegt ein raumfester Ring auf der gemeinsamen Bodenebene (local-floor) in der jeweiligen Sichtungsfarbe (ungesichtet: gestrichelt). Ab 3 m Annäherung fährt über eine kritisch gedämpfte Feder (damping 1.0) eine Kurz-Anzeige samt 3D-Körpermodell (MakeHuman CC0, 13.380 Punkte, 26.756 Dreiecke, 13 Knochen-Regionen) auf, an dem 6 Befundarten direkt lokalisiert werden.",
      en: "Above every created patient lies a world-locked ring on the shared floor plane (local-floor) in their triage colour (dashed while untriaged). Within 3 m a critically damped spring (damping 1.0) raises a summary badge alongside the 3D body model (MakeHuman CC0, 13,380 vertices, 26,756 triangles, 13 bone regions) where 6 finding types are localised directly.",
    },
    specs: {
      de: [
        ["Körpernetz", "MakeHuman hm08 (CC0), geschlechtsneutral, 13 anatomische Regionen"],
        ["6 Befundarten", "Blutung, Fraktur, Wunde, Verbrennung, Prellung, Amputation"],
        ["Raumverankerung", "Handlungskarte & Modell bleiben strikt über dem Patientenmarker"],
        ["Distanz-Logik", "Vorschau ab 3,0 m (Hysterese 4,0 m); Öffnen nur per bewusstem Klick"],
      ],
      en: [
        ["Body mesh", "MakeHuman hm08 (CC0), gender-neutral, 13 anatomical regions"],
        ["6 finding types", "Bleeding, fracture, wound, burn, contusion, amputation"],
        ["Spatial lock", "Action card & model stay strictly anchored above the patient marker"],
        ["Distance logic", "Preview within 3.0 m (4.0 m hysteresis); opens only on deliberate click"],
      ],
    },
  },
  {
    id: "glasses",
    tier: "02 · AR-Brille & Helm",
    col: 1,
    x: 252,
    y: 58,
    w: 192,
    h: 92,
    accent: "#8ec7b8",
    badge: "HoloLens 2 · PICO 4 · Quest",
    title: {
      de: "Einsatzhelm „Heiligenschein“ & HUD",
      en: "“Heiligenschein” Helmet & AR HUD",
    },
    sub: {
      de: "Additives Glas & Passthrough",
      en: "Additive waveguide & passthrough",
    },
    detail: {
      de: "Die AR-Einheit ist in den Einsatzhelm („Heiligenschein“) integriert und läuft auf Microsoft HoloLens 2 (additives Waveguide-Display 43°×29°, Schwarz = durchsichtige Realität), PICO 4 Enterprise (Video-Passthrough ~100°×95°, OpenVSTCamera) und Meta Quest. fitToFov misst die Projektionsmatrix der Brille aus; das HUD sitzt kopffest an den Rändern (Blickmitte frei) und zieht erst nach, wenn der Blick um mehr als 40° wandert.",
      en: "The AR unit is integrated into the incident helmet (“Heiligenschein”) and runs on Microsoft HoloLens 2 (additive waveguide 43°×29°, black = transparent reality), PICO 4 Enterprise (video passthrough ~100°×95°, OpenVSTCamera) and Meta Quest. fitToFov measures the headset's projection matrix; the HUD sits at the periphery (keeping centre view clear) and follows via springs only after gaze moves past 40°.",
    },
    specs: {
      de: [
        ["HoloLens 2 Modus", "environmentBlendMode: additive · 43°×29° FoV · 28°×20° Karte · Handtracking"],
        ["PICO 4 / Quest Modus", "alpha-blend Passthrough · ~100°×95° FoV · Blick+Verweilen (1,1 s) / Pinch"],
        ["Render-Taktung", "_hudSignature(): Eingabe-Feedback sofort (120 Hz), Lagekarte gedrosselt (80 ms)"],
        ["4 Rollen im Einsatz", "Vorsichtung (mSTaRT), Sichtung (Arzt), Registrierung, Behandlung & Transport"],
      ],
      en: [
        ["HoloLens 2 mode", "environmentBlendMode: additive · 43°×29° FoV · 28°×20° card · hand tracking"],
        ["PICO 4 / Quest mode", "alpha-blend passthrough · ~100°×95° FoV · gaze+dwell (1.1 s) / pinch"],
        ["Render cadence", "_hudSignature(): input feedback instant (120 Hz), minimap throttled (80 ms)"],
        ["4 operational roles", "Pre-triage (mSTaRT), Physician triage, Registration, Treatment & transport"],
      ],
    },
  },
  {
    id: "scanner",
    tier: "02 · AR-Brille & Helm",
    col: 1,
    x: 252,
    y: 168,
    w: 192,
    h: 92,
    accent: "#7aa8f8",
    badge: "RFID/NFC + 15 Hz CV",
    title: {
      de: "RFID-Scanner & Kamera-Pipeline",
      en: "RFID Scanner & Camera Pipeline",
    },
    sub: {
      de: "Kontaktlose & optische Erfassung",
      en: "Contactless & optical capture",
    },
    detail: {
      de: "Die Sensor-Pipeline vereint den RFID-/NFC-Leser (für das 180-Byte-Patientenpflaster) mit der optischen Kamera-Erkennung (OpenVSTCamera auf PICO 4 Enterprise mit ZXing-Worker-Thread bei 2 Hz bzw. WebXR-Timer-Schleife mit 15 Hz über BarcodeDetector + jsQR-Fallback). Beide Kanäle münden in dieselbe Zustandsmaschine und verhindern doppelte oder verwechselte Patienten-IDs.",
      en: "The sensor pipeline combines the RFID/NFC reader (for the 180-byte patient plaster) with optical camera recognition (OpenVSTCamera on PICO 4 Enterprise with a 2 Hz ZXing worker thread, or a 15 Hz WebXR timer loop via BarcodeDetector + jsQR fallback). Both channels feed the same state machine and prevent duplicate or mismatched patient IDs.",
    },
    specs: {
      de: [
        ["RFID / NFC Kanal", "Liest/schreibt 180-Byte-Pflaster-Tag; öffnet/erstellt Patientenakte sofort"],
        ["Optischer Kanal", "PICO OpenVSTCamera (800×600, AntiDistortion) + BarcodeDetector / jsQR"],
        ["WebXR-Kamerafix", "getUserMedia vor xr.start(), Video im Layout (.stumm), 15-Hz-Timer statt rAF"],
        ["Spatial Mapping", "ARFoundation ARMeshManager → HandednessConversion (Unity LH → OpenXR RH)"],
      ],
      en: [
        ["RFID / NFC channel", "Reads/writes 180-byte plaster tag; opens/creates patient record immediately"],
        ["Optical channel", "PICO OpenVSTCamera (800×600, AntiDistortion) + BarcodeDetector / jsQR"],
        ["WebXR camera fix", "getUserMedia before xr.start(), in-layout video (.stumm), 15 Hz timer loop"],
        ["Spatial mapping", "ARFoundation ARMeshManager → HandednessConversion (Unity LH → OpenXR RH)"],
      ],
    },
  },
  {
    id: "wristband",
    tier: "02 · AR-Brille & Helm",
    col: 1,
    x: 252,
    y: 278,
    w: 192,
    h: 92,
    accent: "#c49bff",
    badge: "6 ArUco-Felder · 200 ms",
    title: {
      de: "ArUco-Papierarmband (Unterarm)",
      en: "ArUco Paper Wristband (Forearm)",
    },
    sub: {
      de: "Bedienung durch Marker-Verdeckung",
      en: "Occlusion-based tactile input",
    },
    detail: {
      de: "Am linken Unterarm trägt die Einsatzkraft einen matt gedruckten Papierstreifen mit 6 ArUco-Feldern (Ja, Nein, Zurück, Patient, Tätigkeit, Lagebild) und 2 Rand-Ankern. Statt aufwendigem Finger-Tiefentracking prüft wristband.js, ob genau ein Feldmarker durch einen aufgelegten Finger verdeckt ist, während mindestens ein Rand-Anker sichtbar bleibt (oder erkennt die Berührung über die Controller-Spitze).",
      en: "On the left forearm the responder wears a matte-printed paper strip with 6 ArUco fields (Yes, No, Back, Patient, Task, Operating picture) and 2 edge anchors. Instead of complex depth finger-tracking, wristband.js checks whether exactly one field marker is occluded by a finger while at least one edge anchor remains visible (or detects touch via the controller tip).",
    },
    specs: {
      de: [
        ["6 Tastenfelder", "Ja · Nein · Zurück · Patient · Tätigkeit · Lagebild (+ 2 Rand-Anker)"],
        ["Entprellung", "≥ 200 ms Haltezeit gegen Streifen, Cooldown + Loslassen vor Wiederholung"],
        ["Gleichwertiger Pfad", "„Ja“ am Band = gesprochenes „ja“ = JA-Knopf (Workflow.handleSpeech)"],
        ["Vorteil im Einsatz", "Funktioniert bei Sirenen-/Hubschrauberlärm und blendet Randknöpfe im HUD aus"],
      ],
      en: [
        ["6 button fields", "Yes · No · Back · Patient · Task · Operating picture (+ 2 edge anchors)"],
        ["Debouncing", "≥ 200 ms hold against brushing, cooldown + release required before repeat"],
        ["Unified action path", "“Yes” on band = spoken “ja” = YES button (Workflow.handleSpeech)"],
        ["Field advantage", "Works under siren/helicopter noise and hides HUD edge buttons"],
      ],
    },
  },
  {
    id: "compute",
    tier: "03 · Compute Unit",
    col: 2,
    x: 480,
    y: 95,
    w: 192,
    h: 118,
    accent: "#8ec7b8",
    badge: "JAR.Core · Whisper / Parakeet",
    title: {
      de: "Client-Side Compute Unit",
      en: "Client-Side Compute Unit",
    },
    sub: {
      de: "On-Device-ASR, VAD & mSTaRT-Logik",
      en: "On-device ASR, VAD & mSTaRT logic",
    },
    detail: {
      de: "Die tragbare Recheneinheit (bzw. JAR.Core auf dem Headset) führt die gesamte Spracherkennung lokal aus – Patiententon verlässt niemals das Gerät. Ein SpeechEndpointer mit Minimum-Statistics-Lärmschätzung (1,25–1,5 s Fenster) schneidet bis zu 30 s lange Äußerungen, berechnet das 80-Kanal-Log-Mel-Spektrogramm und transkribiert über Whisper ONNX (int8) bzw. das feingetunte Parakeet-TDT / CrisperWhisper.",
      en: "The body-worn compute unit (or JAR.Core on the headset) runs all speech recognition locally – patient audio never leaves the device. A SpeechEndpointer with minimum-statistics noise estimation (1.25–1.5 s window) segments utterances up to 30 s, computes the 80-channel log-mel spectrogram and transcribes via Whisper ONNX (int8) or fine-tuned Parakeet-TDT / CrisperWhisper.",
    },
    specs: {
      de: [
        ["Audio-Pipeline", "16 kHz Mono → Minimum-Statistics VAD → 80-Mel-DFT → ONNX int8 Decoder"],
        ["mSTaRT-Sprachbefehle", "„ja“, „nein“, „zurück“, „weiter“ + „HUD ausblenden / einblenden“"],
        ["Medizin-Extraktor", "MedicalHintExtractor erkennt gesprochene QR-/NFC-IDs & Schlüsselwörter"],
        ["Datenschutz-Garantie", "Kein Audio-Upload (PROTOCOL.md §5.1) – nur Textsegmente verlassen das Gerät"],
      ],
      en: [
        ["Audio pipeline", "16 kHz mono → minimum-statistics VAD → 80-mel DFT → ONNX int8 decoder"],
        ["mSTaRT voice commands", "“ja”, “nein”, “zurück”, “weiter” + “HUD ausblenden / einblenden”"],
        ["Medical extractor", "MedicalHintExtractor detects spoken QR/NFC IDs & triage keywords"],
        ["Privacy guarantee", "No audio upload (PROTOCOL.md §5.1) – only text segments leave the device"],
      ],
    },
  },
  {
    id: "spool",
    tier: "03 · Compute Unit",
    col: 2,
    x: 480,
    y: 235,
    w: 192,
    h: 118,
    accent: "#f0b45c",
    badge: "UDP 45454 · 2 GiB Spool",
    title: {
      de: "Offline-Spool & Mesh-Funk",
      en: "Offline Spool & Mesh Radio",
    },
    sub: {
      de: "Unterbrechungsfreie Synchronisation",
      en: "Zero-blocking offline spool & sync",
    },
    detail: {
      de: "Kartierung, Spracherkennung und HUD blockieren niemals auf das Netzwerk. Alle jarmesh/1-Raumchunks (Gzip + SHA-256) und Transkript-Segmente (seg-{device}-{run}-{seq}) landen zuerst in einem crash-sicheren lokalen Spool. Parallel lauscht das Gerät auf UDP-Port 45454 nach Hub-Beacons (alle 2 s) bzw. sendet Probes mit exponentiellem Backoff und entleert den Spool automatisch bei Verbindung.",
      en: "Mapping, speech recognition and the HUD never block on the network. All jarmesh/1 spatial chunks (gzip + SHA-256) and transcript segments (seg-{device}-{run}-{seq}) are written to a crash-safe local spool first. In parallel, the device listens on UDP port 45454 for hub beacons (every 2 s) or sends probes with exponential backoff and drains the spool automatically on connect.",
    },
    specs: {
      de: [
        ["Spool-Kapazität", "2 GiB Mesh-Chunks + 100.000 Sprachsegmente (Sprache wird nie verworfen)"],
        ["Auto-Discovery", "UDP Port 45454: Hub-Beacon (2 s) + Device-Probe mit Nonce & Backoff"],
        ["Telemetrie-Heartbeat", "POST /api/v1/devices/heartbeat alle 5 s (Akku, CPU, RAM, FPS, Spool, ACK)"],
        ["Idempotenz", "(device_id, session_id, frame_id, surface_id, revision) & per-Run-Token"],
      ],
      en: [
        ["Spool capacity", "2 GiB mesh chunks + 100,000 speech segments (speech is never dropped)"],
        ["Auto-discovery", "UDP port 45454: hub beacon (2 s) + device probe with nonce & backoff"],
        ["Telemetry heartbeat", "POST /api/v1/devices/heartbeat every 5 s (battery, CPU, RAM, FPS, spool, ACK)"],
        ["Idempotency", "(device_id, session_id, frame_id, surface_id, revision) & per-run token"],
      ],
    },
  },
  {
    id: "hub",
    tier: "04 · Einsatzleitfahrzeug",
    col: 3,
    x: 706,
    y: 95,
    w: 190,
    h: 118,
    accent: "#5cc08f",
    badge: "Docker · bis 20 Brillen",
    title: {
      de: "Lokaler Hub & Lagebild-Server",
      en: "Local Hub & Command Server",
    },
    sub: {
      de: "FastAPI, Postgres, Redis & Stitcher",
      en: "FastAPI, Postgres, Redis & stitcher",
    },
    detail: {
      de: "Im Einsatzleitfahrzeug (ELW) läuft der containerisierte J.A.R.-Hub komplett unabhängig vom öffentlichen Internet. Er verwaltet bis zu 20 AR-Brillen gleichzeitig, speichert alle Mesh-Revisionen und Transkripte in Postgres, steuert Hintergrund-Jobs über Redis (Trailing-Edge-Debounce ohne Verlust der letzten Sekunden), wertet den analogen Sprechfunk per AUX aus und bedient das Web-Lagebild über /api/v1/ws/ui.",
      en: "Inside the command vehicle (ELW) the containerised J.A.R. hub runs completely independently of the public internet. It manages up to 20 AR headsets simultaneously, stores all mesh revisions and transcripts in Postgres, schedules background jobs via Redis (trailing-edge debounce without losing the tail), monitors analogue radio via AUX and feeds the browser command board over /api/v1/ws/ui.",
    },
    specs: {
      de: [
        ["Container-Stack", "FastAPI + Postgres + Redis + 4-DoF-Stitcher + Web-Dashboard (Port 8080)"],
        ["Flottensteuerung", "Kommandos an Brillen: flush_spool, set_asr_model, set_session, pause_capture"],
        ["3D-Gesamtkarte", "GET /api/v1/sessions/{id}/map/global.glb (Binäres glTF für Three.js)"],
        ["Hybrid-Cloud-Sync", "100 % lokal primär + optionale idempotente Supabase-Outbox bei Netz"],
      ],
      en: [
        ["Container stack", "FastAPI + Postgres + Redis + 4-DoF stitcher + web dashboard (port 8080)"],
        ["Fleet control", "Commands to headsets: flush_spool, set_asr_model, set_session, pause_capture"],
        ["3D global map", "GET /api/v1/sessions/{id}/map/global.glb (binary glTF for Three.js)"],
        ["Hybrid cloud sync", "100 % local primary + optional idempotent Supabase outbox when online"],
      ],
    },
  },
  {
    id: "llm",
    tier: "04 · Einsatzleitfahrzeug",
    col: 3,
    x: 706,
    y: 235,
    w: 190,
    h: 118,
    accent: "#7aa8f8",
    badge: "GBNF · Provenienz-Guard",
    title: {
      de: "Edge-KI & Protokoll-Extraktion",
      en: "Edge AI & Protocol Extraction",
    },
    sub: {
      de: "Encounter-Clustering & Zitat-Beleg",
      en: "Encounter clustering & quote proof",
    },
    detail: {
      de: "Der Hub bündelt Sprachsegmente über alle Headsets hinweg nach Patienten-ID (QR-JAR-1842 / NFC) zu Encountern. Sobald ein Encounter ruht, erzeugt das lokale Sprachmodell (qwen2.5:7b-instruct bzw. LFM2-1.2B per GBNF-Grammatik) einen strukturierten Einsatzbericht. Ein dreifacher Sicherheits-Guard prüft Schema, physiologische Plausibilität (z. B. RR systolisch > diastolisch) und exakte Wort-Zitate (provenance) im Transkript.",
      en: "The hub clusters speech segments across all headsets by patient ID (QR-JAR-1842 / NFC) into encounters. Once an encounter settles, the local language model (qwen2.5:7b-instruct or LFM2-1.2B constrained via GBNF grammar) drafts a structured care protocol. A triple safety guard verifies schema validity, physiological plausibility (e.g. systolic > diastolic BP) and exact verbatim quotes (provenance) in the transcript.",
    },
    specs: {
      de: [
        ["Lokale Modelle", "qwen2.5:7b-instruct (Ollama) / LFM2-1.2B (GBNF) + Rule-Based-Fallback"],
        ["Provenienz-Pflicht", "Jedes Feld braucht ein verifiziertes Wort-Zitat; unbelegte Werte werden null"],
        ["Plausibilitäts-Check", "RR_sys > RR_dia, Vitalwert-Grenzen (Puls, SpO2, GCS), Dosis-Einheiten"],
        ["Ärztliche Freigabe", "Startet immer als review_state: „ungeprueft“ – Mensch bestätigt oder korrigiert"],
      ],
      en: [
        ["Local models", "qwen2.5:7b-instruct (Ollama) / LFM2-1.2B (GBNF) + rule-based fallback"],
        ["Provenance rule", "Every field requires a verified verbatim quote; unbacked values become null"],
        ["Plausibility check", "BP_sys > BP_dia, vital sign ranges (pulse, SpO2, GCS), dose units"],
        ["Human sign-off", "Always starts as review_state: “ungeprueft” – human confirms or corrects"],
      ],
    },
  },
];

// Directed edges between nodes in the architecture diagram
const EDGES = [
  { from: "rfid", to: "scanner", label: { de: "NFC 180 B", en: "NFC 180 B" } },
  { from: "qraruco", to: "scanner", label: { de: "QR / ArUco", en: "QR / ArUco" } },
  { from: "marker3d", to: "glasses", label: { de: "3D-Anker", en: "3D anchor" } },
  { from: "wristband", to: "glasses", label: { de: "6 Felder", en: "6 fields" } },
  { from: "glasses", to: "compute", label: { de: "16 kHz Mic", en: "16 kHz mic" } },
  { from: "scanner", to: "compute", label: { de: "ID + Pose", en: "ID + pose" } },
  { from: "compute", to: "spool", label: { de: "Text + Mesh", en: "Text + mesh" } },
  { from: "spool", to: "hub", label: { de: "REST / UDP", en: "REST / UDP" } },
  { from: "hub", to: "llm", label: { de: "Encounter", en: "Encounter" } },
  { from: "hub", to: "glasses", label: { de: "HUD-Push", en: "HUD push" }, back: true },
];

// 13 anatomical regions of the MakeHuman CC0 body model
const BODY_REGIONS = [
  { id: "head", cx: 110, cy: 36, r: 13, de: "Kopf", en: "Head" },
  { id: "neck", cx: 110, cy: 56, r: 8, de: "Hals", en: "Neck" },
  { id: "chest", cx: 110, cy: 82, r: 16, de: "Brustkorb", en: "Chest" },
  { id: "abdomen", cx: 110, cy: 112, r: 14, de: "Bauch", en: "Abdomen" },
  { id: "pelvis", cx: 110, cy: 138, r: 14, de: "Becken", en: "Pelvis" },
  { id: "uarm_r", cx: 78, cy: 84, r: 10, de: "Oberarm rechts", en: "Right upper arm" },
  { id: "uarm_l", cx: 142, cy: 84, r: 10, de: "Oberarm links", en: "Left upper arm" },
  { id: "farm_r", cx: 64, cy: 116, r: 10, de: "Unterarm rechts", en: "Right forearm" },
  { id: "farm_l", cx: 156, cy: 116, r: 10, de: "Unterarm links", en: "Left forearm" },
  { id: "thigh_r", cx: 95, cy: 174, r: 12, de: "Oberschenkel rechts", en: "Right thigh" },
  { id: "thigh_l", cx: 125, cy: 174, r: 12, de: "Oberschenkel links", en: "Left thigh" },
  { id: "calf_r", cx: 93, cy: 216, r: 11, de: "Unterschenkel rechts", en: "Right lower leg" },
  { id: "calf_l", cx: 127, cy: 216, r: 11, de: "Unterschenkel links", en: "Left lower leg" },
];

const FINDINGS = [
  { id: "bleed", de: "Blutung", en: "Bleeding" },
  { id: "fracture", de: "Fraktur", en: "Fracture" },
  { id: "wound", de: "Wunde", en: "Wound" },
  { id: "burn", de: "Verbrennung", en: "Burn" },
  { id: "contusion", de: "Prellung", en: "Contusion" },
  { id: "amputation", de: "Amputation", en: "Amputation" },
];

const MSTART_STEPS = [
  {
    q: { de: "1/6 · Kritische spritzende Blutung?", en: "1/6 · Critical spurting bleeding?" },
    yes: { cat: "SK I", color: "#f0776e", reason: { de: "Kritische Blutung → Sofortmaßnahme Blutstillung (SK I)", en: "Critical bleed → immediate haemostasis (SK I)" } },
  },
  {
    q: { de: "2/6 · Ist der Patient gehfähig?", en: "2/6 · Is the patient able to walk?" },
    yes: { cat: "SK III", color: "#5cc08f", reason: { de: "Gehfähig ohne kritische Blutung (SK III)", en: "Walking without critical bleeding (SK III)" } },
  },
  {
    q: { de: "3/6 · Spontanatmung vorhanden?", en: "3/6 · Spontaneous breathing present?" },
    no: { cat: "SK I", color: "#f0776e", reason: { de: "Atemwege freimachen → kritischer Atemwegsbefund (SK I)", en: "Clear airway → critical airway finding (SK I)" } },
  },
  {
    q: { de: "4/6 · Atemfrequenz unter 10 oder über 30/min?", en: "4/6 · Respiratory rate below 10 or above 30/min?" },
    yes: { cat: "SK I", color: "#f0776e", reason: { de: "Atemfrequenz kritisch verändert (SK I)", en: "Respiratory rate critically abnormal (SK I)" } },
  },
  {
    q: { de: "5/6 · Radialispuls gut tastbar?", en: "5/6 · Radial pulse palpable?" },
    no: { cat: "SK I", color: "#f0776e", reason: { de: "Kein Radialispuls tastbar → Kreislaufkritisch (SK I)", en: "Absent radial pulse → critical circulation (SK I)" } },
  },
  {
    q: { de: "6/6 · Befolgt einfache Aufforderungen?", en: "6/6 · Follows simple commands?" },
    yes: { cat: "SK II", color: "#f0b45c", reason: { de: "Nicht gehfähig, Vitalfunktionen stabil, orientiert (SK II)", en: "Non-ambulatory, vitals stable, oriented (SK II)" } },
    no: { cat: "SK I", color: "#f0776e", reason: { de: "Bewusstseinsstörung / befolgt keine Aufforderungen (SK I)", en: "Altered consciousness / does not follow commands (SK I)" } },
  },
];

const COPY = {
  de: {
    eyebrow: "Interaktive Systemvisualisierung · J.A.R. AR-Architektur",
    tabArch: "01 · Systemarchitektur & Datenfluss",
    tabVisor: "02 · Interaktiver AR-Visier-, RFID- & Körpermodell-Simulator",
    archHint: "Klicken Sie auf einen Baustein im Diagramm, um Protokoll-Details, Hardware-Parameter und Datenpfade zu inspizieren.",
    tier1: "01 · PATIENT",
    tier2: "02 · AR-BRILLE & HELM",
    tier3: "03 · COMPUTE UNIT",
    tier4: "04 · EINSATZLEITFAHRZEUG",
    specsTitle: "Technische Spezifikation & Protokoll",
    visorHint: "Simulieren Sie das Blickfeld der Einsatzkraft: Scannen Sie das RFID-/NFC-Pflaster oder die QR-Karte, beantworten Sie mSTaRT per Armband/Sprache und markieren Sie Verletzungen am 13-Regionen-Körpermodell.",
    opticLabel: "Optik / Brille:",
    opticPico: "PICO 4 / Quest (Passthrough 100°×95°)",
    opticHl2: "HoloLens 2 (Additiv 43°×29°)",
    findingLabel: "Befund für Körperregion:",
    btnRfid: "RFID-/NFC-Pflaster scannen (180 B)",
    btnQr: "QR-/ArUco-Karte scannen (JAR-P07)",
    btnYes: "Armband / Sprache: „JA“",
    btnNo: "Armband / Sprache: „NEIN“",
    btnReset: "Patient zurücksetzen",
    logTitle: "Live-Systembus (Brille → Compute Unit → Hub)",
    bodyHint: "13-Regionen-Modell (Region anklicken):",
    noInjuries: "Keine Verletzungsregion markiert",
    tagUnassigned: "Noch kein RFID/QR-Tag gescannt",
  },
  en: {
    eyebrow: "Interactive System Visualisation · J.A.R. AR Architecture",
    tabArch: "01 · System Architecture & Data Flow",
    tabVisor: "02 · Interactive AR Visor, RFID & Body Model Simulator",
    archHint: "Click any component in the diagram to inspect protocol details, hardware parameters and active data paths.",
    tier1: "01 · PATIENT",
    tier2: "02 · AR GLASSES & HELMET",
    tier3: "03 · COMPUTE UNIT",
    tier4: "04 · COMMAND VEHICLE",
    specsTitle: "Technical Specification & Wire Protocol",
    visorHint: "Simulate the responder's field of view: scan the RFID/NFC plaster or QR tag, answer mSTaRT via wristband/voice, and mark injuries on the 13-region body model.",
    opticLabel: "Optics / Headset:",
    opticPico: "PICO 4 / Quest (Passthrough 100°×95°)",
    opticHl2: "HoloLens 2 (Additive 43°×29°)",
    findingLabel: "Finding for body region:",
    btnRfid: "Scan RFID/NFC plaster (180 B)",
    btnQr: "Scan QR/ArUco tag (JAR-P07)",
    btnYes: "Wristband / Voice: “YES”",
    btnNo: "Wristband / Voice: “NO”",
    btnReset: "Reset patient",
    logTitle: "Live System Bus (Glasses → Compute Unit → Hub)",
    bodyHint: "13-region model (click region):",
    noInjuries: "No injury region marked",
    tagUnassigned: "No RFID/QR tag scanned yet",
  },
};

export function renderArSystemVisual(block = {}, lang = "de") {
  const L = COPY[lang === "en" ? "en" : "de"];
  const pick = (v) => (v && typeof v === "object" ? v[lang] ?? v.de ?? "" : String(v ?? ""));

  let activeTab = block.mode === "visor" ? "visor" : "architecture";
  let selectedNodeId = "rfid";

  // Simulator state
  const sim = {
    optic: "pico",
    tagId: "NFC-A7 · JAR-P07 (180 B)",
    rfidScanned: true,
    stepIdx: 3,
    cat: "SK II",
    catColor: "#f0b45c",
    reason: {
      de: "Nicht gehfähig, Vitalfunktionen stabil, befolgt Aufforderungen (SK II)",
      en: "Non-ambulatory, vitals stable, follows commands (SK II)",
    },
    activeFinding: "fracture",
    injuries: new Map([
      ["farm_r", "wound"],
      ["thigh_l", "fracture"],
    ]),
    logs: [
      {
        time: "14:07:02",
        stage: "RFID/NFC",
        text: {
          de: "Pflaster-Tag gelesen: UUID #A7-180B → Patientenakte geöffnet (raumfester Anker gesetzt)",
          en: "Plaster tag read: UUID #A7-180B → patient record opened (world-locked anchor set)",
        },
      },
      {
        time: "14:07:09",
        stage: "13-Regionen",
        text: {
          de: "Körpermodell: Wunde (Unterarm rechts) + Fraktur (Oberschenkel links) lokalisiert",
          en: "Body model: Wound (Right forearm) + Fracture (Left thigh) localised",
        },
      },
      {
        time: "14:07:18",
        stage: "Compute→Hub",
        text: {
          de: "POST /api/v1/transcripts/segments · SK II · Spool: 0 ausstehend · UDP 45454 ACK",
          en: "POST /api/v1/transcripts/segments · SK II · Spool: 0 pending · UDP 45454 ACK",
        },
      },
    ],
  };

  const tabArchBtn = el("button", {
    class: "vis-tab",
    type: "button",
    onclick: () => switchTab("architecture"),
  }, L.tabArch);

  const tabVisorBtn = el("button", {
    class: "vis-tab",
    type: "button",
    onclick: () => switchTab("visor"),
  }, L.tabVisor);

  const bodyContainer = el("div", { class: "vis-body" });

  const root = el("section", { class: "vis-card", "aria-label": L.eyebrow },
    el("div", { class: "vis-head" },
      el("span", { class: "eyebrow" }, L.eyebrow),
      el("div", { class: "vis-tabs", role: "tablist" }, tabArchBtn, tabVisorBtn),
    ),
    bodyContainer,
  );

  function switchTab(next) {
    activeTab = next;
    tabArchBtn.classList.toggle("is-active", activeTab === "architecture");
    tabVisorBtn.classList.toggle("is-active", activeTab === "visor");
    tabArchBtn.setAttribute("aria-selected", activeTab === "architecture" ? "true" : "false");
    tabVisorBtn.setAttribute("aria-selected", activeTab === "visor" ? "true" : "false");
    if (activeTab === "architecture") renderArchitectureTab();
    else renderVisorTab();
  }

  // ── TAB 1: ARCHITECTURE DIAGRAM ───────────────────────────────────────────
  function renderArchitectureTab() {
    const svg = svgEl("svg", {
      viewBox: "0 0 920 396",
      class: "vis-svg",
      role: "img",
      "aria-label": L.eyebrow,
    });

    // Background tier columns
    const tiers = [
      { x: 12, w: 216, label: L.tier1 },
      { x: 240, w: 216, label: L.tier2 },
      { x: 468, w: 216, label: L.tier3 },
      { x: 694, w: 214, label: L.tier4 },
    ];
    for (const tier of tiers) {
      svg.append(
        svgEl("rect", {
          x: tier.x,
          y: 14,
          width: tier.w,
          height: 368,
          rx: 10,
          fill: "rgba(21, 20, 46, 0.72)",
          stroke: "rgba(255, 255, 255, 0.10)",
        }),
        svgEl("text", {
          x: tier.x + tier.w / 2,
          y: 38,
          "text-anchor": "middle",
          fill: "#8ec7b8",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "10.5",
          "letter-spacing": "1.4",
        }, tier.label),
      );
    }

    const byId = new Map(NODES.map((n) => [n.id, n]));

    // Draw edges
    const edgesGroup = svgEl("g", {});
    for (const edge of EDGES) {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) continue;
      const isActive = selectedNodeId === edge.from || selectedNodeId === edge.to;
      let d;
      let lx;
      let ly;
      if (edge.back) {
        // Feedback loop along the bottom from Hub back to AR Glasses
        const x1 = a.x + a.w / 2;
        const y1 = a.y + a.h;
        const x2 = b.x + b.w / 2;
        const y2 = b.y + b.h;
        d = `M ${x1} ${y1} C ${x1} 388, ${x2} 388, ${x2} ${y2}`;
        lx = (x1 + x2) / 2;
        ly = 376;
      } else if (a.col === b.col) {
        const x1 = a.x + a.w / 2;
        const y1 = a.y + a.h;
        const x2 = b.x + b.w / 2;
        const y2 = b.y;
        d = `M ${x1} ${y1} L ${x2} ${y2}`;
        lx = x1 + 34;
        ly = (y1 + y2) / 2 + 4;
      } else {
        const x1 = a.x + a.w;
        const y1 = a.y + a.h / 2;
        const x2 = b.x;
        const y2 = b.y + b.h / 2;
        const mx = (x1 + x2) / 2;
        d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
        lx = mx;
        ly = (y1 + y2) / 2 - 6;
      }
      edgesGroup.append(
        svgEl("path", {
          d,
          fill: "none",
          stroke: isActive ? "#8ec7b8" : "rgba(255, 255, 255, 0.22)",
          "stroke-width": isActive ? "2.4" : "1.4",
          "stroke-dasharray": edge.back ? "5 4" : isActive ? "6 3" : null,
          class: isActive ? "vis-edge-active" : "",
        }),
        svgEl("text", {
          x: lx,
          y: ly,
          "text-anchor": "middle",
          fill: isActive ? "#f4f5fa" : "#868ca4",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "9",
        }, pick(edge.label)),
      );
    }
    svg.append(edgesGroup);

    // Draw nodes
    for (const node of NODES) {
      const selected = node.id === selectedNodeId;
      const g = svgEl("g", {
        class: "vis-svg-node" + (selected ? " is-selected" : ""),
        tabindex: "0",
        role: "button",
        "aria-label": pick(node.title),
      });
      g.addEventListener("click", () => {
        selectedNodeId = node.id;
        renderArchitectureTab();
      });
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectedNodeId = node.id;
          renderArchitectureTab();
        }
      });

      g.append(
        svgEl("rect", {
          x: node.x,
          y: node.y,
          width: node.w,
          height: node.h,
          rx: 8,
          fill: selected ? "rgba(28, 27, 59, 0.98)" : "rgba(12, 11, 31, 0.92)",
          stroke: selected ? node.accent : "rgba(255, 255, 255, 0.18)",
          "stroke-width": selected ? "2.2" : "1",
        }),
        svgEl("rect", {
          x: node.x,
          y: node.y,
          width: 4,
          height: node.h,
          rx: 2,
          fill: node.accent,
        }),
        svgEl("text", {
          x: node.x + 12,
          y: node.y + 22,
          fill: node.accent,
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "9",
          "font-weight": "600",
        }, node.badge),
        svgEl("text", {
          x: node.x + 12,
          y: node.y + 44,
          fill: "#f4f5fa",
          "font-family": "Inter, -apple-system, sans-serif",
          "font-size": "10.8",
          "font-weight": "600",
          textLength: pick(node.title).length > 25 ? String(node.w - 24) : null,
          lengthAdjust: pick(node.title).length > 25 ? "spacingAndGlyphs" : null,
        }, pick(node.title)),
        svgEl("text", {
          x: node.x + 12,
          y: node.y + 63,
          fill: "#a9afc4",
          "font-family": "Inter, -apple-system, sans-serif",
          "font-size": "9.8",
        }, pick(node.sub)),
      );
      svg.append(g);
    }

    const activeNode = byId.get(selectedNodeId) || NODES[0];

    const pillBar = el("div", { class: "vis-pills" },
      NODES.map((n) => el("button", {
        type: "button",
        class: "vis-pill" + (n.id === activeNode.id ? " is-active" : ""),
        onclick: () => {
          selectedNodeId = n.id;
          renderArchitectureTab();
        },
      }, pick(n.title))),
    );

    const inspector = el("div", { class: "vis-inspector", style: `box-shadow: inset 3px 0 0 ${activeNode.accent}, inset 0 0 0 1px var(--line)` },
      el("div", { class: "vis-inspector-head" },
        el("div", {},
          el("span", { class: "vis-badge", style: `color:${activeNode.accent}` }, `${activeNode.tier} · ${activeNode.badge}`),
          el("h4", { class: "vis-inspector-title" }, pick(activeNode.title)),
        ),
      ),
      el("p", { class: "vis-inspector-desc" }, pick(activeNode.detail)),
      el("div", { class: "vis-specs-grid" },
        (activeNode.specs[lang] || activeNode.specs.de).map(([k, v]) =>
          el("div", { class: "vis-spec-item" },
            el("span", { class: "vis-spec-label" }, k),
            el("span", { class: "vis-spec-val" }, v),
          )),
      ),
    );

    replace(bodyContainer,
      el("p", { class: "vis-hint" }, L.archHint),
      el("div", { class: "vis-svg-wrap" }, svg),
      pillBar,
      inspector,
    );
  }

  // ── TAB 2: INTERACTIVE AR VISOR + RFID + 13-REGION BODY SIMULATOR ─────────
  function pushLog(stage, deText, enText) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    sim.logs.unshift({
      time: `${hh}:${mm}:${ss}`,
      stage,
      text: { de: deText, en: enText },
    });
    if (sim.logs.length > 5) sim.logs.pop();
  }

  function renderVisorTab() {
    const isAdditive = sim.optic === "hl2";
    const step = MSTART_STEPS[sim.stepIdx % MSTART_STEPS.length];

    // Left: Simulated AR HUD Visor SVG
    const visorSvg = svgEl("svg", {
      viewBox: "0 0 560 360",
      class: "vis-svg vis-visor-svg",
      role: "img",
      "aria-label": "AR HUD Visor Simulation",
    });

    // Background (Passthrough vs. HoloLens 2 Additive waveguide)
    visorSvg.append(
      svgEl("rect", {
        x: 0,
        y: 0,
        width: 560,
        height: 360,
        rx: 12,
        fill: isAdditive ? "#060814" : "#101428",
        stroke: isAdditive ? "#8ec7b8" : "rgba(255,255,255,0.22)",
        "stroke-width": isAdditive ? "2" : "1",
      }),
    );

    // Subtle spatial mapping wireframe mesh lines on the floor/walls
    for (let i = 0; i <= 8; i++) {
      const x = 40 + i * 60;
      visorSvg.append(
        svgEl("line", {
          x1: 280 + (x - 280) * 0.45,
          y1: 205,
          x2: x,
          y2: 345,
          stroke: "rgba(142, 199, 184, 0.11)",
          "stroke-width": "1",
        }),
      );
    }
    for (let y of [225, 255, 290, 330]) {
      visorSvg.append(
        svgEl("line", {
          x1: 30,
          y1: y,
          x2: 530,
          y2: y,
          stroke: "rgba(142, 199, 184, 0.10)",
          "stroke-width": "1",
        }),
      );
    }

    // HoloLens 2 43°x29° FoV safety frame indicator
    if (isAdditive) {
      visorSvg.append(
        svgEl("rect", {
          x: 24,
          y: 18,
          width: 512,
          height: 324,
          rx: 6,
          fill: "none",
          stroke: "rgba(142, 199, 184, 0.45)",
          "stroke-dasharray": "6 4",
        }),
        svgEl("text", {
          x: 280,
          y: 336,
          "text-anchor": "middle",
          fill: "#8ec7b8",
          "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
          "font-size": "9.5",
        }, "fitToFov: HoloLens 2 Additiv (43°×29°) · Schwarz = Transparent"),
      );
    }

    // Top-left HUD corner: Active task + telemetry
    visorSvg.append(
      svgEl("rect", {
        x: 34,
        y: 26,
        width: 215,
        height: 54,
        rx: 6,
        fill: isAdditive ? "none" : "rgba(12, 11, 31, 0.85)",
        stroke: "#8ec7b8",
        "stroke-width": isAdditive ? "1.6" : "1",
      }),
      svgEl("text", {
        x: 44,
        y: 44,
        fill: "#8ec7b8",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "10",
        "font-weight": "700",
      }, lang === "en" ? "ROLE: PRE-TRIAGE (mSTaRT)" : "TÄTIGKEIT: VORSICHTUNG"),
      svgEl("text", {
        x: 44,
        y: 60,
        fill: "#f4f5fa",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "9.5",
      }, "UDP 45454 ✓ · Spool: 0 · 60 FPS"),
      svgEl("text", {
        x: 44,
        y: 73,
        fill: "#a9afc4",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "9",
      }, "ASR: Whisper-int8 (lokal)"),
    );

    // Top-right HUD corner: Mini-Lagekarte (Grid B4)
    visorSvg.append(
      svgEl("rect", {
        x: 416,
        y: 26,
        width: 110,
        height: 68,
        rx: 6,
        fill: isAdditive ? "none" : "rgba(12, 11, 31, 0.85)",
        stroke: "rgba(255,255,255,0.28)",
      }),
      svgEl("text", {
        x: 426,
        y: 42,
        fill: "#8ec7b8",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "9.5",
        "font-weight": "600",
      }, "LAGEKARTE · B4"),
      svgEl("circle", { cx: 444, cy: 62, r: 5, fill: "#f0776e" }),
      svgEl("circle", { cx: 472, cy: 56, r: 5, fill: "#5cc08f" }),
      svgEl("circle", { cx: 492, cy: 72, r: 6, fill: sim.catColor, stroke: "#fff", "stroke-width": "1.5" }),
      svgEl("text", {
        x: 426,
        y: 86,
        fill: "#a9afc4",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "8.5",
      }, "3 Pat. · Distanz 2,1 m"),
    );

    // Ground ring marker (world-locked at patient position on local-floor)
    visorSvg.append(
      svgEl("ellipse", {
        cx: 270,
        cy: 298,
        rx: 96,
        ry: 24,
        fill: "none",
        stroke: sim.catColor,
        "stroke-width": "3",
        "stroke-dasharray": sim.rfidScanned ? null : "8 5",
      }),
      svgEl("ellipse", {
        cx: 270,
        cy: 298,
        rx: 74,
        ry: 16,
        fill: "rgba(142, 199, 184, 0.08)",
        stroke: "rgba(255,255,255,0.2)",
        "stroke-width": "1",
      }),
      svgEl("text", {
        x: 270,
        y: 302,
        "text-anchor": "middle",
        fill: "#f4f5fa",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "10",
        "font-weight": "600",
      }, sim.rfidScanned ? sim.tagId : L.tagUnassigned),
    );

    // World-locked Patient Action Card floating above the ground ring
    visorSvg.append(
      svgEl("rect", {
        x: 145,
        y: 102,
        width: 250,
        height: 158,
        rx: 8,
        fill: isAdditive ? "rgba(12, 11, 31, 0.45)" : "rgba(18, 17, 44, 0.94)",
        stroke: sim.catColor,
        "stroke-width": "2",
      }),
      svgEl("rect", {
        x: 157,
        y: 114,
        width: 64,
        height: 22,
        rx: 4,
        fill: sim.catColor,
      }),
      svgEl("text", {
        x: 189,
        y: 129,
        "text-anchor": "middle",
        fill: "#0c0b1f",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "11",
        "font-weight": "700",
      }, sim.cat),
      svgEl("text", {
        x: 230,
        y: 129,
        fill: "#f4f5fa",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "10.5",
        "font-weight": "600",
      }, sim.rfidScanned ? "NFC #A7 · JAR-P07" : "UNGESCANNT"),
      svgEl("text", {
        x: 157,
        y: 156,
        fill: "#8ec7b8",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "9.5",
      }, "mSTaRT-Fragebogen (Sprache / Armband):"),
      svgEl("text", {
        x: 157,
        y: 175,
        fill: "#f4f5fa",
        "font-family": "Inter, -apple-system, sans-serif",
        "font-size": "11.5",
        "font-weight": "600",
      }, pick(step.q)),
      svgEl("text", {
        x: 157,
        y: 202,
        fill: "#a9afc4",
        "font-family": "Inter, -apple-system, sans-serif",
        "font-size": "10",
      }, pick(sim.reason).slice(0, 44)),
      svgEl("text", {
        x: 157,
        y: 224,
        fill: "#f0b45c",
        "font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
        "font-size": "9.5",
      }, `Befunde am Körpermodell: ${sim.injuries.size}`),
      // Gaze crosshair in center of card
      svgEl("circle", {
        cx: 270,
        cy: 244,
        r: 4,
        fill: "none",
        stroke: "#8ec7b8",
        "stroke-width": "1.5",
      }),
    );

    // Right: Interactive 13-Region Body Model SVG
    const bodySvg = svgEl("svg", {
      viewBox: "0 0 220 260",
      class: "vis-body-svg",
      role: "img",
      "aria-label": "13-Regionen-Körpermodell",
    });

    // Silhouette lines connecting joints
    const skeletonLines = [
      [110, 36, 110, 138], // spine
      [78, 76, 142, 76],   // shoulders
      [78, 76, 64, 122],   // right arm
      [142, 76, 156, 122], // left arm
      [95, 142, 125, 142], // hips
      [95, 142, 93, 228],  // right leg
      [125, 142, 127, 228], // left leg
    ];
    for (const [x1, y1, x2, y2] of skeletonLines) {
      bodySvg.append(svgEl("line", {
        x1, y1, x2, y2,
        stroke: "rgba(255, 255, 255, 0.22)",
        "stroke-width": "8",
        "stroke-linecap": "round",
      }));
    }

    for (const reg of BODY_REGIONS) {
      const hasFinding = sim.injuries.get(reg.id);
      const circle = svgEl("circle", {
        cx: reg.cx,
        cy: reg.cy,
        r: reg.r,
        fill: hasFinding ? "#f0776e" : "rgba(142, 199, 184, 0.22)",
        stroke: hasFinding ? "#ffffff" : "#8ec7b8",
        "stroke-width": hasFinding ? "2" : "1.3",
        class: "vis-body-region",
      });
      circle.addEventListener("click", () => {
        if (sim.injuries.has(reg.id)) {
          sim.injuries.delete(reg.id);
          pushLog(
            "13-Regionen",
            `Befund an Region „${reg.de}“ entfernt`,
            `Finding removed from region “${reg.en}”`,
          );
        } else {
          sim.injuries.set(reg.id, sim.activeFinding);
          const fObj = FINDINGS.find((f) => f.id === sim.activeFinding) || FINDINGS[0];
          pushLog(
            "13-Regionen",
            `Befund gesetzt: ${fObj.de}, ${reg.de} → an Patientenmarker verankert`,
            `Finding set: ${fObj.en}, ${reg.en} → anchored to patient marker`,
          );
        }
        renderVisorTab();
      });
      bodySvg.append(circle);
    }

    // List of active injuries
    const injuryBadges = [...sim.injuries.entries()].map(([regId, fId]) => {
      const reg = BODY_REGIONS.find((r) => r.id === regId);
      const f = FINDINGS.find((x) => x.id === fId);
      if (!reg || !f) return null;
      return el("span", { class: "chip chip-declined" }, `${pick(f)}: ${pick(reg)}`);
    }).filter(Boolean);

    // Controls
    const opticSelect = el("select", {
      class: "vis-select",
      "aria-label": L.opticLabel,
      onchange: (e) => {
        sim.optic = e.target.value;
        pushLog(
          "Display.js",
          sim.optic === "hl2"
            ? "Optik gewechselt: HoloLens 2 (additiv, 43°×29°, schwarze Flächen ausgeblendet)"
            : "Optik gewechselt: PICO 4 Enterprise / Quest (alpha-blend Passthrough)",
          sim.optic === "hl2"
            ? "Optics switched: HoloLens 2 (additive, 43°×29°, black surfaces transparent)"
            : "Optics switched: PICO 4 Enterprise / Quest (alpha-blend passthrough)",
        );
        renderVisorTab();
      },
    },
    el("option", { value: "pico", selected: sim.optic === "pico" }, L.opticPico),
    el("option", { value: "hl2", selected: sim.optic === "hl2" }, L.opticHl2));

    const findingSelect = el("select", {
      class: "vis-select",
      "aria-label": L.findingLabel,
      onchange: (e) => { sim.activeFinding = e.target.value; },
    },
    FINDINGS.map((f) => el("option", { value: f.id, selected: sim.activeFinding === f.id }, pick(f))));

    const answerStep = (ans) => {
      const cur = MSTART_STEPS[sim.stepIdx % MSTART_STEPS.length];
      const outcome = cur[ans];
      if (outcome) {
        sim.cat = outcome.cat;
        sim.catColor = outcome.color;
        sim.reason = outcome.reason;
      }
      sim.stepIdx = (sim.stepIdx + 1) % MSTART_STEPS.length;
      pushLog(
        "mSTaRT / Armband",
        `Eingabe „${ans === "yes" ? "JA" : "NEIN"}“ (ArUco-Armband / Sprache) → Vorschlag ${sim.cat}`,
        `Input “${ans === "yes" ? "YES" : "NO"}” (ArUco wristband / voice) → suggested ${sim.cat}`,
      );
      renderVisorTab();
    };

    const actionButtons = el("div", { class: "vis-actions" },
      el("button", {
        type: "button",
        class: "btn btn-primary btn-small",
        onclick: () => {
          sim.rfidScanned = true;
          sim.tagId = "NFC-A7 · 180 Byte EEPROM";
          pushLog(
            "RFID/NFC-Scanner",
            "Pflaster-Tag #A7-180B kontaktlos gelesen (180 Byte) → Akte & 3D-Anker synchronisiert",
            "Plaster tag #A7-180B read contactlessly (180 bytes) → record & 3D anchor synced",
          );
          renderVisorTab();
        },
      }, L.btnRfid),
      el("button", {
        type: "button",
        class: "btn btn-outline btn-small",
        onclick: () => {
          sim.rfidScanned = true;
          sim.tagId = "QR: JAR-P07 · ArUco #07";
          pushLog(
            "OpenVSTCamera / QR",
            "Umhängekarte JAR-P07 optisch gescannt + ArUco-Anker an Hub gemeldet (/api/v1/mesh/anchors)",
            "Hanging tag JAR-P07 optically scanned + ArUco anchor sent to hub (/api/v1/mesh/anchors)",
          );
          renderVisorTab();
        },
      }, L.btnQr),
      el("button", {
        type: "button",
        class: "btn btn-outline btn-small",
        onclick: () => answerStep("yes"),
      }, L.btnYes),
      el("button", {
        type: "button",
        class: "btn btn-outline btn-small",
        onclick: () => answerStep("no"),
      }, L.btnNo),
    );

    const logList = el("div", { class: "vis-log" },
      el("div", { class: "vis-log-head" }, L.logTitle),
      sim.logs.map((entry) =>
        el("div", { class: "vis-log-row" },
          el("span", { class: "vis-log-time" }, entry.time),
          el("span", { class: "vis-log-stage" }, entry.stage),
          el("span", { class: "vis-log-text" }, pick(entry.text)),
        )),
    );

    replace(bodyContainer,
      el("p", { class: "vis-hint" }, L.visorHint),
      el("div", { class: "vis-controls-row" },
        el("label", { class: "vis-field" }, el("span", {}, L.opticLabel), opticSelect),
        el("label", { class: "vis-field" }, el("span", {}, L.findingLabel), findingSelect),
      ),
      actionButtons,
      el("div", { class: "vis-visor-grid" },
        el("div", { class: "vis-visor-pane" }, visorSvg),
        el("div", { class: "vis-body-pane" },
          el("p", { class: "vis-body-caption" }, L.bodyHint),
          bodySvg,
          el("div", { class: "vis-injury-chips" },
            injuryBadges.length ? injuryBadges : el("span", { class: "muted" }, L.noInjuries),
          ),
        ),
      ),
      logList,
    );
  }

  switchTab(activeTab);
  return root;
}
