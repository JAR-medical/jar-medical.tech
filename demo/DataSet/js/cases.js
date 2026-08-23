export {
  ACTION_CATALOG,
  ALLERGY_CATALOG,
  CASE_PROFILE_RULES,
  HISTORY_CATALOG,
  INJURY_CATALOG,
  MEDICATION_CATALOG,
  createSeededRandom,
  randomSeed,
  randomizeCase,
} from "./scenario_data.js";

const OXYGEN_SYNONYMS = [
  "Sauerstoff",
  "Sauerstoffgabe",
  "O2",
  "Sauerstoff nasal",
  "Sauerstoffmaske",
  "oxygen",
];

const TRANSPORT_SYNONYMS = [
  "Zielklinik",
  "Klinik",
  "Krankenhaus",
  "Verlegung",
  "transportieren",
  "Transport",
  "hospital",
  "transfer",
];

export const CASES = [
  {
    id: "stemi",
    title_de: "STEMI — Herzinfarkt",
    title_en: "STEMI — Heart Attack",
    names: ["Helmut Brandt", "Ingrid Falk", "Günther Weiss"],
    ageRange: [54, 82],
    severity: "rot",
    story_de:
      "Ein Mann klammert sich am Gartenzaun fest, presst die Faust auf die Brust und ist kreidebleich.",
    symptoms: [
      { de: "Starke brennende Brustschmerzen hinter dem Sternum", en: "Crushing chest pain behind the sternum" },
      { de: "Kaltschweißigkeit, blasse Haut", en: "Cold sweat, pale skin" },
      { de: "Schmerzausstrahlung in linken Arm und Kiefer", en: "Radiating pain to left arm and jaw" },
      { de: "Übelkeit mit Todesangst", en: "Nausea with fear of death" },
    ],
    vitals: { RR: "160/95 mmHg", HF: "102 /min", SpO2: "94 %", BZ: "112 mg/dl", GCS: "15" },
    required: [
      {
        key: "ecg",
        label_de: "12-Kanal-EKG",
        label_en: "12-lead ECG",
        any: [
          "12-Kanal-EKG",
          "EKG",
          "12-Kanal",
          "ECG",
          "12 channel ECG",
          "zwölf-Kanal-EKG",
          "Ruhe-EKG",
          "EkG-Ableitung",
        ],
      },
      { key: "oxygen", label_de: "Sauerstoffgabe", label_en: "Oxygen administration", any: OXYGEN_SYNONYMS },
      {
        key: "analgesia_nitro",
        label_de: "Nitroglycerin oder Analgesie",
        label_en: "Nitroglycerin or analgesia",
        any: [
          "Nitroglycerin",
          "Nitro",
          "Nitrospray",
          "Morphin",
          "Piritramid",
          "Analgesie",
          "Schmerzmittel",
          "nitroglycerin",
          "morphine",
          "nitro spray",
          "Metroglucurin",
          "Netroglucerin",
        ],
      },
      { key: "transport", label_de: "Zielklinik / Transport", label_en: "Destination hospital", any: TRANSPORT_SYNONYMS },
    ],
    forbidden: [],
    hint_de:
      "Der Patient hat starke Brustschmerzen mit Kaltschweißigkeit, ich mache ein 12-Kanal-EKG, gebe Sauerstoff und Nitroglycerin und verlege ihn in die Zielklinik.",
  },
  {
    id: "anaphylaxie",
    title_de: "Anaphylaktischer Schock",
    title_en: "Anaphylactic Shock",
    names: ["Melanie Hartmann", "Sabine Roth", "Lena Vogel"],
    ageRange: [16, 64],
    severity: "rot",
    story_de:
      "Nach einem Wespenstich schwillt das Gesicht einer Frau auf dem Wochenmarkt, sie keucht um Luft.",
    symptoms: [
      { de: "Gesichtsschwellung und Lippenödem", en: "Facial swelling, lip edema" },
      { de: "Quaddeln und Juckreiz am ganzen Körper", en: "Generalized wheals and itching" },
      { de: "Stridor und Atemnot", en: "Stridor and dyspnea" },
      { de: "Hypotonie mit schneller Pulsfrequenz", en: "Hypotension with tachycardia" },
    ],
    vitals: { RR: "85/50 mmHg", HF: "128 /min", SpO2: "91 %", BZ: "104 mg/dl", GCS: "14" },
    required: [
      {
        key: "adrenaline_im",
        label_de: "Adrenalin intramuskulär",
        label_en: "Intramuscular adrenaline",
        any: [
          "Adrenalin",
          "Suprarenin",
          "i.m.",
          "intramuskulär",
          "intramuscular",
          "adrenaline",
          "epinephrine",
          "Abermali in",
          "Abermalin",
        ],
      },
      { key: "oxygen", label_de: "Sauerstoffgabe", label_en: "Oxygen administration", any: OXYGEN_SYNONYMS },
      {
        key: "volume",
        label_de: "Volumengabe",
        label_en: "Fluid resuscitation",
        any: ["Volumengabe", "Infusion", "Ringer", "Volumen", "fluids", "infusion", "Volumenersatz"],
      },
      {
        key: "antihistamine_steroid",
        label_de: "Antihistaminikum und Kortikosteroid",
        label_en: "Antihistamine and corticosteroid",
        any: [
          "Prednisolon",
          "Cortison",
          "Kortison",
          "Antihistaminikum",
          "Tavegil",
          "Fenistil",
          "prednisolone",
          "antihistamine",
          "Predisolon",
        ],
      },
    ],
    forbidden: [
      {
        key: "metamizol_trap",
        label_de: "Metamizol bei Anaphylaxie",
        label_en: "Metamizole in anaphylaxis",
        any: ["Metamizol", "Novalgin", "metamizol"],
      },
    ],
    hint_de:
      "Nach dem Wespenstich sind das Gesicht geschwollen und Stridor hörbar, ich gebe Adrenalin intramuskulär, Sauerstoff, eine Ringer-Infusion als Volumengabe und Prednisolon mit einem Antihistaminikum.",
  },
  {
    id: "hypoglykaemie",
    title_de: "Hypoglykämie",
    title_en: "Hypoglycemia",
    names: ["Willi Steiner", "Edith Sommer", "Kurt Baumann"],
    ageRange: [45, 85],
    severity: "gelb",
    story_de:
      "Ein älterer Mann sitzt verwirrt vor dem Supermarkt, sein Hemd ist vom kalten Schweiß durchnässt.",
    symptoms: [
      { de: "Verwirrtheit, desorientiert zu Ort und Zeit", en: "Confusion, disoriented to place and time" },
      { de: "Kalter Schweiß mit Tremor", en: "Cold sweat with tremor" },
      { de: "Heißhunger und Übelkeit", en: "Intense hunger and nausea" },
      { de: "Lispelnde Sprachstörung, aber ansprechbar", en: "Slurred speech, yet responsive" },
    ],
    vitals: { RR: "110/70 mmHg", HF: "96 /min", SpO2: "98 %", BZ: "38 mg/dl", GCS: "13" },
    required: [
      {
        key: "bz_check",
        label_de: "BZ-Messung",
        label_en: "Blood glucose measurement",
        any: ["BZ", "Blutzucker", "Blutzuckermessung", "blood sugar", "blutzucker messen", "BZ Wert", "BZ Messgerät"],
      },
      {
        key: "glucose_admin",
        label_de: "Glucose verabreichen",
        label_en: "Glucose administration",
        any: ["Glucose", "Glukose", "Traubenzucker", "Dextrose", "glucose", "dextrose", "Traubenzucker geben"],
      },
      {
        key: "recheck_monitor",
        label_de: "Kontrolle und Monitoring",
        label_en: "Recheck and monitoring",
        any: ["kontrollieren", "Kontrolle", "Monitoring", "Monitor", "recheck", "monitor", "kontrolle durchführen"],
      },
    ],
    forbidden: [
      {
        key: "insulin_trap",
        label_de: "Insulin ohne BZ-Kontrolle",
        label_en: "Insulin without glucose control",
        any: ["Insulin", "insulin"],
      },
    ],
    hint_de:
      "Die BZ-Messung zeigt 38 Milligramm, der Patient ist verwirrt und schwitzt kalt, ich gebe Traubenzucker und Glukose und kontrolliere danach Monitoring und BZ erneut.",
  },
  {
    id: "asthma",
    title_de: "Asthmaanfall",
    title_en: "Asthma Attack",
    names: ["Jonas Lehmann", "Mia Schneider", "Tim Krause"],
    ageRange: [12, 34],
    severity: "gelb",
    story_de:
      "Ein Jugendlicher sitzt auf der Tribüne des Sportplatzes, keuchend mit trichternder Brust.",
    symptoms: [
      { de: "Exspiratorisches Giemen über beiden Lungen", en: "Expiratory wheezing over both lungs" },
      { de: "Verlängerte Ausatmung mit Einsatz der Hilfsmuskulatur", en: "Prolonged expiration with accessory muscle use" },
      { de: "Milde Zyanose der Lippen", en: "Mild cyanosis of the lips" },
      { de: "Sprechdyspnoe und Unruhe", en: "Broken speech and agitation" },
    ],
    vitals: { RR: "145/90 mmHg", HF: "118 /min", SpO2: "93 %", BZ: "95 mg/dl", GCS: "15" },
    required: [
      {
        key: "salbutamol",
        label_de: "Salbutamol inhaliert",
        label_en: "Salbutamol inhalation",
        any: [
          "Salbutamol",
          "Sultanol",
          "Bronchodilatator",
          "Inhalator",
          "salbutamol",
          "inhaler",
          "Salbutomal",
          "Salbutamol Spray",
        ],
      },
      {
        key: "steroid_pred",
        label_de: "Kortikosteroid (Prednisolon)",
        label_en: "Corticosteroid",
        any: ["Prednisolon", "Cortison", "Kortison", "prednisolone", "steroid", "Prenisolon", "Decortin"],
      },
      { key: "oxygen", label_de: "Sauerstoffgabe", label_en: "Oxygen administration", any: OXYGEN_SYNONYMS },
    ],
    forbidden: [
      {
        key: "sedation_trap",
        label_de: "Sedierung bei Asthmaanfall",
        label_en: "Sedation in asthma attack",
        any: ["Midazolam", "Diazepam", "Dormicum", "sedieren", "Sedierung", "sedation"],
      },
    ],
    hint_de:
      "Der Patient giemt exspiratorisch, ich verabreiche Salbutamol über den Inhalator, gebe dazu Sauerstoff und Prednisolon zur Behandlung des Asthmaanfalls.",
  },
  {
    id: "opioid",
    title_de: "Opioidintoxikation",
    title_en: "Opioid Overdose",
    names: ["Marco Delgado", "Kevin Scholz", "Aylin Yildiz"],
    ageRange: [18, 42],
    severity: "rot",
    story_de:
      "Auf der Parkbank liegt ein junger Mann reglos, seine Pupillen sind stecknadelfein.",
    symptoms: [
      { de: "Atemfrequenz 6/min, oberflächliche Atmung", en: "Respiratory rate 6/min, shallow breathing" },
      { de: "Stecknadelpfeilgroße Pupillen (Miosis)", en: "Pinpoint pupils (miosis)" },
      { de: "Bewusstlos ohne Schutzreflexe", en: "Unconscious without protective reflexes" },
      { de: "Zyanotische Lippen", en: "Cyanotic lips" },
    ],
    vitals: { RR: "90/55 mmHg", HF: "58 /min", SpO2: "78 %", BZ: "82 mg/dl", GCS: "6" },
    required: [
      {
        key: "ventilation",
        label_de: "Beatmung",
        label_en: "Ventilation",
        any: [
          "Beatmung",
          "beatmen",
          "Beatmungsbeutel",
          "Beutel-Maske",
          "Bag-Mask",
          "ventilate",
          "ventilation",
          "beatme",
        ],
      },
      {
        key: "naloxone",
        label_de: "Naloxon",
        label_en: "Naloxone",
        any: ["Naloxon", "Narcanti", "naloxone", "Antidot", "Naloxongabe", "Naloxen"],
      },
      {
        key: "airway",
        label_de: "Atemwegssicherung",
        label_en: "Airway management",
        any: [
          "Atemweg",
          "Atemwege",
          "Atemwegssicherung",
          "Esmarch",
          "Guedel",
          "airway",
          "head tilt",
          "Guedeltubus",
        ],
      },
    ],
    forbidden: [],
    hint_de:
      "Der Patient atmet nur sechsmal pro Minute mit stecknadelpfeilgroßen Pupillen, ich sichere die Atemwege mit dem Esmarch, beatme mit dem Beatmungsbeutel und gebe Naloxon.",
  },
  {
    id: "epilepsie",
    title_de: "Status epilepticus",
    title_en: "Status Epilepticus",
    names: ["Claudia Winter", "Petra Novak", "Anna Lindner"],
    ageRange: [14, 58],
    severity: "rot",
    story_de:
      "Vor der Bäckerei zuckt eine Frau seit über acht Minuten generalisiert, Schaum steht ihr vor dem Mund.",
    symptoms: [
      { de: "Generalisierter tonisch-klonischer Krampfanfall", en: "Generalized tonic-clonic seizure" },
      { de: "Anfalldauer über 8 Minuten", en: "Seizure duration over 8 minutes" },
      { de: "Zungenbiss mit Schaum vor dem Mund", en: "Tongue bite with foaming at the mouth" },
      { de: "Zyanose und Einnässen", en: "Cyanosis and urinary incontinence" },
    ],
    vitals: { RR: "150/92 mmHg", HF: "124 /min", SpO2: "89 %", BZ: "90 mg/dl", GCS: "7" },
    required: [
      {
        key: "benzo",
        label_de: "Benzodiazepin",
        label_en: "Benzodiazepine",
        any: [
          "Diazepam",
          "Midazolam",
          "Dormicum",
          "Benzodiazepin",
          "Lorazepam",
          "diazepam",
          "midazolam",
          "benzo",
          "Midazolan",
          "Diazepan",
        ],
      },
      {
        key: "recovery_position",
        label_de: "Stabile Seitenlage",
        label_en: "Recovery position",
        any: ["Schutzposition", "Seitenlage", "stabile Seitenlage", "recovery position", "Seitenlagerung"],
      },
      { key: "oxygen", label_de: "Sauerstoffgabe", label_en: "Oxygen administration", any: OXYGEN_SYNONYMS },
    ],
    forbidden: [],
    hint_de:
      "Generalisierter Krampfanfall seit über acht Minuten, ich bringe den Patienten in die stabile Seitenlage, gebe Sauerstoff und verabreiche Midazolam als Benzodiazepin.",
  },
  {
    id: "bradykardie",
    title_de: "Bradykarde Rhythmusstörung",
    title_en: "Bradycardia",
    names: ["Alfred Huber", "Margarete Fuchs", "Heinz Lorenz"],
    ageRange: [66, 92],
    severity: "gelb",
    story_de:
      "Ein Rentner ist beim Spaziergang kollabiert, jetzt ist er wieder wach, aber blass und schwindlig.",
    symptoms: [
      { de: "Synkope mit kurzem Bewusstseinsverlust", en: "Syncope with brief loss of consciousness" },
      { de: "Regelmäßiger langsamer Puls 34/min", en: "Regular slow pulse 34 bpm" },
      { de: "Schwindel und Übelkeit", en: "Dizziness and nausea" },
      { de: "Kalte Extremitäten", en: "Cold extremities" },
    ],
    vitals: { RR: "105/65 mmHg", HF: "34 /min", SpO2: "97 %", BZ: "88 mg/dl", GCS: "15" },
    required: [
      { key: "atropine", label_de: "Atropin", label_en: "Atropine", any: ["Atropin", "atropine", "Atropingabe", "Atropim"] },
      {
        key: "rhythm_monitoring",
        label_de: "Rhythmusüberwachung / EKG",
        label_en: "Rhythm monitoring / ECG",
        any: ["Monitoring", "EKG", "12-Kanal-EKG", "Monitor", "Rhythmus", "monitor", "ecg"],
      },
      {
        key: "iv_access",
        label_de: "Venenzugang",
        label_en: "IV access",
        any: ["Venenzugang", "i.v.", "Zugang", "iv access", "zugang legen", "intravenös"],
      },
    ],
    forbidden: [],
    hint_de:
      "Nach der Synkope höre ich eine Bradykardie mit 34 Schlägen, ich lege einen Venenzugang, starte Monitoring mit EKG und bereite Atropin vor.",
  },
  {
    id: "polytrauma",
    title_de: "Polytrauma nach Sturz",
    title_en: "Polytrauma after Fall",
    names: ["Daniel Berger", "Tomasz Nowak", "Lukas Hofer"],
    ageRange: [22, 60],
    severity: "rot",
    story_de:
      "Nach Sturz von der Leiter liegt ein Bauarbeiter mit offenem Unterschenkelbruch in einem Blutlack.",
    symptoms: [
      { de: "Offene Unterschenkelfraktur mit arterieller Blutung", en: "Open lower-leg fracture with arterial bleeding" },
      { de: "Stärkste Schmerzen NRS 9", en: "Severe pain NRS 9" },
      { de: "Blasse kalte Haut, verzögerte kapilläre Füllung", en: "Pale cold skin, delayed capillary refill" },
      { de: "Prellmarken an Brustkorb und Hüfte", en: "Contusions to chest and hip" },
    ],
    vitals: { RR: "70/40 mmHg", HF: "130 /min", SpO2: "95 %", BZ: "138 mg/dl", GCS: "14" },
    required: [
      {
        key: "tourniquet_bleeding_control",
        label_de: "Blutstillung / Tourniquet",
        label_en: "Bleeding control / tourniquet",
        any: ["Tourniquet", "Abbinden", "Druckverband", "Blutstillung", "tourniquet", "Abbindung"],
      },
      {
        key: "volume_keto",
        label_de: "Volumengabe (Ringer)",
        label_en: "Volume therapy (Ringer's)",
        any: ["Volumengabe", "Infusion", "Ringer-Acetat", "Ringer", "Volumen", "fluids"],
      },
      {
        key: "analgesia_esketamine",
        label_de: "Analgesie mit Esketamin",
        label_en: "Esketamine analgesia",
        any: ["Esketamin", "Ketamin", "Ketanest", "esketamine", "ketamine", "Es Ketamin", "Analgesie"],
      },
      {
        key: "immobilisation",
        label_de: "Immobilisation",
        label_en: "Immobilisation",
        any: [
          "Immobilisation",
          "Schiene",
          "Vakuummatratze",
          "Spineboard",
          "splint",
          "immobilize",
          "immobilisieren",
          "Vakuumschiene",
        ],
      },
    ],
    forbidden: [
      {
        key: "morphine_shock_trap",
        label_de: "Morphin im Schockzustand",
        label_en: "Morphine in shock",
        any: ["Morphin", "morphine"],
      },
    ],
    hint_de:
      "Sturz mit offener Unterschenkelfraktur und arterieller Blutung, ich setze ein Tourniquet zur Blutstillung, gebe Ringer-Acetat als Volumengabe, Esketamin gegen Schmerzen und immobilisiere mit einer Schiene.",
  },
];

