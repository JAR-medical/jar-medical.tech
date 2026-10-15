// Understand 4: "Das J.A.R. ASR-Modell: Silben-Lego & Phonem-KI" (DE + EN)
export default {
  id: "asr-modell",
  version: 1,
  section: "understand",
  icon: "waveform",
  title: {
    de: "Das J.A.R. ASR-Modell: Silben-Lego & Phonem-KI",
    en: "The J.A.R. ASR Model: Syllable-Lego & Phoneme AI",
  },
  subtitle: {
    de: "Vokabularfreie Spracherkennung für den Kriseneinsatz",
    en: "Vocabulary-free speech recognition for crisis triage",
  },
  summary: {
    de: "Warum herkömmliche Sprachmodelle bei medizinischen Fachbegriffen und Sirenenlärm halluzinieren, und wie J.A.R. mit akustischer Phonem-Erkennung (S2P), deterministischer Silbentrennung und einem lokalen 3-Silben-Transducer jedes medizinische Kompositum sicher rekonstruiert.",
    en: "Why conventional speech models hallucinate on clinical compounds and siren noise, and how J.A.R. reconstructs every medical term via acoustic speech-to-phoneme (S2P), deterministic syllabification and a local 3-syllable transducer.",
  },
  audience: {
    de: "Für technische Entscheider, KI-Entwickler, Ärztinnen und Ärzte sowie Projektpartner.",
    en: "For technical decision-makers, AI engineers, physicians and project partners.",
  },
  minutes: 18,
  lessons: [
    {
      id: "warum-klassische-asr-scheitert",
      title: {
        de: "Warum klassische Sprachmodelle im Notfall halluzinieren",
        en: "Why classical speech models hallucinate in emergencies",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: 'Am Einsatzort treffen lange Komposita wie **Spannungspneumothorax** oder **Thoraxentlastungspunktion** auf Wirkstoffnamen wie **Amiodaron** und **Tranexamsäure**, oft gesprochen mit über 230 Wörtern pro Minute gegen laufendes Martinshorn. Das Akustikmodell hört diese Laute erstaunlich gut. In unseren Messungen zerlegt `wav2vec2-lv-60-espeak-cv-ft` den Sprachstrom direkt in Lautschrift (IPA) und bleibt selbst bei hohem Tempo unter **5,5 Prozent** Fehlerrate, weil es kein festes Wörterbuch kennt. Der Bruch passiert erst danach.',
            en: 'At an incident scene, long compounds like **Spannungspneumothorax** or **Thoraxentlastungspunktion** meet drug names like **Amiodaron** and **Tranexamsäure**, often spoken at over 230 words per minute against a running siren. The acoustic model hears those sounds remarkably well. In our benchmarks, `wav2vec2-lv-60-espeak-cv-ft` converts speech directly into International Phonetic Alphabet (IPA) phonemes and stays below a **5.5 percent** error rate even at rapid pace because it has no fixed vocabulary. The failure happens one stage later.',
          },
        },
        {
          type: "h",
          text: {
            de: "Akustisches Hören vs. sprachliches Raten",
            en: "Acoustic hearing vs. linguistic guessing",
          },
        },
        {
          type: "p",
          text: {
            de: 'Nachgeschaltete Wortmodelle wie `mT5` wurden auf Alltagstexten und Wikipedia trainiert, weshalb sie unbekannte medizinische Lautketten eigenmächtig zu vertrauten Alltagswörtern umbiegen. Aus den korrekt gehörten Lauten für *Patient* macht das Modell im Test kurzerhand **"Pazifischer Ozean"**. *Blutdruck* wird zu **"Bruno"**. Aus *Tourniquet* wird **"Toni"**, und *Milligramm* kippt zu **"Millionen Dateien"**. Zeichenmodelle über ganze Sätze wie `ByT5` verlieren wiederum ab etwa 100 Zeichen die Zuordnung und brechen mitten im Satz ab, während reine Decoder-Modelle wie `Gemma` im Rauschen sogar Befunde wie *"vom Dach gestürzt"* oder *"Kein Lebenszeichen"* frei erfinden.',
            en: 'Downstream word models such as `mT5` were trained on everyday web text and Wikipedia, so they forcibly bend unfamiliar medical phoneme chains into high-frequency everyday words. In testing, the model turns the accurately heard phonemes for *Patient* into **"Pacific Ocean"**. *Blutdruck* (blood pressure) becomes **"Bruno"**. *Tourniquet* turns into **"Toni"**, and *Milligramm* flips to **"million files"**. Full-sentence character models like `ByT5` lose cross-attention alignment beyond roughly 100 characters and cut off mid-sentence, while causal decoder LLMs like `Gemma` invent dangerous clinical claims under noise such as *"fell from the roof"* or *"no signs of life"*.',
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "**Kernproblem für die Notfallmedizin.** Ein Sprachmodell, das bei unverständlichem Audio klinische Befunde erfindet oder Medikamentennamen durch Vornamen ersetzt, darf im Kriseneinsatz niemals ungefiltert über ganze Sätze entscheiden.",
            en: "**Core emergency-medicine risk.** A language model that invents clinical findings under noisy audio or replaces drug names with first names must never be allowed to rewrite full sentences unchecked in crisis care.",
          },
        },
      ],
    },
    {
      id: "silben-lego-architektur",
      title: {
        de: "Das Silben-Lego-Prinzip: Vom Laut zur Silbe",
        en: "The Syllable-Lego principle: From phoneme to syllable",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Jedes deutsche und lateinisch-griechische Fachwort besteht aus einer endlichen Menge von rund **4.000 bis 5.000 gesprochenen Silben** (`Spann-ungs-pneu-mo-tho-rax`). Silben sind unsere Bausteine. J.A.R. zerlegt Sprache deshalb in fünf getrennte Module, statt ganze Sätze durch ein starres Wort-Lexikon zu pressen.",
            en: "Every German and Greco-Latin clinical compound is built from a finite inventory of roughly **4,000 to 5,000 spoken syllables** (`Spann-ungs-pneu-mo-tho-rax`). Syllables are our building blocks. J.A.R. therefore splits speech processing into five separate modules instead of forcing whole sentences through a rigid word vocabulary.",
          },
        },
        {
          type: "table",
          head: {
            de: ["Modul", "Komponente", "Aufgabe im Datenfluss"],
            en: ["Module", "Component", "Role in the pipeline"],
          },
          rows: {
            de: [
              [
                "1. Audio-Frontend",
                "DeepFilterNet3 / GTCRN + Silero-VAD",
                "Echtzeit-Entrauschung (Martinshorn, Motor, Wind) in unter 3 ms pro 20-ms-Frame sowie Nahfeld-Schwellwert (unter 250 Hz), damit nur der Sprecher direkt am Mikrofon erfasst wird.",
              ],
              [
                "2. Phoneme & Silben",
                "wav2vec2 S2P + Sonoritäts-Syllabifier",
                "CTC-Phonemerkennung inklusive Wortgrenzen über Blank-Frames (ab 80 ms) und deterministische Zerlegung des IPA-Stroms in gesprochene Silben.",
              ],
              [
                "3. Silben-Transducer",
                "Lokales 3-Silben-Fenster (ByT5-Small)",
                "Übersetzt jeweils ein Fenster aus 3 Silben [Vorgänger | Zielsilbe | Nachfolger] parallel in die geschriebenen Buchstaben der mittleren Silbe.",
              ],
              [
                "4. Refiner & Gate",
                "Komposita-Merger + Levenshtein-Gate",
                "Fügt deutsche Komposita zusammen, gleicht Fachfremdwörter über ein phonetisches Anker-Lexikon ab und blockiert jede Abweichung vom Audio.",
              ],
              [
                "5. Klinischer Extraktor",
                "Ambient Clinical Extractor (GBNF)",
                "Filtert Smalltalk heraus und extrahiert strukturierte Vitalwerte, Medikamente und cABCDE-Befunde mit wörtlichem Zitat-Beleg.",
              ],
            ],
            en: [
              [
                "1. Audio frontend",
                "DeepFilterNet3 / GTCRN + Silero-VAD",
                "Real-time denoising (siren, engine, wind) in under 3 ms per 20 ms frame plus a low-frequency near-field gate (below 250 Hz) so only the speaker right at the microphone is captured.",
              ],
              [
                "2. Phonemes & syllables",
                "wav2vec2 S2P + sonority syllabifier",
                "CTC phoneme recognition including word boundaries from blank frames (80 ms or more) and deterministic splitting of the IPA stream into spoken syllables.",
              ],
              [
                "3. Syllable transducer",
                "Local 3-syllable window (ByT5-Small)",
                "Translates a sliding window of 3 syllables [left | target | right] in parallel into the written letters of the middle syllable.",
              ],
              [
                "4. Refiner & gate",
                "Compound merger + Levenshtein gate",
                "Joins German compounds, matches foreign clinical terms against a phonetic anchor lexicon and blocks any deviation from the audio.",
              ],
              [
                "5. Clinical extractor",
                "Ambient Clinical Extractor (GBNF)",
                "Filters out operational chatter and extracts structured vitals, medications and cABCDE findings backed by a verbatim source quote.",
              ],
            ],
          },
        },
        {
          type: "h",
          text: {
            de: "Warum genau ein 3-Silben-Fenster?",
            en: "Why a 3-syllable window?",
          },
        },
        {
          type: "list",
          items: {
            de: [
              '**Deterministische Silbentrennung ohne Wörterbuch.** Nach dem **Sonoritätsprinzip** (genau ein Vokalkern pro Silbe) und dem **Maximal-Onset-Prinzip** schneidet ein Algorithmus den IPA-Strom rein regelbasiert in gesprochene Silben (`/ʃp a n/ · /ʊ ŋ s/ · /p n ɔø/ · /m oː/ · /t oː/ · /r a k s/`).',
              "**Lokale Rechtschreibung statt Satz-Raten.** Ob ein kurzer Vokal eine Konsonantenverdopplung (`nn`, `mm`, `ck`), eine Auslautverhärtung (`d/t`) oder eine griechische Wurzel wie `pneu` oder `tho` verlangt, entscheidet sich allein durch den Blick auf die linke und rechte Nachbarsilbe.",
              '**Technischer Ausschluss von Satz-Halluzinationen.** Weil der Transducer zu keinem Zeitpunkt mehr als 15 bis 20 Phoneme (3 Silben) auf einmal sieht, verliert er auch in langen Funksprüchen nie die Spur und kann keine fremden Wörter wie *"Pazifischer Ozean"* erfinden. Alle Silben laufen gleichzeitig in **5 bis 8 Millisekunden** durch.',
              "**Training ohne Patienten-Audio.** Da der Transducer nur IPA-Silbentripel in Buchstaben überträgt, trainieren wir ihn komplett auf synthetisch erzeugten medizinischen Text-zu-IPA-Paaren.",
            ],
            en: [
              "**Deterministic syllabification without a dictionary.** Following the **Sonority Sequencing Principle** (exactly one vowel nucleus per syllable) and the **Maximal Onset Principle**, an algorithm cuts the IPA stream into spoken syllables purely by phonological rules (`/ʃp a n/ · /ʊ ŋ s/ · /p n ɔø/ · /m oː/ · /t oː/ · /r a k s/`).",
              "**Local spelling instead of sentence guessing.** Deciding whether a short vowel requires German consonant doubling (`nn`, `mm`, `ck`), final devoicing (`d/t`) or a Greek root like `pneu` or `tho` only requires seeing the immediate left and right neighbour syllable.",
              '**Sentence hallucinations excluded by design.** Because the transducer never sees more than 15 to 20 phonemes (3 syllables) at once, it never loses attention across long radio calls and cannot invent phrases like *"Pacific Ocean"*. All syllables run in parallel in **5 to 8 milliseconds**.',
              "**Training without patient audio.** Since the transducer only maps IPA syllable triples to letters, we train it entirely on synthetic clinical text-to-IPA pairs.",
            ],
          },
        },
      ],
    },
    {
      id: "phonetisches-gate-und-extraktion",
      title: {
        de: "Phonetisches Sicherheits-Gate & klinische Extraktion",
        en: "Phonetic safety gate & clinical extraction",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Nach der Silben-Rekonstruktion steht ein lautgetreuer Rohtext bereit. Deutsche Komposita wie `Spannungspneumothorax` stimmen bereits Buchstabe für Buchstabe, während entlehnte Fremdwörter zunächst lautnah als `Turnikee` oder `Amjodaron` auftauchen. Jetzt greifen Modul 4 und 5.",
            en: "After syllable reconstruction, a phonetically faithful raw text is ready. German compounds like `Spannungspneumothorax` already match letter for letter, while borrowed clinical terms initially appear in phonetic spelling such as `Turnikee` or `Amjodaron`. Now modules 4 and 5 take over.",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Komposita-Fusion & Phonetisches Anker-Lexikon (Stufe 4A & 4B).** Ein deterministischer Merger verbindet getrennte deutsche Wortstämme an Fugenmorphemen (`-s-`, `-ungs-`, `-ions-`). Danach gleicht ein erweiterbares **Anker-Lexikon** (`medical_lexicon.txt`) phonetisch geschriebene Fremdwörter über ihre artikulatorische IPA-Ähnlichkeit (ab 82 Prozent Übereinstimmung) ab und korrigiert `Turnikee` zu **Tourniquet**, `Amjodaron` zu **Amiodaron** oder `Tachikardie` zu **Tachykardie**, ohne dass ein neuronales Modell neu trainiert werden muss.",
              "**Das Phonetische Levenshtein-Gate (Stufe 4C).** Ein kleiner Grammatik-Refiner korrigiert Groß- und Kleinschreibung, Zahlen (`80/40 mmHg`, `0,5 mg`) sowie Endungen (`ein` zu `einen`) unter einer harten Bedingung, bei der jedes geänderte Wort zurück in IPA-Phoneme übersetzt und bei mehr als **20 Prozent** Abweichung vom gehörten Audio-Phonemstrom sofort blockiert wird. Sinkt die akustische Konfidenz im Originalton unter `0,45`, gibt das System sichtbar **`[UNSICHER: ...]`** aus.",
              '**Ambient Clinical Extraction mit Zitat-Nachweis (Modul 5).** Im durchlaufenden Einsatzbetrieb trennt der Extraktor Einsatzgespräche (*"Gib mir mal die Schere"*) von medizinischen Fakten (cABCDE, Vitalwerte, Medikamente), verlangt für jeden Eintrag ein wörtliches **`source_quote`** aus dem geprüften Transkript und kennzeichnet Verneinungen (*"keine Allergien"*, *"keine Antikoagulation"*) ausdrücklich als **`status: "verneint"`**.',
            ],
            en: [
              "**Compound fusion & phonetic anchor lexicon (Stages 4A & 4B).** A deterministic merger joins split German stems at linking morphemes (`-s-`, `-ungs-`, `-ions-`). Next, an extensible **anchor lexicon** (`medical_lexicon.txt`) matches phonetically spelled loanwords by articulatory IPA similarity (82 percent threshold or higher) and corrects `Turnikee` to **Tourniquet**, `Amjodaron` to **Amiodaron** or `Tachikardie` to **Tachykardie** without retraining any neural model.",
              "**The Phonetic Levenshtein Gate (Stage 4C).** A lightweight grammar refiner fixes casing, numbers (`80/40 mmHg`, `0.5 mg`) and inflections (`ein` to `einen`) under a strict mathematical rule where every edited word is converted back into IPA phonemes and blocked if it deviates by more than **20 percent** from the acoustic phoneme stream. When acoustic confidence drops below `0.45`, the system outputs an explicit **`[UNSICHER: ...]`** marker.",
              '**Ambient clinical extraction with quote proof (Module 5).** During continuous ambient listening, the extractor separates operational smalltalk (*"Pass me the shears"*) from clinical facts (cABCDE, vitals, medications), requires a verbatim **`source_quote`** substring from the verified transcript for every item and marks negations (*"no allergies"*, *"no anticoagulation"*) explicitly as **`status: "verneint"`**.',
            ],
          },
        },
        {
          type: "link",
          href: "../demo/asr/",
          label: {
            de: "ASR-Pipeline-Demo öffnen",
            en: "Open ASR pipeline demo",
          },
        },
      ],
    },
  ],
};
