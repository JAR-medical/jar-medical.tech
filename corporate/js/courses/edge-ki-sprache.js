// Understand 2: "Edge-KI, Zero-Shot & Sprachpipeline" (DE + EN)
export default {
  id: "edge-ki-sprache",
  version: 1,
  section: "understand",
  icon: "cpu",
  title: {
    de: "Edge-KI, Zero-Shot & Sprachpipeline",
    en: "Edge AI, Zero-Shot & Speech Pipeline",
  },
  subtitle: {
    de: "Wie Spracherkennung, Diarisierung und Extraktion arbeiten",
    en: "How speech recognition, diarization and extraction work",
  },
  summary: {
    de: "Dieser Kurs erklärt die technische Sprachpipeline hinter J.A.R.: warum Zero-Shot-Genauigkeit bei medizinischem Fachvokabular entscheidend ist, wie WhisperX und pyannote Sprecher trennen und wie ein lokales Sprachmodell strukturierte Felder erzeugt.",
    en: "This course explains the technical speech pipeline behind J.A.R.: why zero-shot accuracy is critical for clinical vocabulary, how WhisperX and pyannote separate speakers, and how a local language model extracts structured fields.",
  },
  audience: {
    de: "Für technische Entscheider, IT-Verantwortliche, Ärztinnen und Ärzte sowie Projektpartner.",
    en: "For technical decision-makers, IT leads, physicians and project partners.",
  },
  minutes: 16,
  lessons: [
    {
      id: "zero-shot-medizin",
      title: {
        de: "Zero-Shot-Genauigkeit in der Medizin",
        en: "Zero-shot accuracy in clinical speech",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Medizinische Sprache ist dicht: Medikamentennamen, Dosierungen, Abkürzungen (AF, SpO2, GCS, NEWS2, mSTaRT), regionale Dialekte und Hintergrundgeräusche. Ein Modell, das vor Ort erst angelernt werden müsste, hilft im Einsatz nicht.",
            en: "Clinical speech is dense: drug names, dosages, abbreviations (RR, SpO2, GCS, NEWS2, mSTaRT), regional accents and background noise. A model that needed on-site training first would be useless in the field.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Zero-Shot-Verständnis:** Das Modell überträgt sein Wissen über medizinische Sprache auf Präparate und Fachbegriffe, die ihm am Einsatzort zum ersten Mal begegnen.",
              "**Normalisierung:** Gesprochene Zahlen und Einheiten („einundzwanzig zu achtzig“, „fünfhundert Milligramm“) werden in standardisierte Werte (`120/80`, `500 mg`) überführt.",
              "**Lärmrobustheit:** Voice Activity Detection (VAD) schneidet Stille und Funkpausen heraus, bevor das Sprachmodell rechnet.",
            ],
            en: [
              "**Zero-shot comprehension:** the model transfers what it has learned about clinical language to drugs and terms it encounters on site for the first time.",
              "**Normalisation:** spoken numbers and units (“one twenty over eighty”, “five hundred milligrams”) are converted into standardised values (`120/80`, `500 mg`).",
              "**Noise robustness:** Voice Activity Detection (VAD) trims silence and radio pauses before the speech model runs.",
            ],
          },
        },
      ],
    },
    {
      id: "alignment-und-diarisierung",
      title: {
        de: "Wort-Alignment & Sprecher-Diarisierung",
        en: "Word alignment & speaker diarization",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Am Patienten sprechen oft mehrere Personen: die Einsatzkraft diktiert Befunde, der Patient antwortet auf Fragen, ein Teampartner meldet Vitalwerte. Damit Aussagen nicht verwechselt werden, kombiniert J.A.R. Transkription mit **Wort-Alignment** und **Sprecher-Diarisierung**.",
            en: "At the patient, several people often speak: the responder dictates findings, the patient answers questions, a partner calls out vital signs. To keep statements separate, J.A.R. combines transcription with **word alignment** and **speaker diarization**.",
          },
        },
        {
          type: "table",
          head: {
            de: ["Stufe", "Modell / Technik", "Aufgabe"],
            en: ["Stage", "Model / Technique", "Role"],
          },
          rows: {
            de: [
              ["1. VAD & ASR", "WhisperX (int8 auf CPU)", "Erkennt Sprachsegmente und transkribiert sie in Text"],
              ["2. Wort-Alignment", "wav2vec2 Phonem-Alignment", "Bestimmt für jedes einzelne Wort den exakten Start- und Endzeitpunkt"],
              ["3. Diarisierung (Turns)", "pyannote speaker-diarization", "Erkennt längere Sprecherabschnitte über das gesamte Audio"],
              ["4. Satz-Stimmabdruck", "WeSpeaker Voiceprint-Clustering", "Trennt auch schnelle, kurze Wortwechsel (Sanitäter ↔ Patient) satzgenau"],
            ],
            en: [
              ["1. VAD & ASR", "WhisperX (int8 on CPU)", "Detects speech segments and transcribes them into text"],
              ["2. Word alignment", "wav2vec2 phoneme alignment", "Finds the exact start and end timestamp for every word"],
              ["3. Diarization (turns)", "pyannote speaker-diarization", "Identifies longer speaker turns across the audio"],
              ["4. Sentence voiceprints", "WeSpeaker voiceprint clustering", "Cleanly separates rapid back-and-forth turns (medic ↔ patient) per sentence"],
            ],
          },
        },
      ],
    },
    {
      id: "gbnf-extraktion",
      title: {
        de: "GBNF-Schema-Extraktion ins Protokoll",
        en: "GBNF schema extraction into the protocol",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Ein Transkript allein ist noch kein Einsatzbericht. Deshalb folgt auf die Spracherkennung ein kleines, lokal laufendes Sprachmodell (LLM), dessen Ausgabe durch eine **GBNF-Grammatik** (Grammar-Based Normalization Format) streng auf das Zielschema festgelegt ist.",
            en: "A transcript alone is not yet a care report. Speech recognition is therefore followed by a small local language model (LLM) whose output is strictly constrained to the target schema via a **GBNF grammar**.",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Relevanzfilter:** Unwichtige Nebengespräche werden verworfen; medizinisch relevante Aussagen bleiben erhalten.",
              "**Kontext-Abgleich:** Das Transkript wird mit der bestehenden Patientenkarte (QR-/NFC-ID, bekannte Vorbefunde) zusammengeführt.",
              "**Schema-erzwungene Extraktion:** Das Modell füllt ausschließlich die definierten Felder (Sichtungskategorie, Vitalwerte, Verletzungen, Maßnahmen, Medikamente, Transportstatus). Nicht genannte Felder bleiben garantiert leer.",
            ],
            en: [
              "**Relevance filter:** unrelated side chatter is dropped while clinically relevant statements are kept.",
              "**Context join:** the transcript is merged with the existing patient card (QR/NFC ID, prior findings).",
              "**Schema-enforced extraction:** the model populates only the defined fields (triage category, vitals, injuries, measures, medications, transport status). Unmentioned fields stay strictly empty.",
            ],
          },
        },
      ],
    },
  ],
};