// Two reports that say the same thing must compare as the same thing. A medic
// who says "500 Milligramm" and one who writes "500 mg" performed one identical
// treatment, and neither the required-item detector nor the accuracy score may
// punish the choice. Everything below is written the long way round: the
// abbreviation, the spoken form and the symbol all fold onto one canonical
// token, so the comparison never sees the difference.
//
// Only spellings of the *same* term belong here. Two different drugs, or a drug
// and its class, stay distinct — those live in a case's `any` synonym list,
// where a case author decides what counts.

// Multi-token forms first: normalizeText has already turned "i.v." into "i v",
// so the dotted abbreviations arrive here as separate tokens.
const PHRASE_CANON = new Map(Object.entries({
  "i v": "intravenoes",
  "i m": "intramuskulaer",
  "i o": "intraossaer",
  "i n": "intranasal",
  "s c": "subkutan",
  "s l": "sublingual",
  "p o": "peroral",
  "z n": "zustand nach",
  "v a": "verdacht auf",
  "n a": "notarzt",
  "mm hg": "millimeter quecksilbersaeule",
  "mmol l": "millimol pro liter",
  "mg dl": "milligramm pro deziliter",
  "mg kg": "milligramm pro kilogramm",
  "ml h": "milliliter pro stunde",
  "l min": "liter pro minute",
  "glasgow coma scale": "gcs",
  "glasgow coma score": "gcs",
}));

