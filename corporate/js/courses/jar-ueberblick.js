// Understand 1: "Was ist J.A.R.? System & Einsatzbereiche" (DE + EN)
export default {
  id: "jar-ueberblick",
  version: 1,
  section: "understand",
  icon: "compass",
  title: {
    de: "Was ist J.A.R.? System & Einsatzbereiche",
    en: "What is J.A.R.? System & sectors",
  },
  subtitle: {
    de: "Vom gesprochenen Wort zur strukturierten Dokumentation",
    en: "From the spoken word to structured documentation",
  },
  summary: {
    de: "Lernen Sie die Grundidee von J.A.R. Medical kennen: wie ein medizinisches Sprachmodell mit hoher Zero-Shot-Genauigkeit Dokumentation direkt am Patienten ermöglicht – im Krankenhaus, im Pflegedienst, im Rettungsdienst und im Katastrophenschutz.",
    en: "Learn the core idea behind J.A.R. Medical: how a medical speech model with high zero-shot accuracy enables documentation right at the patient – in hospitals, outpatient care, emergency medical services and disaster response.",
  },
  audience: {
    de: "Für Partnerorganisationen, Klinikleitungen, Pflegedienste, Rettungsdienste und Einsatzleitungen, die einen Gesamtüberblick über J.A.R. suchen.",
    en: "For partner organisations, hospital management, care providers, EMS and incident command teams looking for a complete overview of J.A.R.",
  },
  minutes: 15,
  lessons: [
    {
      id: "idee-und-problem",
      title: {
        de: "Warum Dokumentation am Patienten entsteht",
        en: "Why documentation belongs at the patient",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Überall dort, wo am Menschen gearbeitet und danach darüber geschrieben wird, entsteht heute derselbe Bruch: Gehandelt und gesprochen wird am Patienten – geschrieben wird später im Stationszimmer, im Auto, im Rettungswagen oder auf einer Papierkarte.",
            en: "Wherever people care for patients and then have to write about it, the same gap appears today: action and speech happen at the patient – writing happens later at the station desk, in the car, in the ambulance or on a paper tag.",
          },
        },
        {
          type: "h",
          text: {
            de: "Mitschreiben statt Nachtragen",
            en: "Written down while spoken, not reconstructed later",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Am Patienten gesprochen:** Maßnahmen, Vitalwerte und Beobachtungen werden ausgesprochen, während beide Hände frei bleiben.",
              "**Auf dem Gerät transkribiert:** Die Spracherkennung läuft lokal in Echtzeit – ohne Cloud und auch ohne Netzverbindung.",
              "**Strukturierte Felder statt Fließtext:** Aus „fünfhundert Milligramm Paracetamol intravenös, vierzehn Uhr sieben, Patient A7“ werden automatisch Maßnahme, Dosis (`500 mg`), Zeit (`14:07`) und Kennung (`A7`).",
            ],
            en: [
              "**Spoken at the patient:** measures, vital signs and observations are spoken aloud while both hands remain free.",
              "**Transcribed on the device:** speech recognition runs locally in real time – with no cloud and even without a network connection.",
              "**Structured fields instead of prose:** “five hundred milligrams of paracetamol intravenously, fourteen oh seven, patient A7” automatically resolves into measure, dose (`500 mg`), time (`14:07`) and identifier (`A7`).",
            ],
          },
        },
      ],
    },
    {
      id: "vier-einsatzbereiche",
      title: {
        de: "Vier Einsatzbereiche, dieselbe Sprache",
        en: "Four sectors, one clinical language",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Dasselbe medizinische Sprachmodell trägt vier Einsatzbereiche. Was sich unterscheidet, sind Umgebungslärm, Taktung, Endgerät und das Zielformular am Ende:",
            en: "The same medical speech model serves four sectors. What differs is background noise, pace, form factor and the target record at the end:",
          },
        },
        {
          type: "table",
          head: {
            de: ["Bereich", "Wo dokumentiert wird", "Ergebnis"],
            en: ["Sector", "Where it is spoken", "Output"],
          },
          rows: {
            de: [
              ["Krankenhaus", "direkt am Patientenbett auf dem Stationsgerät (JAR Scribe)", "Vitalwerte, Maßnahmen und Schichtübergabe mit NEWS2-Score"],
              ["Pflegedienst", "beim Patienten zuhause statt nach der Tour im Auto", "strukturierter Pflegeeintrag und Übergabebericht"],
              ["Rettungsdienst", "am Einsatzort und während der Versorgung am Patienten", "strukturiertes Einsatzprotokoll zur Übergabe in der Klinik"],
              ["Katastrophenschutz", "im Einsatzhelm mit AR-Brille und Client-Compute-Unit", "Sichtung im Blickfeld (HUD) und Echtzeit-Lagebild für die Einsatzleitung"],
            ],
            en: [
              ["Hospital", "right at the bedside on the ward device (JAR Scribe)", "vital signs, measures and shift handover with NEWS2 score"],
              ["Outpatient care", "at the patient's home instead of in the car after the tour", "structured care entry and handover report"],
              ["Emergency services", "on scene and during patient care", "structured patient care report for hospital handover"],
              ["Disaster response", "in the incident helmet with AR glasses and compute unit", "triage in the field of view (HUD) and live operating picture for command"],
            ],
          },
        },
      ],
    },
    {
      id: "architektur-komponenten",
      title: {
        de: "Systemarchitektur & Zusammenspiel",
        en: "System architecture & components",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Im Katastrophenschutz greifen drei Ebenen ineinander: die Kennzeichnung am Patienten, die tragbare Einheit der Einsatzkraft und der lokale Server im Einsatzleitfahrzeug.",
            en: "In disaster response, three tiers work together: patient identification, the responder's wearable unit, and the local server in the command vehicle.",
          },
        },
        {
          type: "figure",
          src: { de: "../jar-concept-de.png", en: "../jar-concept-en.png" },
          alt: {
            de: "Konzeptübersicht: Patient, Sanitäter mit AR-Brille und Compute Unit sowie Einsatzleitfahrzeug mit lokalem Server und Edge-KI.",
            en: "Concept overview: patient, paramedic with AR glasses and compute unit, and command vehicle with local server and edge AI.",
          },
          caption: {
            de: "Abb. 1 – Durchgängiger Informationsfluss vom Patienten bis zur Einsatzleitung.",
            en: "Fig. 1 – Continuous information flow from the patient to incident command.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "**Herkunft:** J.A.R. Medical entstand am Gymnasium Neubiberg und wird im UnternehmerTUM Makerspace und an der LMU München gemeinsam mit Praxispartnern (u. a. DRK, TUM, DLR) weiterentwickelt.",
            en: "**Origin:** J.A.R. Medical started at Gymnasium Neubiberg and is developed further at UnternehmerTUM Makerspace and LMU Munich together with practice partners (including German Red Cross, TUM and DLR).",
          },
        },
      ],
    },
  ],
};
