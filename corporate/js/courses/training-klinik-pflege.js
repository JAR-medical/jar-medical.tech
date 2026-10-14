// Train 3: "Praxistraining: JAR Scribe in Klinik & Pflege" (DE + EN)
export default {
  id: "training-klinik-pflege",
  version: 1,
  section: "train",
  icon: "scribe",
  title: {
    de: "Praxistraining: JAR Scribe in Klinik & Pflege",
    en: "Field Training: JAR Scribe in Hospital & Care",
  },
  subtitle: {
    de: "Dokumentation am Bett, Vitalwerte und NEWS2-Übergabe",
    en: "Bedside documentation, vital signs and NEWS2 handover",
  },
  summary: {
    de: "Schulung für Pflegekräfte und klinische Teams im Krankenhaus und im ambulanten Pflegedienst: wie Sie mit JAR Scribe direkt am Patientenbett oder auf der Pflegetour dokumentieren, Vitalwerte per Sprache erfassen und den Übergabebericht mit NEWS2-Score prüfen.",
    en: "Training for nursing and clinical teams in hospitals and outpatient care: how to document right at the bedside or on tour with JAR Scribe, capture vital signs by voice, and review the handover report with NEWS2 score.",
  },
  audience: {
    de: "Für Pflegefachkräfte, Stationsleitungen, ambulante Pflegedienste und klinisches Personal.",
    en: "For nurses, ward managers, outpatient care services and clinical staff.",
  },
  minutes: 18,
  lessons: [
    {
      id: "dokumentation-am-bett",
      title: {
        de: "Dokumentieren am Patientenbett statt im Stationszimmer",
        en: "Documenting at the bedside instead of the station desk",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Eine Schicht im Krankenhaus oder eine Tour im ambulanten Pflegedienst besteht aus vielen kurzen Maßnahmen. Jede einzelne ist schnell gesagt, aber mühsam zu tippen. Mit **JAR Scribe** entsteht der Eintrag während der Tätigkeit am Patienten.",
            en: "A hospital shift or an outpatient care tour consists of many small measures. Each one is quick to say and tedious to type. With **JAR Scribe**, the record is created while working at the patient.",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Aufnahme starten:** Tippen Sie in JAR Scribe auf dem Stationsgerät auf „Start documentation“.",
              "**Natürlich sprechen:** Sprechen Sie Maßnahme, Beobachtung und Uhrzeit wie gewohnt aus – z. B. „Verbandswechsel am linken Unterschenkel, Wunde reizlos, Schmerzen drei von zehn, sieben Uhr vierzig“.",
              "**Strukturierte Felder prüfen:** Die App trennt den Satz automatisch in Maßnahme (`Verbandswechsel`), Ort (`Unterschenkel links`), Schmerzskala (`3/10`) und Zeit (`07:40`).",
            ],
            en: [
              "**Start documenting:** tap “Start documentation” in JAR Scribe on the ward device.",
              "**Speak naturally:** state the measure, observation and time naturally – e.g. “Dressing change on the left lower leg, wound clean, pain three out of ten, seven forty”.",
              "**Check structured fields:** the app automatically resolves the sentence into measure (`Dressing change`), site (`Left lower leg`), pain scale (`3/10`) and time (`07:40`).",
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Wann wird mit JAR Scribe im Klinik- oder Pflegealltag dokumentiert?",
            en: "When are records made with JAR Scribe in hospital or outpatient care?",
          },
          options: [
            { de: "Direkt während oder unmittelbar bei der Maßnahme am Patienten", en: "Directly during or right at the measure by the patient" },
            { de: "Gesammelt am Ende der Schicht aus dem Gedächtnis", en: "All at once at the end of the shift from memory" },
            { de: "Durch eine externe Schreibkraft am nächsten Tag", en: "By an external transcriptionist the next day" },
          ],
          answer: 0,
          explain: {
            de: "Wer spricht, während er handelt, muss am Schichtende oder nach der Tour nichts aus dem Gedächtnis rekonstruieren.",
            en: "Whoever speaks while acting has nothing to reconstruct from memory at the end of the shift or tour.",
          },
        },
      ],
    },
    {
      id: "vitalwerte-und-news2",
      title: {
        de: "Vitalwerte & automatischer NEWS2-Score",
        en: "Vital signs & automated NEWS2 score",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Während Sie sprechen, erkennt JAR Scribe genannte Vitalparameter in Echtzeit und berechnet daraus automatisch den **NEWS2-Frühwarnscore** (National Early Warning Score 2).",
            en: "While you speak, JAR Scribe picks up spoken vital signs in real time and automatically computes the **NEWS2 early-warning score** (National Early Warning Score 2).",
          },
        },
        {
          type: "table",
          head: {
            de: ["Parameter", "Sprachbeispiel", "Verarbeitung in JAR Scribe"],
            en: ["Parameter", "Spoken example", "Processing in JAR Scribe"],
          },
          rows: {
            de: [
              ["Atemfrequenz & SpO2", "„Atemfrequenz 18, Sättigung 96 Prozent“", "Übernahme in die Vitalwert-Kacheln + NEWS2-Teilscore"],
              ["Blutdruck & Puls", "„RR 125 zu 80, Puls 78“", "Normalisierung als `125/80 mmHg` und `78 /min`"],
              ["Temperatur & Bewusstsein", "„Temperatur 37 Komma 4, Patient wach und orientiert“", "Ergänzung im Verlaufsbericht + Gesamtbewertung im NEWS2-Score"],
            ],
            en: [
              ["Respiratory rate & SpO2", "“Respiratory rate 18, saturation 96 percent”", "Populates vital tiles + NEWS2 sub-score"],
              ["Blood pressure & pulse", "“BP 125 over 80, pulse 78”", "Normalised as `125/80 mmHg` and `78 /min`"],
              ["Temperature & consciousness", "“Temperature 37 point 4, patient alert and oriented”", "Added to progress note + total NEWS2 score"],
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Welchen klinischen Frühwarnscore berechnet JAR Scribe automatisch aus den gesprochenen Vitalwerten?",
            en: "Which clinical early-warning score does JAR Scribe compute automatically from spoken vital signs?",
          },
          options: [
            { de: "NEWS2 (National Early Warning Score 2)", en: "NEWS2 (National Early Warning Score 2)" },
            { de: "APGAR-Score", en: "APGAR score" },
            { de: "CHA2DS2-VASc-Score", en: "CHA2DS2-VASc score" },
          ],
          answer: 0,
          explain: {
            de: "JAR Scribe fasst Temperatur, Sauerstoffsättigung, Puls, Blutdruck und Atemfrequenz im Übergabebericht mit einem NEWS2-Score zusammen.",
            en: "JAR Scribe summarises temperature, oxygen saturation, pulse, blood pressure and respiratory rate in the handover report with a NEWS2 score.",
          },
        },
      ],
    },
    {
      id: "uebergabe-pruefen-freigeben",
      title: {
        de: "Schichtübergabe prüfen & freigeben",
        en: "Reviewing & signing off the shift handover",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Am Ende der Aufnahme erstellt JAR Scribe einen strukturierten Übergabebericht. Dieser Bericht ist bewusst ein **Entwurf**: Die Pflegekraft prüft die erkannten Werte auf dem Bildschirm und gibt den Eintrag erst danach für das Krankenhausinformationssystem (KIS) oder die Pflegedokumentation frei.",
            en: "At the end of the recording, JAR Scribe generates a structured handover report. This report is deliberately a **draft**: the nurse reviews the recognised values on screen and signs off the entry before it goes into the hospital or care information system.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "**Verantwortung bleibt beim Fachpersonal:** Kein automatisch transkribierter Wert wird ungeprüft übernommen. Die Freigabe am Gerät stellt sicher, dass Dosierungen und Vitalwerte vor der Übergabe kontrolliert sind.",
            en: "**Responsibility stays with clinical staff:** no automatically transcribed value is committed unchecked. Sign-off on the device ensures dosages and vitals are verified before handover.",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Welchen Status hat der von JAR Scribe erzeugte Übergabebericht unmittelbar nach dem Sprechen?",
            en: "What status does the handover report generated by JAR Scribe have immediately after speaking?",
          },
          options: [
            { de: "Er ist ein Entwurf, der von der Pflegekraft geprüft und freigegeben wird.", en: "It is a draft to be reviewed and signed off by the nurse." },
            { de: "Er wird ohne Ansicht unsichtbar archiviert.", en: "It is archived invisibly without review." },
            { de: "Er löscht frühere Schichtberichte automatisch.", en: "It automatically deletes previous shift reports." },
          ],
          answer: 0,
          explain: {
            de: "Der generierte Bericht samt NEWS2-Score wird vor der Übernahme immer als Entwurf geprüft und freigegeben.",
            en: "The generated report and NEWS2 score are always reviewed and signed off as a draft before use.",
          },
        },
      ],
    },
  ],
};
