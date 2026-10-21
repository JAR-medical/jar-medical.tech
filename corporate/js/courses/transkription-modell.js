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
      quiz: [
        {
          q: {
            de: "Warum filtert das Audio-Frontend Frequenzen unter 250 Hz per Nahfeld-Gate?",
            en: "Why does the audio frontend filter frequencies below 250 Hz via near-field gate?",
          },
          options: [
            {
              de: "Um tieffrequente Störgeräusche wie Martinshorn, Motoren und Wind direkt am Mikrofon zu eliminieren.",
              en: "To eliminate low-frequency interference such as sirens, engines and wind right at the microphone.",
            },
            {
              de: "Um die Audio-Abtastrate für das Mobilfunknetz auf 8 kHz zu drosseln.",
              en: "To throttle the audio sampling rate for cellular networks to 8 kHz.",
            },
            {
              de: "Um Stimmen von weiblichen Einsatzkräften aus der Transkription auszuschließen.",
              en: "To exclude female responder voices from transcription.",
            },
            {
              de: "Weil wav2vec2 grundsätzlich keine Frequenzen unter 250 Hz verarbeiten kann.",
              en: "Because wav2vec2 fundamentally cannot process frequencies below 250 Hz.",
            },
          ],
          answer: 0,
          explain: {
            de: "Das Nahfeld-Gate unter 250 Hz entfernt laute Umgebungsgeräusche wie Sirenen und Motoren in unter 3 ms, sodass nur die Stimme des Trägers direkt am Mikrofon erfasst wird.",
            en: "The near-field gate below 250 Hz eliminates loud ambient noise such as sirens and engines in under 3 ms, capturing only the wearer's voice right at the microphone.",
          },
        },
        {
          q: {
            de: "Welche Bedingung stellt Modul 5 (Klinischer Extraktor) an jeden extrahierten Befund?",
            en: "What requirement does Module 5 (Clinical Extractor) enforce for every extracted finding?",
          },
          options: [
            {
              de: "Es muss eine bestätigte Online-Verbindung zur Klinik-Leitstelle vorliegen.",
              en: "There must be a confirmed online connection to the hospital dispatch centre.",
            },
            {
              de: "Jeder Befund benötigt einen wörtlichen source_quote-Beleg aus dem geprüften Transkript.",
              en: "Every finding requires a verbatim source_quote substring from the verified transcript.",
            },
            {
              de: "Der Befund muss mindestens drei Symptome gleichzeitig beschreiben.",
              en: "The finding must describe at least three symptoms simultaneously.",
            },
            {
              de: "Das Modell muss die Wahrscheinlichkeit auf über 99 Prozent schätzen.",
              en: "The model must estimate the probability at over 99 percent.",
            },
          ],
          answer: 1,
          explain: {
            de: "Der Ambient Clinical Extractor verlangt für jeden Vitalwert und cABCDE-Befund ein exaktes source_quote aus dem Audio-Transkript, um freie Halluzinationen auszuschließen.",
            en: "The Ambient Clinical Extractor requires an exact source_quote from the audio transcript for every vital sign and cABCDE finding to eliminate hallucinations.",
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
      quiz: [
        {
          q: {
            de: "Warum verhindert das lokale 3-Silben-Fenster Halluzinationen wie 'Pazifischer Ozean' statt 'Patient'?",
            en: "Why does the local 3-syllable window prevent hallucinations like 'Pacific Ocean' instead of 'patient'?",
          },
          options: [
            {
              de: "Weil der Transducer nie mehr als 15 bis 20 Phoneme auf einmal sieht und keine Wortassoziationen bilden kann.",
              en: "Because the transducer never sees more than 15 to 20 phonemes at once and cannot form word associations.",
            },
            {
              de: "Weil medizinische Wörterbücher alle geographischen Begriffe herausfiltern.",
              en: "Because medical dictionaries filter out all geographic terms.",
            },
            {
              de: "Weil ein Decoder-LLM jeden fertigen Satz auf Plausibilität prüft.",
              en: "Because a decoder LLM checks every finished sentence for plausibility.",
            },
            {
              de: "Weil nur bei absoluter Stille im Behandlungszelt transkribiert wird.",
              en: "Because transcription only occurs during absolute silence in the treatment tent.",
            },
          ],
          answer: 0,
          explain: {
            de: "Durch die Beschränkung auf ein Fenster von drei Silben (15–20 Phoneme) übersetzt das Modell rein lokale Rechtschreibung in 5–8 ms und hat keinen Raum für semantische Satz-Halluzinationen.",
            en: "By restricting attention to a window of three syllables (15–20 phonemes), the model resolves local spelling in 5–8 ms with zero capacity for sentence-level semantic hallucinations.",
          },
        },
        {
          q: {
            de: "Ab welcher IPA-Ähnlichkeit greift das phonetische Anker-Lexikon bei Fachbegriffen?",
            en: "At what IPA similarity threshold does the phonetic anchor lexicon correct clinical terms?",
          },
          options: [
            {
              de: "Ab 50 Prozent Übereinstimmung mit dem Wörterbuch.",
              en: "At 50 percent match with the dictionary.",
            },
            {
              de: "Ab 82 Prozent artikulatorischer IPA-Ähnlichkeit bei maximal 20 Prozent Levenshtein-Abweichung.",
              en: "At 82 percent articulatory IPA similarity with at most 20 percent Levenshtein deviation.",
            },
            {
              de: "Nur bei 100 Prozent exakter Buchstabengleichheit.",
              en: "Only on 100 percent exact letter match.",
            },
            {
              de: "Sobald ein Notarzt die Korrektur manuell auf der Tastatur freigibt.",
              en: "As soon as an emergency physician manually approves the edit on a keyboard.",
            },
          ],
          answer: 1,
          explain: {
            de: "Das Anker-Lexikon korrigiert lautnahe Schreibungen ab 82 Prozent IPA-Ähnlichkeit, sofern das Levenshtein-Gate bestätigt, dass die Abweichung vom Audio 20 Prozent nicht übersteigt.",
            en: "The anchor lexicon corrects phonetic spellings at 82 percent or higher IPA similarity, provided the Levenshtein gate confirms that deviation from audio does not exceed 20 percent.",
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
      quiz: [
        {
          q: {
            de: "Warum fließen Äußerungen des Patienten nicht direkt in die cABCDE-Befunde ein?",
            en: "Why do patient utterances not flow directly into the cABCDE findings?",
          },
          options: [
            {
              de: "Weil Patienten im Schockzustand keine rechtsgültigen Aussagen treffen dürfen.",
              en: "Because patients in shock cannot make legally binding statements.",
            },
            {
              de: "Weil die Diarisierung Sprecherspuren trennt und der Extraktor nur bestätigte Befunde der Einsatzkraft übernimmt.",
              en: "Because diarization separates speaker lanes and the extractor only ingests verified responder findings.",
            },
            {
              de: "Weil Patientenstimmen durch den 250-Hz-Filter komplett gelöscht werden.",
              en: "Because patient voices are completely deleted by the 250 Hz filter.",
            },
            {
              de: "Weil der Extraktor nur englische Sätze analysieren kann.",
              en: "Because the extractor can only analyse English sentences.",
            },
          ],
          answer: 1,
          explain: {
            de: "Die Sprecher-Diarisierung weist jedem Segment einen Sprecher zu. Der klinische Extraktor filtert Schmerzäußerungen und übernimmt nur medizinische Feststellungen der Einsatzkraft.",
            en: "Speaker diarization tags each segment with a speaker label. The clinical extractor filters out pain cries and only accepts clinical findings dictated by the responder.",
          },
        },
        {
          q: {
            de: "Wie steuert der Einsatzleitwagen (Hub) die Sprachmodelle der vernetzten AR-Brillen?",
            en: "How does the command vehicle (Hub) control the speech models on connected AR headsets?",
          },
          options: [
            {
              de: "Über das Steuerkommando set_asr_model, das modulare Modellgrößen je nach Rechenlast umschaltet.",
              en: "Via the set_asr_model command, switching modular model sizes based on compute load.",
            },
            {
              de: "Durch manuelles Einstecken eines USB-Sticks an jedem Helm.",
              en: "By manually plugging a USB stick into each helmet.",
            },
            {
              de: "Indem alle Headsets permanent auf Cloud-Server im Internet zugreifen.",
              en: "By having all headsets permanently connect to internet cloud servers.",
            },
            {
              de: "Das Modell ist fest verdrahtet und kann nach dem Start nicht verändert werden.",
              en: "The model is hardwired and cannot be altered after launch.",
            },
          ],
          answer: 0,
          explain: {
            de: "Der Hub im Einsatzleitfahrzeug kann über set_asr_model das aktive ASR-Modell pro Headset bedarfsgerecht zwischen Edge- und Server-Profil umschalten.",
            en: "The command vehicle hub can switch the active ASR model per headset dynamically between edge and server profiles via set_asr_model.",
          },
        },
      ],
    },
  ],
};
