// Test 2: "ASR-Pipeline & Protokoll-Extraktion" (DE + EN)
export default {
  id: "asr-sichtungs-demo",
  version: 1,
  section: "test",
  icon: "waveform",
  title: {
    de: "ASR-Pipeline & Protokoll-Extraktion",
    en: "ASR Pipeline & Protocol Extraction",
  },
  subtitle: {
    de: "Vom gesprochenen Sichtungsstrom zum GBNF-JSON-Bericht",
    en: "From spoken triage stream to GBNF JSON report",
  },
  summary: {
    de: "Erproben Sie die mehrstufige ASR-Sichtungspipeline: vom QR-/Sprach-Trigger über Silence-Trimming und Relevanzfilter bis zur GBNF-konformen Extraktion in die strukturierte Patientenkarte.",
    en: "Test the multi-stage ASR triage pipeline: from QR/voice trigger through silence trimming and relevance filtering to GBNF-constrained extraction into the structured patient card.",
  },
  audience: {
    de: "Für Partner, Einsatzkräfte und Entwickler, die den Weg von der Spracheingabe zum strukturierten Patientenprotokoll testen möchten.",
    en: "For partners, responders and developers who want to test the path from voice input to a structured patient protocol.",
  },
  minutes: 10,
  lessons: [
    {
      id: "asr-workflow-testen",
      title: {
        de: "Die 7-stufige ASR-Pipeline ausprobieren",
        en: "Testing the 7-stage ASR pipeline",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Während die **JAR Transcription Demo** Ihre eigene Stimme live mit WhisperX transkribiert und Sprecher trennt, zeigt die **ASR-Sichtungs-Demo** den gesamten nachgelagerten Datenfluss vom Auslöser am Patienten bis zum fertigen Lagebild-Eintrag.",
            en: "While the **JAR Transcription Demo** transcribes your own voice live with WhisperX and separates speakers, the **ASR Triage Demo** demonstrates the full downstream workflow from the patient trigger to the finished operating-picture record.",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Trigger auslösen:** Starten Sie die Aufnahme in der Demo per simuliertem QR-Scan (`QR-JAR-1842`) oder per Schlüsselwort **„Vorsichtung“**.",
              "**Pipeline-Durchlauf beobachten:** Verfolgen Sie die sieben Knoten: `QR / Aufnahme` → `Silence trim` → `Relevanzfilter` → `Voice-Modell` → `Kontext` → `GBNF-Extraktion` → `Lagebild`.",
              "**Strukturierten Patientenbericht prüfen:** Vergleichen Sie die extrahierten Tabellenfelder (SK, Vitalwerte, Verletzungen, Maßnahmen, Medikamente, Standort-Quadrant) mit der rohen GBNF-JSON-Ausgabe.",
            ],
            en: [
              "**Trigger capture:** start recording in the demo via simulated QR scan (`QR-JAR-1842`) or the keyword **“Vorsichtung”**.",
              "**Watch the pipeline run:** follow all seven stages: `QR / Capture` → `Silence trim` → `Relevance filter` → `Voice model` → `Context` → `GBNF extraction` → `Operating picture`.",
              "**Inspect the structured patient report:** compare the extracted table fields (triage category, vitals, injuries, measures, medications, grid quadrant) with the raw GBNF JSON output.",
            ],
          },
        },
        {
          type: "link",
          href: "../demo/asr/",
          label: {
            de: "Interaktive ASR-Sichtungs-Demo öffnen →",
            en: "Open interactive ASR Triage Demo →",
          },
        },
      ],
    },
    {
      id: "schema-felder-pruefen",
      title: {
        de: "Extrahierte Zielfelder im Patientenbericht",
        en: "Extracted target fields in the patient report",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Das GBNF-Schema stellt sicher, dass das lokale Sprachmodell nur valide Felder für das Lagebild erzeugt:",
            en: "The GBNF schema ensures that the local language model outputs only valid fields for the operating picture:",
          },
        },
        {
          type: "table",
          head: {
            de: ["Zielfeld", "Beispielwert aus der Pipeline"],
            en: ["Target field", "Sample value from the pipeline"],
          },
          rows: {
            de: [
              ["Sichtungskategorie (SK)", "SK II — dringend"],
              ["Vitalwerte", "AF 24/min · Puls 112/min · SpO2 94 % · RR 96/62 mmHg · GCS 14"],
              ["Verletzungen", "offene Unterarmverletzung rechts · starke Schmerzen Oberschenkel links"],
              ["Maßnahmen & Medikamente", "Druckverband, Wärmeerhalt, Vakuummatratze · Fentanyl 0,05 mg i.v."],
              ["Standort / Patientenablage", "Raster B4 · GPS + OSM-Objektfinder"],
            ],
            en: [
              ["Triage category (SK)", "SK II — urgent"],
              ["Vital signs", "RR 24/min · Pulse 112/min · SpO2 94 % · BP 96/62 mmHg · GCS 14"],
              ["Injuries", "open right forearm injury · severe pain in left thigh"],
              ["Measures & medications", "pressure dressing, warming, vacuum mattress · Fentanyl 0.05 mg IV"],
              ["Location / collection point", "Grid B4 · GPS + OSM object finder"],
            ],
          },
        },
      ],
    },
  ],
};
