// Course: transkription-modell ("Transkription: So ist unser Sprachmodell aufgebaut")
// Section: understand · Icon: waveform
export default {
  id: "transkription-modell",
  version: 1,
  section: "understand",
  icon: "waveform",
  title: {
    de: "Transkription: So ist unser Sprachmodell aufgebaut",
    en: "Transcription: how our speech model is built",
  },
  subtitle: {
    de: "Vokabularfreie Silben-KI für die Notfall-Triage",
    en: "Vocabulary-free syllable AI for emergency triage",
  },
  summary: {
    de: "Wie J.A.R. medizinische Fachbegriffe und Funksprüche ohne Halluzinationen transkribiert: Audio-Frontend, Phonem-Erkennung, 3-Silben-Transducer, phonetisches Gate und klinische Extraktion.",
    en: "How J.A.R. transcribes clinical terms and radio calls without hallucinations: audio frontend, phoneme recognition, 3-syllable transducer, phonetic gate and clinical extraction.",
  },
  audience: {
    de: "Für technische Entscheider, Notärzte, Entwickler und Projektpartner.",
    en: "For technical decision makers, emergency physicians, engineers and project partners.",
  },
  minutes: 18,
  lessons: [
    {
      id: "aufbau-pipeline",
      title: {
        de: "Die fünfstufige ASR-Pipeline im Überblick",
        en: "The five-stage ASR pipeline at a glance",
      },
      minutes: 6,
      blocks: [
        { type: "asr-pipeline-cards" },
        {
          type: "p",
          text: {
            de: "Im Katastropheneinsatz treffen laute Sirenen und Motorenlärm auf seltene medizinische Komposita wie Spannungspneumothorax. Klassische Sprachmodelle halluzinieren unter Rauschen gefährliche Diagnosen. J.A.R. trennt die Spracherkennung daher in fünf modulare Stufen vom Akustikfilter bis zur strukturierten cABCDE-Extraktion.",
            en: "During crisis triage, loud sirens and engine roar meet rare clinical compounds like tension pneumothorax. Conventional speech models hallucinate dangerous diagnoses under noise. J.A.R. therefore separates speech recognition into five modular stages from acoustic filtering to structured cABCDE extraction.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Jede Stufe ist deterministisch oder lokal begrenzt: Das Audio-Frontend entfernt Sirene, Motor und Wind in unter 3 ms pro Frame und lässt per Nahfeld-Schwelle nur die Stimme direkt am Mikrofon durch, während der klinische Extraktor Befunde nur mit wörtlichem Zitatbeleg akzeptiert. Das Modell ist zudem auf das Mikrofon-Array unserer Brille feinabgestimmt: Abstand und Richtwirkung der Mikrofone und die Akustik am Helm sind Teil des Trainings.",
            en: "Every stage is deterministic or locally bounded: the audio frontend removes siren, engine and wind in under 3 ms per frame and its near-field gate passes only the voice right at the microphone, while the clinical extractor accepts findings only with a verbatim quote. The model is also fine-tuned to the microphone array in our headset: the spacing and directivity of the microphones and the acoustics at the helmet are part of its training.",
          },
        },
      ],
    },
    {
      id: "silben-zero-shot",
      title: {
        de: "Silben-Lego, Zero-Shot & Phonetisches Gate",
        en: "Syllable Lego, Zero-Shot & Phonetic Gate",
      },
      minutes: 6,
      blocks: [
        { type: "syllable-window" },
        {
          type: "p",
          text: {
            de: "Wenige Tausend gesprochene Silben genügen, um medizinische Fachbegriffe zusammenzusetzen. Unser 3-Silben-Transducer übersetzt nur die mittlere Silbe im lokalen Kontext. Dadurch kann das Modell unbekannte Fachbegriffe fehlerfrei zusammensetzen, ohne jemals ganze Wörter zu erraten.",
            en: "A few thousand spoken syllables are enough to build clinical terms. Our 3-syllable transducer translates only the middle syllable in local context. This allows the model to reconstruct unfamiliar terms without ever guessing whole words.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Neue Wörter per Text-zu-Latent-Modell:** Ein Text-zu-Latent-Modell überträgt geschriebene Begriffe, etwa neue Medikamente oder Ortsnamen, direkt in die interne Darstellung des Sprachmodells. So wächst der Wortschatz ohne neue Sprachaufnahmen.",
            ],
            en: [
              "**New words via a text-to-latent model:** A text-to-latent model carries written terms, such as new drugs or place names, straight into the speech model's internal representation. The vocabulary grows without new voice recordings.",
            ],
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "Das phonetische Levenshtein-Gate blockiert jede Textanpassung, wenn die Rückübersetzung in IPA um mehr als 20 Prozent vom Originalton abweicht. Sinkt die Konfidenz unter 0,45, wird die Stelle als unsicher markiert.",
            en: "The phonetic Levenshtein gate blocks any text edit if back-translation into IPA deviates by more than 20 percent from the raw audio. When confidence drops below 0.45, the token is flagged as uncertain.",
          },
        },
      ],
    },
    {
      id: "groesse-und-diarisierung",
      title: {
        de: "Modell-Skalierung am Edge & Sprecher-Diarisierung",
        en: "Model scaling at the edge & speaker diarization",
      },
      minutes: 6,
      blocks: [
        { type: "model-size-chart" },
        { type: "diarization-timeline" },
        {
          type: "p",
          text: {
            de: "Die modulare Pipeline läuft flexibel auf der tragbaren Recheneinheit am Körper oder auf dem Server im Einsatzleitwagen. Der Hub steuert aktive Modelle per Befehl. Gleichzeitig trennt die Sprecher-Diarisierung Einsatzkraft, Patient und Einsatzleitung.",
            en: "The modular pipeline runs flexibly on the wearable compute unit or the command vehicle server. The hub switches active models via command. Simultaneously, speaker diarization isolates responder, patient and command channels.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Austauschbare Modellgrößen:** Kompakte Modelle laufen lokal an der tragbaren Recheneinheit, größere auf dem Hub-Server.",
              "**Zentrale Steuerung:** Der Hub wechselt das ASR-Modell der Brillen dynamisch per set_asr_model.",
              "**Rollenfilter:** Nur Befunde aus der Spur der Einsatzkraft fließen in das Protokoll des Patienten ein.",
              "**Explizite Verneinung:** Aussagen wie keine Allergien werden strukturiert als verneint erfasst.",
            ],
            en: [
              "**Swappable model sizes:** Compact models run locally on the wearable compute unit, larger ones on the hub server.",
              "**Central orchestration:** The hub switches headset ASR models dynamically via set_asr_model.",
              "**Role filtering:** Only findings from the responder lane enter the clinical patient record.",
              "**Explicit negation:** Statements like no allergies are captured with structured negated status.",
            ],
          },
        },
      ],
    },
  ],
};
