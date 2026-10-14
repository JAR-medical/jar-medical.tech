// Train 2: "Praxistraining: Sichtungstrupp am Patienten" (DE + EN)
export default {
  id: "training-ar-trupp",
  version: 1,
  section: "train",
  icon: "helmet",
  title: {
    de: "Praxistraining: Sichtungstrupp am Patienten",
    en: "Field Training: Triage Team at the Patient",
  },
  subtitle: {
    de: "mSTaRT-Sprachsteuerung, Körpermodell und Rollenwechsel",
    en: "mSTaRT voice control, body model and task switching",
  },
  summary: {
    de: "Kompaktes Praxistraining für Einsatzkräfte im Sichtungstrupp: Sie trainieren die freihändige Vorsichtung per Sprache und Papier-Armband, das Dokumentieren am 13-Regionen-Körpermodell sowie die sichere Kartenzuweisung in Übungen.",
    en: "Compact hands-on training for triage team responders: practice hands-free pre-triage by voice and paper wristband, documenting injuries on the 13-region body model, and safe tag assignment during exercises.",
  },
  audience: {
    de: "Für Sanitäterinnen, Sanitäter, Notfallsanitäter und Sichtungstrupps vor einer praktischen Übung mit J.A.R.",
    en: "For EMTs, paramedics and triage teams preparing for a practical exercise with J.A.R.",
  },
  minutes: 18,
  lessons: [
    {
      id: "freihaendige-vorsichtung",
      title: {
        de: "Freihändige Vorsichtung per Sprache & Armband",
        en: "Hands-free pre-triage by voice & wristband",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Am Patienten gehören beide Hände zur Versorgung – etwa zum Stillen einer kritischen Blutung oder zum Freimachen der Atemwege. Deshalb lässt sich der mSTaRT-Fragebogen im AR-Client komplett freihändig bedienen.",
            en: "At the patient, both hands belong on patient care – such as stopping critical bleeding or clearing the airway. The mSTaRT questionnaire in the AR client can therefore be operated completely hands-free.",
          },
        },
        {
          type: "table",
          head: {
            de: ["Bedienweg", "Kommandos / Felder", "Wann ideal?"],
            en: ["Input method", "Commands / fields", "When ideal?"],
          },
          rows: {
            de: [
              ["Sprachsteuerung", "„ja“, „nein“, „zurück“, „weiter“", "beide Hände am Patienten, normale Umgebungslautstärke"],
              ["Papier-Armband (ArUco)", "Ja, Nein, Zurück, Patient, Tätigkeit, Lagebild", "starker Umgebungslärm an der Schadensstelle"],
              ["Blick + Verweilen (1,1 s)", "Fadenkreuz in der Blickmitte", "auf der PICO 4 ohne Controller"],
            ],
            en: [
              ["Voice control", "“ja”, “nein”, “zurück”, “weiter” (yes, no, back, next)", "both hands on the patient, moderate ambient noise"],
              ["Paper wristband (ArUco)", "Yes, No, Back, Patient, Task, Operating picture", "high ambient noise at the incident scene"],
              ["Gaze + dwell (1.1 s)", "crosshair in the centre of view", "on PICO 4 without controllers"],
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Welche vier Sprachbefehle steuern den mSTaRT-Fragebogen in der Vorsichtung?",
            en: "Which four voice commands drive the mSTaRT questionnaire during pre-triage?",
          },
          options: [
            { de: "„ja“, „nein“, „zurück“ und „weiter“", en: "“ja”, “nein”, “zurück” and “weiter” (yes, no, back, next)" },
            { de: "„rot“, „gelb“, „grün“ und „blau“", en: "“red”, “yellow”, “green” and “blue”" },
            { de: "„Start“, „Stopp“, „Speichern“ und „Löschen“", en: "“start”, “stop”, “save” and “delete”" },
          ],
          answer: 0,
          explain: {
            de: "Die sechs mSTaRT-Fragen sind Ja/Nein-Entscheidungen und werden mit „ja“, „nein“, „zurück“ und „weiter“ gesteuert.",
            en: "The six mSTaRT questions are yes/no decisions driven by “ja”, “nein”, “zurück” and “weiter”.",
          },
        },
      ],
    },
    {
      id: "koerpermodell-und-karte",
      title: {
        de: "13-Regionen-Körpermodell & Umhängekarte",
        en: "13-region body model & hanging tag",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Verletzungen werden direkt an der betroffenen Region des dreidimensionalen Körpermodells eingetragen und stehen danach jedem nachfolgenden Trupp über dem Patientenmarker zur Verfügung.",
            en: "Injuries are recorded directly on the affected region of the 3D body model and then appear above the patient marker for every subsequent team.",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Region antippen:** Wählen Sie eine der 13 Körperregionen am Modell aus.",
              "**Befund setzen:** Wählen Sie zwischen **Blutung, Fraktur, Wunde, Verbrennung, Prellung oder Amputation** (erneutes Antippen entfernt den Befund).",
              "**Umhängekarte zuletzt zuweisen:** Erst sichten, dann die gedruckte QR-Umhängekarte umhängen und per Kamera-Scan oder **−/+** zuweisen.",
            ],
            en: [
              "**Tap region:** select one of the 13 body regions on the model.",
              "**Set finding:** choose between **bleeding, fracture, wound, burn, contusion or amputation** (tapping again removes it).",
              "**Assign hanging tag last:** triage first, then hang the printed QR tag and assign its number via camera scan or **−/+**.",
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Was verhindert der AR-Client beim Zuweisen einer bereits vergebenen Umhängekarten-Nummer?",
            en: "What does the AR client prevent when assigning a hanging-tag number that is already in use?",
          },
          options: [
            { de: "Er bucht die Karte niemals stillschweigend auf einen zweiten Patienten um.", en: "It never silently moves the tag to a second patient." },
            { de: "Er löscht beide Patienten automatisch.", en: "It automatically deletes both patients." },
            { de: "Er vergibt beiden Patienten dieselbe Nummer.", en: "It assigns the same number to both patients." },
          ],
          answer: 0,
          explain: {
            de: "Jede physische Umhängekarte darf nur an genau einem Patienten hängen.",
            en: "Each physical hanging tag may belong to only one patient.",
          },
        },
      ],
    },
    {
      id: "checkliste-uebung",
      title: {
        de: "Checkliste vor Übungsbeginn",
        en: "Pre-exercise checklist",
      },
      minutes: 6,
      blocks: [
        {
          type: "list",
          items: {
            de: [
              "**Umhängekarten & Armband matt und in Originalgröße (100 %) drucken:** Glanzpapier spiegelt, Skalierung verändert die ArUco-Markergröße.",
              "**Brille auf Sitz-/Stationärmodus stellen:** Verhindert, dass das Headset mitten auf dem Übungsgelände nach einer Spielflächen-Begrenzung fragt.",
              "**Richtige Tätigkeit wählen:** Vorsichtung, ärztliche Sichtung, Registrierung oder Behandlung & Transport.",
              "**Papier-Sichtungskarte parallel mitführen:** In jeder Übung bleibt die klassische Karte die verbindliche Rückfallebene.",
            ],
            en: [
              "**Print hanging tags & wristband matte at 100 % scale:** glossy paper reflects, scaling alters the ArUco marker dimensions.",
              "**Set headset to stationary/seated mode:** prevents play-area boundary prompts on the exercise ground.",
              "**Pick the right task role:** pre-triage, physician triage, registration, or treatment & transport.",
              "**Carry paper triage tags alongside:** in every exercise, standard paper tags remain the mandatory fallback.",
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Warum müssen Umhängekarten und das Papier-Armband auf mattem Papier ohne Skalierung gedruckt werden?",
            en: "Why must hanging tags and the paper wristband be printed on matte paper without scaling?",
          },
          options: [
            { de: "Weil Glanzpapier spiegelt und eine Skalierung die exakte Markergröße für die Kameraerkennung verfälscht", en: "Because glossy paper reflects and scaling distorts the exact marker size needed for camera recognition" },
            { de: "Weil Drucker sonst keine QR-Codes drucken können", en: "Because printers cannot print QR codes otherwise" },
            { de: "Nur aus optischen Gründen", en: "Purely for visual appearance" },
          ],
          answer: 0,
          explain: {
            de: "Spiegelungen und falsche Abmessungen verhindern die zuverlässige optische Erkennung der Marker.",
            en: "Reflections and altered dimensions prevent reliable optical marker detection.",
          },
        },
      ],
    },
  ],
};
