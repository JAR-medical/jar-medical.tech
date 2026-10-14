// Understand 3: "Datenschutz, Offline-Betrieb & Einsatzgrenzen" (DE + EN)
export default {
  id: "datenschutz-sicherheit",
  version: 1,
  section: "understand",
  icon: "shield",
  title: {
    de: "Datenschutz, Offline-Betrieb & Grenzen",
    en: "Privacy, Offline Operation & Limits",
  },
  subtitle: {
    de: "Lokale Verarbeitung, Rückfallebenen und rechtlicher Rahmen",
    en: "On-device processing, fallbacks and regulatory framework",
  },
  summary: {
    de: "Erfahren Sie, wie J.A.R. besondere Kategorien personenbezogener Gesundheitsdaten schützt, warum alle Modelle ohne Cloud vor Ort laufen, welche Rückfallebenen bei Geräteausfall greifen und wie der Forschungsprototyp rechtlich eingeordnet ist.",
    en: "Learn how J.A.R. protects sensitive health data, why all models run on site without cloud dependencies, which fallbacks apply if hardware fails, and how the research prototype is classified legally.",
  },
  audience: {
    de: "Für Datenschutzbeauftragte, Einsatzleitungen, Ärztliche Leiter Rettungsdienst und Verantwortliche in Partnerorganisationen.",
    en: "For data protection officers, incident commanders, medical directors and leadership in partner organisations.",
  },
  minutes: 12,
  lessons: [
    {
      id: "lokale-verarbeitung-und-fallbacks",
      title: {
        de: "Edge statt Cloud & technische Rückfallebenen",
        en: "Edge instead of cloud & technical fallbacks",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Gesundheitsdaten und Aufnahmen vom Einsatzort gehören nicht in eine fremde Cloud – und bei Großschadenslagen ist das Mobilfunknetz oft überlastet oder ausgefallen. J.A.R. verarbeitet Sprache deshalb grundsätzlich lokal.",
            en: "Health data and audio from an incident scene do not belong in a third-party cloud – and in major incidents mobile networks are often overloaded or down. J.A.R. therefore processes speech locally by design.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Keine Cloud-Übertragung von Patiententon:** Transkription, Alignment, Diarisierung und Extraktion laufen auf der lokalen Recheneinheit bzw. dem Server im Einsatzleitfahrzeug.",
              "**Telemetrie abgeschaltet:** In unserer WhisperX-/pyannote-Konfiguration ist jegliche Nutzungstelemetrie standardmäßig deaktiviert (`PYANNOTE_METRICS_ENABLED=false`).",
              "**Offline-Pufferung:** Reißt die lokale WLAN-/Mesh-Verbindung zum Leitfahrzeug ab, dokumentiert das Gerät weiter und synchronisiert automatisch, sobald die Verbindung wieder steht.",
            ],
            en: [
              "**No cloud upload of patient audio:** transcription, alignment, diarization and extraction run on the local compute unit or the command vehicle server.",
              "**Telemetry disabled:** in our WhisperX/pyannote setup, usage telemetry is disabled by default (`PYANNOTE_METRICS_ENABLED=false`).",
              "**Offline spooling:** if the local Wi-Fi/mesh link to the command vehicle drops, the device keeps recording and syncs automatically once reconnected.",
            ],
          },
        },
      ],
    },
    {
      id: "rechtliche-einordnung",
      title: {
        de: "Kein Medizinprodukt (MDR) & ärztliche Verantwortung",
        en: "Not a medical device (MDR) & clinical responsibility",
      },
      minutes: 6,
      blocks: [
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "**Wichtige Einordnung:** J.A.R. ist ein Forschungs- und Entwicklungsprototyp und kein zugelassenes Medizinprodukt im Sinne der EU-Verordnung 2017/745 (MDR). In realen Einsätzen ersetzt J.A.R. weder die ärztliche Entscheidung noch die Papier-Sichtungskarte als Rückfallebene.",
            en: "**Important notice:** J.A.R. is a research and development prototype and not an approved medical device under EU Regulation 2017/745 (MDR). In live operations, J.A.R. replaces neither the physician's decision nor the paper triage tag as a fallback.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Vorschlag statt Autopilot:** Jede automatisch vorgeschlagene Sichtungskategorie und jeder generierte Übergabebericht (inkl. NEWS2) ist ein Entwurf, der vor Freigabe geprüft wird.",
              "**SK IV bleibt ärztliche Entscheidung:** In der Vorsichtung vergibt das System niemals selbstständig SK IV (blau).",
              "**Übungsbetrieb mit Rückfallebene:** Bei Erprobungen in Übungen läuft die gewohnte Papier-Sichtungskarte immer parallel mit.",
            ],
            en: [
              "**Suggestion, not autopilot:** every suggested triage category and every generated handover report (including NEWS2) is a draft to be reviewed before sign-off.",
              "**SK IV remains a physician's decision:** during pre-triage the system never assigns SK IV (blue) on its own.",
              "**Exercise operation with fallback:** during field exercises, standard paper triage tags are always used alongside the system.",
            ],
          },
        },
      ],
    },
  ],
};