// Single tokens. Left side is what someone may write or say, right side is the
// one spelling both sides of every comparison end up using.
const TERM_CANON = new Map(Object.entries({
  // units of mass, volume, dose
  mg: "milligramm",
  milligram: "milligramm",
  milligramme: "milligramm",
  mcg: "mikrogramm",
  ug: "mikrogramm",
  mikrogram: "mikrogramm",
  microgramm: "mikrogramm",
  g: "gramm",
  gr: "gramm",
  kg: "kilogramm",
  kilo: "kilogramm",
  ml: "milliliter",
  cc: "milliliter",
  l: "liter",
  dl: "deziliter",
  ie: "internationale einheiten",
  iu: "internationale einheiten",
  mval: "millival",
  mmol: "millimol",
  mmhg: "millimeter quecksilbersaeule",
  amp: "ampulle",
  ampullen: "ampulle",
  tbl: "tablette",
  tabletten: "tablette",
  hube: "hub",
  huebe: "hub",

  // routes and application
  iv: "intravenoes",
  intravenous: "intravenoes",
  intravenoese: "intravenoes",
  im: "intramuskulaer",
  intramuscular: "intramuskulaer",
  intramuskulaere: "intramuskulaer",
  io: "intraossaer",
  intraosseous: "intraossaer",
  sc: "subkutan",
  subcutan: "subkutan",
  subkutane: "subkutan",
  po: "peroral",
  oral: "peroral",
  nasal: "intranasal",
  buccal: "bukkal",

  // vital signs and findings
  rr: "blutdruck",
  bd: "blutdruck",
  hf: "herzfrequenz",
  hr: "herzfrequenz",
  puls: "herzfrequenz",
  af: "atemfrequenz",
  spo2: "sauerstoffsaettigung",
  sao2: "sauerstoffsaettigung",
  saettigung: "sauerstoffsaettigung",
  etco2: "endexspiratorisches kohlendioxid",
  bz: "blutzucker",
  temp: "temperatur",

  // treatments, devices, services
  o2: "sauerstoff",
  oxygen: "sauerstoff",
  ecg: "ekg",
  elektrokardiogramm: "ekg",
  aed: "defibrillator",
  defi: "defibrillator",
  defibrillation: "defibrillator",
  hws: "halswirbelsaeule",
  bws: "brustwirbelsaeule",
  lws: "lendenwirbelsaeule",
  sht: "schaedel hirn trauma",
  hlw: "reanimation",
  cpr: "reanimation",
  rea: "reanimation",
  zvk: "zentraler venenkatheter",
  rtw: "rettungswagen",
  nef: "notarzteinsatzfahrzeug",
  rth: "rettungshubschrauber",
  kh: "krankenhaus",
  klinik: "krankenhaus",
  zielklinik: "krankenhaus",
  hospital: "krankenhaus",
  pat: "patient",
  patientin: "patient",
  verletzte: "patient",
  verletzter: "patient",

  // number words, so "zwoelf Kanal" and "12 Kanal" are one and the same script
  eins: "1",
  ein: "1",
  eine: "1",
  zwei: "2",
  zwo: "2",
  drei: "3",
  vier: "4",
  fuenf: "5",
  sechs: "6",
  sieben: "7",
  acht: "8",
  neun: "9",
  zehn: "10",
  elf: "11",
  zwoelf: "12",
  zwanzig: "20",
  dreissig: "30",
  vierzig: "40",
  fuenfzig: "50",
  hundert: "100",
  tausend: "1000",
}));

const PHRASE_MAX_TOKENS = Math.max(...[...PHRASE_CANON.keys()].map((key) => key.split(" ").length));

// Symbols die in the character sweep below, so the ones that carry meaning are
// spelled out before they are lost.
function spellSymbols(text) {
  return text
    .replaceAll("µ", "mikro")
    .replaceAll("μ", "mikro")
    .replaceAll("%", " prozent ")
    .replaceAll("‰", " promille ")
    .replaceAll("°", " grad ")
    .replaceAll("&", " und ");
}

// Longest phrase first, so "s p o 2" is not eaten by "p o".
function canonicalizeTokens(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; ) {
    let matched = false;
    for (let span = Math.min(PHRASE_MAX_TOKENS, tokens.length - i); span > 1; span--) {
      const phrase = tokens.slice(i, i + span).join(" ");
      const replacement = PHRASE_CANON.get(phrase);
      if (replacement === undefined) continue;
      out.push(...replacement.split(" "));
      i += span;
      matched = true;
      break;
    }
    if (matched) continue;
    const token = tokens[i];
    const replacement = TERM_CANON.get(token);
    out.push(...(replacement === undefined ? [token] : replacement.split(" ")));
    i += 1;
  }
  return out;
}

export function normalizeText(s) {
  const flattened = spellSymbols(String(s ?? "").toLowerCase())
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  if (!flattened) return "";
  return canonicalizeTokens(flattened.split(" ")).join(" ");
}

export function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n];
}

function fuzzyThreshold(len) {
  if (len >= 9) return 3;
  if (len >= 6) return 2;
  if (len >= 4) return 1;
  return 0;
}

export class ReportParser {
  constructor(caseTemplate) {
    this.caseTemplate = caseTemplate;
  }

  matchesSynonym(padded, tokens, synonym) {
    const s = normalizeText(synonym);
    if (!s) return false;
    // A multi-word synonym may have been spoken as one compound, and a compound
    // synonym may have been heard as two words — "Sauerstoff Gabe" and
    // "Sauerstoffgabe" are the same treatment either way round.
    if (s.includes(" ")) {
      if (padded.includes(` ${s} `)) return true;
      return tokens.includes(s.replaceAll(" ", ""));
    }
    if (tokens.includes(s)) return true;
    const limit = fuzzyThreshold(s.length);
    const glued = [];
    for (let i = 1; i < tokens.length; i++) glued.push(tokens[i - 1] + tokens[i]);
    if (glued.includes(s)) return true;
    if (limit === 0) return false;
    return tokens.some((tok) => levenshtein(s, tok) <= limit) || glued.some((tok) => levenshtein(s, tok) <= limit);
  }

  parse(transcript, performedKeys = []) {
    const required = this.caseTemplate.required || [];
    const forbidden = this.caseTemplate.forbidden || [];
    const performed = new Set(performedKeys);
    const norm = normalizeText(transcript);
    const padded = ` ${norm} `;
    const tokens = norm ? norm.split(" ") : [];

    const matchedKeys = [];
    const missingKeys = [];
    const forbiddenHits = [];

    for (const group of required) {
      if (performed.has(group.key) || (group.any || []).some((syn) => this.matchesSynonym(padded, tokens, syn))) {
        matchedKeys.push(group.key);
      } else {
        missingKeys.push(group.key);
      }
    }
    for (const trap of forbidden) {
      if ((trap.any || []).some((syn) => this.matchesSynonym(padded, tokens, syn))) {
        forbiddenHits.push({ key: trap.key, label_de: trap.label_de, label_en: trap.label_en });
      }
    }

    let verdict;
    if (forbiddenHits.length > 0) verdict = "rejected";
    else if (matchedKeys.length === 0) verdict = "rejected";
    else if (missingKeys.length === 0) verdict = "saved";
    else verdict = "partial";

    const feedback = [];
    if (verdict === "saved") feedback.push("✔ Protokoll erfüllt — Übergabe akzeptiert.");
    for (const hit of forbiddenHits) feedback.push(`✖ Kontraindiziert: ${hit.label_de}!`);
    if (matchedKeys.length === 0 && forbiddenHits.length === 0) {
      feedback.push("Keine verwertbaren Angaben gefunden.");
    }
    for (const key of missingKeys) {
      const group = required.find((g) => g.key === key);
      if (group) feedback.push(`Fehlt: ${group.label_de}`);
    }

    return { verdict, matchedKeys, missingKeys, forbiddenHits, performedKeys: [...performed], feedback };
  }
}
