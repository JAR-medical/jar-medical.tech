export const INJURY_CATALOG = [
  { id: "none", label_de: "Keine zusätzliche sichtbare Verletzung", label_en: "No additional visible injury", finding_de: "keine zusätzliche sichtbare Verletzung", finding_en: "no additional visible injury" },
  { id: "forehead_laceration", label_de: "Platzwunde an der Stirn", label_en: "Forehead laceration", finding_de: "kleine Platzwunde an der Stirn", finding_en: "small forehead laceration" },
  { id: "scalp_laceration", label_de: "Kopfplatzwunde", label_en: "Scalp laceration", finding_de: "blutende Kopfplatzwunde", finding_en: "bleeding scalp laceration" },
  { id: "knee_abrasion", label_de: "Schürfwunde am Knie", label_en: "Knee abrasion", finding_de: "oberflächliche Schürfwunde am Knie", finding_en: "superficial knee abrasion" },
  { id: "wrist_injury", label_de: "Verletzung am Handgelenk", label_en: "Wrist injury", finding_de: "druckschmerzhafte Verletzung am Handgelenk", finding_en: "tender wrist injury" },
  { id: "thorax_contusion", label_de: "Thoraxprellung", label_en: "Chest contusion", finding_de: "druckschmerzhafte Thoraxprellung", finding_en: "tender chest contusion" },
  { id: "rib_contusion", label_de: "Rippenprellung", label_en: "Rib contusion", finding_de: "Rippendruckschmerz nach einem Anprall", finding_en: "rib tenderness after impact" },
  { id: "hip_contusion", label_de: "Hüftprellung", label_en: "Hip contusion", finding_de: "schmerzhafte Hüftprellung", finding_en: "painful hip contusion" },
  { id: "open_tibia_fracture", label_de: "Offene Unterschenkelfraktur", label_en: "Open tibia fracture", finding_de: "offene Unterschenkelfraktur mit Blutung", finding_en: "open lower-leg fracture with bleeding" },
  { id: "closed_tibia_fracture", label_de: "Geschlossene Unterschenkelfraktur", label_en: "Closed tibia fracture", finding_de: "deformierte und schmerzhafte Unterschenkelfraktur", finding_en: "deformed painful lower-leg fracture" },
  { id: "radius_fracture", label_de: "Unterarmfraktur", label_en: "Forearm fracture", finding_de: "fehlgestellte Unterarmfraktur", finding_en: "displaced forearm fracture" },
  { id: "shoulder_dislocation", label_de: "Schulterluxation", label_en: "Shoulder dislocation", finding_de: "fixierte und schmerzhafte Schulterluxation", finding_en: "fixed painful shoulder dislocation" },
  { id: "ankle_sprain", label_de: "Sprunggelenksdistorsion", label_en: "Ankle sprain", finding_de: "geschwollenes Sprunggelenk nach Umknicktrauma", finding_en: "swollen ankle after a twist" },
  { id: "thigh_stab_wound", label_de: "Stichverletzung am Oberschenkel", label_en: "Thigh puncture wound", finding_de: "tiefe Stichverletzung am Oberschenkel", finding_en: "deep thigh puncture wound" },
  { id: "hand_burn", label_de: "Verbrennung an der Hand", label_en: "Hand burn", finding_de: "schmerzhafte Verbrennung an der Hand", finding_en: "painful hand burn" },
  { id: "chemical_burn", label_de: "Verätzung am Unterarm", label_en: "Chemical burn on forearm", finding_de: "oberflächliche Verätzung am Unterarm", finding_en: "superficial chemical burn on the forearm" },
  { id: "insect_sting", label_de: "Wespenstich", label_en: "Wasp sting", finding_de: "sichtbare Stichstelle nach einem Wespenstich", finding_en: "visible sting site after a wasp sting" },
  { id: "animal_bite", label_de: "Tierbiss am Unterarm", label_en: "Animal bite to forearm", finding_de: "kleine Bissverletzung am Unterarm", finding_en: "small animal bite on the forearm" },
  { id: "injection_site", label_de: "Einstichstelle am Unterarm", label_en: "Injection site on forearm", finding_de: "frische Einstichstelle am Unterarm", finding_en: "fresh injection site on the forearm" },
  { id: "tongue_bite", label_de: "Zungenbiss", label_en: "Tongue bite", finding_de: "frischer Zungenbiss", finding_en: "fresh tongue bite" },
  { id: "shoulder_contusion", label_de: "Schulterprellung", label_en: "Shoulder contusion", finding_de: "schmerzhafte Schulterprellung nach dem Sturz", finding_en: "painful shoulder contusion after the fall" },
  { id: "facial_swelling", label_de: "Gesichtsschwellung", label_en: "Facial swelling", finding_de: "rasch zunehmende Gesichtsschwellung", finding_en: "rapidly increasing facial swelling" },
  { id: "crush_injury", label_de: "Quetschverletzung", label_en: "Crush injury", finding_de: "ausgedehnte Quetschverletzung der Extremität", finding_en: "extensive crush injury of the limb" },
  { id: "pelvic_tenderness", label_de: "Beckenprellung", label_en: "Pelvic contusion", finding_de: "starker Druckschmerz über dem Becken", finding_en: "marked pelvic tenderness" },
  { id: "nasal_trauma", label_de: "Nasenbeintrauma", label_en: "Nasal trauma", finding_de: "geringe Blutung nach Nasenbeintrauma", finding_en: "minor bleeding after nasal trauma" },
];

export const MEDICATION_CATALOG = [
  { id: "acetylsalicylic_acid", label_de: "Acetylsalicylsäure", label_en: "Aspirin", synonyms: ["Acetylsalicylsäure", "ASS", "Aspirin", "Aspirin geben"], category: "antiplatelet" },
  { id: "nitroglycerin", label_de: "Nitroglycerin", label_en: "Nitroglycerin", synonyms: ["Nitroglycerin", "Nitro", "Nitrospray", "Nitro Spray", "Nitroglycerin Spray", "Metroglucurin", "Netroglucerin"], category: "antianginal" },
  { id: "morphine", label_de: "Morphin", label_en: "Morphine", synonyms: ["Morphin", "Morphine", "Morphium"], category: "analgesic" },
  { id: "piritramide", label_de: "Piritramid", label_en: "Piritramide", synonyms: ["Piritramid", "Dipidolor", "Piritramide"], category: "analgesic" },
  { id: "adrenaline", label_de: "Adrenalin intramuskulär", label_en: "Intramuscular adrenaline", synonyms: ["Adrenalin", "Suprarenin", "Epinephrin", "Epinephrine", "i m", "intramuskulaer", "intramuscular", "Abermali in", "Abermalin"], category: "vasopressor" },
  { id: "ringer_acetate", label_de: "Ringer-Acetat-Infusion", label_en: "Ringer's acetate infusion", synonyms: ["Ringer", "Ringer Acetat", "Ringer Infusion", "Volumengabe", "Infusion", "Fluessigkeit", "Fluids"], category: "fluid" },
  { id: "normal_saline", label_de: "Kristalloid-Infusion", label_en: "Crystalloid infusion", synonyms: ["Kristalloid", "NaCl", "Kochsalz", "Infusion", "Volumengabe", "Fluessigkeit", "Fluids"], category: "fluid" },
  { id: "prednisolone", label_de: "Prednisolon", label_en: "Prednisolone", synonyms: ["Prednisolon", "Prednisolone", "Predisolon", "Prenisolon", "Cortison", "Kortison", "Decortin"], category: "steroid" },
  { id: "clemastine", label_de: "Clemastin", label_en: "Clemastine", synonyms: ["Clemastin", "Tavegil", "Antihistaminikum", "Antihistamine"], category: "antihistamine" },
  { id: "dimetindene", label_de: "Dimetinden", label_en: "Dimetindene", synonyms: ["Dimetinden", "Fenistil", "Antihistaminikum", "Antihistamine"], category: "antihistamine" },
  { id: "salbutamol", label_de: "Salbutamol inhalativ", label_en: "Inhaled salbutamol", synonyms: ["Salbutamol", "Sultanol", "Salbutomal", "Salbutamol Spray", "Bronchodilatator", "Inhalator", "Inhaler"], category: "bronchodilator" },
  { id: "ipratropium", label_de: "Ipratropium inhalativ", label_en: "Inhaled ipratropium", synonyms: ["Ipratropium", "Atrovent", "Bronchodilatator", "Inhalator", "Inhaler"], category: "bronchodilator" },
  { id: "budesonide", label_de: "Budesonid inhalativ", label_en: "Inhaled budesonide", synonyms: ["Budesonid", "Budesonide", "Pulmicort", "Inhalation", "Inhalator", "Inhaler"], category: "steroid" },
  { id: "oral_glucose", label_de: "Glukose oral", label_en: "Oral glucose", synonyms: ["Glukose", "Glucose", "Traubenzucker", "Dextrose", "oral glucose", "Traubenzucker geben"], category: "glucose" },
  { id: "iv_dextrose", label_de: "Dextrose intravenös", label_en: "Intravenous dextrose", synonyms: ["Dextrose", "Glukose", "Glucose", "G 40", "intravenös", "i v", "dextrose"], category: "glucose" },
  { id: "naloxone", label_de: "Naloxon", label_en: "Naloxone", synonyms: ["Naloxon", "Naloxone", "Narcanti", "Naloxongabe", "Naloxen", "Antidot"], category: "antidote" },
  { id: "midazolam", label_de: "Midazolam", label_en: "Midazolam", synonyms: ["Midazolam", "Dormicum", "Midazolan", "Benzodiazepin", "Benzo"], category: "benzodiazepine" },
  { id: "diazepam", label_de: "Diazepam", label_en: "Diazepam", synonyms: ["Diazepam", "Valium", "Diazepan", "Benzodiazepin", "Benzo"], category: "benzodiazepine" },
  { id: "lorazepam", label_de: "Lorazepam", label_en: "Lorazepam", synonyms: ["Lorazepam", "Tavor", "Benzodiazepin", "Benzo"], category: "benzodiazepine" },
  { id: "atropine", label_de: "Atropin", label_en: "Atropine", synonyms: ["Atropin", "Atropine", "Atropingabe", "Atropim"], category: "chronotrope" },
  { id: "esketamine", label_de: "Esketamin", label_en: "Esketamine", synonyms: ["Esketamin", "Esketamine", "Ketanest", "Ketamin", "Ketamine", "Es Ketamin"], category: "analgesic" },
  { id: "paracetamol", label_de: "Paracetamol", label_en: "Paracetamol", synonyms: ["Paracetamol", "Acetaminophen"], category: "analgesic" },
  { id: "ibuprofen", label_de: "Ibuprofen", label_en: "Ibuprofen", synonyms: ["Ibuprofen", "NSAID"], category: "analgesic" },
  { id: "fentanyl", label_de: "Fentanyl", label_en: "Fentanyl", synonyms: ["Fentanyl", "Fentanyl geben"], category: "analgesic" },
  { id: "tranexamic_acid", label_de: "Tranexamsäure", label_en: "Tranexamic acid", synonyms: ["Tranexamsäure", "Tranexamic acid", "TXA"], category: "bleeding" },
  { id: "metoclopramide", label_de: "Metoclopramid", label_en: "Metoclopramide", synonyms: ["Metoclopramid", "MCP", "Antiemetikum"], category: "antiemetic" },
  { id: "ramipril", label_de: "Ramipril", label_en: "Ramipril", synonyms: ["Ramipril", "ACE Hemmer"], category: "home_medication" },
  { id: "bisoprolol", label_de: "Bisoprolol", label_en: "Bisoprolol", synonyms: ["Bisoprolol", "Betablocker", "Beta Blocker"], category: "home_medication" },
  { id: "atorvastatin", label_de: "Atorvastatin", label_en: "Atorvastatin", synonyms: ["Atorvastatin", "Statin"], category: "home_medication" },
  { id: "metformin", label_de: "Metformin", label_en: "Metformin", synonyms: ["Metformin", "Biguanid"], category: "home_medication" },
  { id: "apixaban", label_de: "Apixaban", label_en: "Apixaban", synonyms: ["Apixaban", "Eliquis", "Antikoagulation", "Blutverdünner"], category: "home_medication" },
  { id: "levetiracetam", label_de: "Levetiracetam", label_en: "Levetiracetam", synonyms: ["Levetiracetam", "Keppra", "Antiepileptikum"], category: "home_medication" },
  { id: "insulin", label_de: "Insulin", label_en: "Insulin", synonyms: ["Insulin"], category: "home_medication" },
  { id: "pantoprazole", label_de: "Pantoprazol", label_en: "Pantoprazole", synonyms: ["Pantoprazol", "Panto"], category: "home_medication" },
];

export const ALLERGY_CATALOG = [
  { id: "none", label_de: "Keine bekannte Arzneimittelallergie", label_en: "No known drug allergy", avoidMedicationIds: [] },
  { id: "penicillin", label_de: "Penicillin", label_en: "Penicillin", avoidMedicationIds: [] },
  { id: "metamizole", label_de: "Metamizol", label_en: "Metamizole", avoidMedicationIds: ["metamizol"] },
  { id: "morphine", label_de: "Morphin", label_en: "Morphine", avoidMedicationIds: ["morphine"] },
  { id: "latex", label_de: "Latex", label_en: "Latex", avoidMedicationIds: [] },
  { id: "iodine", label_de: "Jodhaltiges Kontrastmittel", label_en: "Iodinated contrast", avoidMedicationIds: [] },
  { id: "nsaid", label_de: "NSAR", label_en: "NSAIDs", avoidMedicationIds: ["ibuprofen"] },
  { id: "sulfonamide", label_de: "Sulfonamide", label_en: "Sulfonamides", avoidMedicationIds: [] },
  { id: "nuts", label_de: "Nüsse", label_en: "Nuts", avoidMedicationIds: [] },
  { id: "bee_venom", label_de: "Bienengift", label_en: "Bee venom", avoidMedicationIds: [] },
  { id: "pollen", label_de: "Pollen", label_en: "Pollen", avoidMedicationIds: [] },
  { id: "adhesive", label_de: "Pflasterkleber", label_en: "Medical adhesive", avoidMedicationIds: [] },
  { id: "chlorhexidine", label_de: "Chlorhexidin", label_en: "Chlorhexidine", avoidMedicationIds: [] },
];

export const HISTORY_CATALOG = [
  { id: "hypertension", label_de: "Arterielle Hypertonie", label_en: "Arterial hypertension" },
  { id: "coronary_disease", label_de: "Koronare Herzkrankheit", label_en: "Coronary artery disease" },
  { id: "heart_failure", label_de: "Herzinsuffizienz", label_en: "Heart failure" },
  { id: "diabetes_type2", label_de: "Diabetes mellitus Typ 2", label_en: "Type 2 diabetes" },
  { id: "asthma_history", label_de: "Bekanntes Asthma bronchiale", label_en: "Known bronchial asthma" },
  { id: "allergy_history", label_de: "Bekannte Allergien", label_en: "Known allergies" },
  { id: "copd", label_de: "COPD", label_en: "COPD" },
  { id: "epilepsy_history", label_de: "Epilepsie", label_en: "Epilepsy" },
  { id: "atrial_fibrillation", label_de: "Vorhofflimmern", label_en: "Atrial fibrillation" },
  { id: "renal_insufficiency", label_de: "Niereninsuffizienz", label_en: "Renal insufficiency" },
  { id: "anticoagulation", label_de: "Dauerantikoagulation", label_en: "Long-term anticoagulation" },
  { id: "smoker", label_de: "Aktiver Nikotinkonsum", label_en: "Active smoker" },
  { id: "migraine", label_de: "Migräne", label_en: "Migraine" },
  { id: "anxiety", label_de: "Angststörung", label_en: "Anxiety disorder" },
  { id: "obesity", label_de: "Adipositas", label_en: "Obesity" },
  { id: "previous_fracture", label_de: "Frühere Fraktur", label_en: "Previous fracture" },
  { id: "no_relevant_history", label_de: "Keine relevante Vorerkrankung", label_en: "No relevant medical history" },
];

export const ACTION_CATALOG = [
  { id: "ecg_12", type: "procedure", label_de: "12-Kanal-EKG", label_en: "12-lead ECG", synonyms: ["12 Kanal EKG", "12 Kanal", "EKG", "ECG", "zwoelf Kanal EKG", "Ruhe EKG"] },
  { id: "oxygen_mask", type: "procedure", label_de: "Sauerstoff über Maske", label_en: "Oxygen by mask", synonyms: ["Sauerstoff", "Sauerstoffgabe", "Sauerstoffmaske", "O2", "oxygen"] },
  { id: "oxygen_nasal", type: "procedure", label_de: "Sauerstoff über Nasenbrille", label_en: "Oxygen by nasal cannula", synonyms: ["Sauerstoff", "Sauerstoffgabe", "Nasenbrille", "O2", "oxygen"] },
  { id: "transport", type: "procedure", label_de: "Verlegung in die Zielklinik", label_en: "Transfer to destination hospital", synonyms: ["Zielklinik", "Klinik", "Krankenhaus", "Verlegung", "Transport", "transportieren", "hospital", "transfer"] },
  { id: "volume_ringer", type: "medication", label_de: "Ringer-Acetat-Infusion", label_en: "Ringer's acetate infusion", synonyms: ["Ringer", "Ringer Acetat", "Ringer Infusion", "Volumengabe", "Infusion", "Volumen", "Fluessigkeit", "fluids"] },
  { id: "volume_crystalloid", type: "medication", label_de: "Kristalloid-Infusion", label_en: "Crystalloid infusion", synonyms: ["Kristalloid", "NaCl", "Kochsalz", "Volumengabe", "Infusion", "Volumen", "Fluessigkeit", "fluids"] },
  { id: "adrenaline_im", type: "medication", label_de: "Adrenalin intramuskulär", label_en: "Intramuscular adrenaline", synonyms: ["Adrenalin", "Suprarenin", "Epinephrin", "Epinephrine", "i m", "intramuskulaer", "intramuscular", "Abermali in", "Abermalin"] },
  { id: "nitroglycerin", type: "medication", label_de: "Nitroglycerin", label_en: "Nitroglycerin", synonyms: ["Nitroglycerin", "Nitro", "Nitrospray", "Nitro Spray", "Metroglucurin", "Netroglucerin"] },
  { id: "morphine", type: "medication", label_de: "Morphin als Analgesie", label_en: "Morphine analgesia", synonyms: ["Morphin", "Morphine", "Morphium", "Analgesie", "Schmerzmittel"] },
  { id: "piritramide", type: "medication", label_de: "Piritramid als Analgesie", label_en: "Piritramide analgesia", synonyms: ["Piritramid", "Dipidolor", "Piritramide", "Analgesie", "Schmerzmittel"] },
  { id: "antihistamine_clemastine", type: "medication", label_de: "Clemastin als Antihistaminikum", label_en: "Clemastine antihistamine", synonyms: ["Clemastin", "Tavegil", "Antihistaminikum", "Antihistamine"] },
  { id: "antihistamine_dimetindene", type: "medication", label_de: "Dimetinden als Antihistaminikum", label_en: "Dimetindene antihistamine", synonyms: ["Dimetinden", "Fenistil", "Antihistaminikum", "Antihistamine"] },
  { id: "prednisolone", type: "medication", label_de: "Prednisolon als Kortikosteroid", label_en: "Prednisolone corticosteroid", synonyms: ["Prednisolon", "Prednisolone", "Predisolon", "Prenisolon", "Cortison", "Kortison", "Decortin", "steroid"] },
  { id: "salbutamol", type: "medication", label_de: "Salbutamol inhalativ", label_en: "Inhaled salbutamol", synonyms: ["Salbutamol", "Sultanol", "Salbutomal", "Salbutamol Spray", "Bronchodilatator", "Inhalator", "Inhaler"] },
  { id: "ipratropium", type: "medication", label_de: "Ipratropium inhalativ", label_en: "Inhaled ipratropium", synonyms: ["Ipratropium", "Atrovent", "Bronchodilatator", "Inhalator", "Inhaler"] },
  { id: "budesonide", type: "medication", label_de: "Budesonid inhalativ", label_en: "Inhaled budesonide", synonyms: ["Budesonid", "Budesonide", "Pulmicort", "Inhalation", "Inhalator", "Inhaler"] },
  { id: "bz_check", type: "procedure", label_de: "Blutzuckermessung", label_en: "Blood glucose measurement", synonyms: ["BZ", "Blutzucker", "Blutzuckermessung", "Blutzucker messen", "BZ Wert", "BZ Messgeraet", "blood sugar"] },
  { id: "oral_glucose", type: "medication", label_de: "Glukose oral", label_en: "Oral glucose", synonyms: ["Glukose", "Glucose", "Traubenzucker", "Dextrose", "oral glucose", "Traubenzucker geben"] },
  { id: "iv_dextrose", type: "medication", label_de: "Dextrose intravenös", label_en: "Intravenous dextrose", synonyms: ["Dextrose", "Glukose", "Glucose", "G 40", "intravenoes", "i v", "dextrose"] },
  { id: "monitoring", type: "procedure", label_de: "Kontrolle und Monitoring", label_en: "Recheck and monitoring", synonyms: ["Kontrolle", "kontrollieren", "Monitoring", "Monitor", "Rhythmusueberwachung", "Recheck", "monitor"] },
  { id: "ventilation", type: "procedure", label_de: "Beatmung mit dem Beutel", label_en: "Bag-mask ventilation", synonyms: ["Beatmung", "beatmen", "Beatmungsbeutel", "Beutel Maske", "Bag Mask", "Ventilation", "ventilate"] },
  { id: "naloxone", type: "medication", label_de: "Naloxon", label_en: "Naloxone", synonyms: ["Naloxon", "Naloxone", "Narcanti", "Naloxongabe", "Naloxen", "Antidot"] },
  { id: "airway", type: "procedure", label_de: "Atemwegssicherung", label_en: "Airway management", synonyms: ["Atemweg", "Atemwege", "Atemwegssicherung", "Esmarch", "Guedel", "Guedeltubus", "Airway", "Head Tilt"] },
  { id: "midazolam", type: "medication", label_de: "Midazolam als Benzodiazepin", label_en: "Midazolam benzodiazepine", synonyms: ["Midazolam", "Dormicum", "Midazolan", "Benzodiazepin", "Benzo"] },
  { id: "diazepam", type: "medication", label_de: "Diazepam als Benzodiazepin", label_en: "Diazepam benzodiazepine", synonyms: ["Diazepam", "Valium", "Diazepan", "Benzodiazepin", "Benzo"] },
  { id: "lorazepam", type: "medication", label_de: "Lorazepam als Benzodiazepin", label_en: "Lorazepam benzodiazepine", synonyms: ["Lorazepam", "Tavor", "Benzodiazepin", "Benzo"] },
  { id: "recovery_position", type: "procedure", label_de: "Stabile Seitenlage", label_en: "Recovery position", synonyms: ["Schutzposition", "Seitenlage", "stabile Seitenlage", "Seitenlagerung", "Recovery Position"] },
  { id: "atropine", type: "medication", label_de: "Atropin", label_en: "Atropine", synonyms: ["Atropin", "Atropine", "Atropingabe", "Atropim"] },
  { id: "iv_access", type: "procedure", label_de: "Venenzugang", label_en: "IV access", synonyms: ["Venenzugang", "i v", "Zugang", "IV Access", "intravenoes", "Zugang legen"] },
  { id: "bleeding_control", type: "procedure", label_de: "Blutstillung mit Tourniquet", label_en: "Bleeding control with tourniquet", synonyms: ["Tourniquet", "Abbinden", "Druckverband", "Blutstillung", "Abbindung", "tourniquet"] },
  { id: "esketamine", type: "medication", label_de: "Esketamin als Analgesie", label_en: "Esketamine analgesia", synonyms: ["Esketamin", "Esketamine", "Ketanest", "Ketamin", "Ketamine", "Es Ketamin", "Analgesie"] },
  { id: "paracetamol", type: "medication", label_de: "Paracetamol als Analgesie", label_en: "Paracetamol analgesia", synonyms: ["Paracetamol", "Acetaminophen", "Analgesie", "Schmerzmittel"] },
  { id: "immobilisation_splint", type: "procedure", label_de: "Immobilisation mit Schiene", label_en: "Immobilisation with splint", synonyms: ["Immobilisation", "Schiene", "Vakuummatratze", "Vakuumschiene", "Spineboard", "Splint", "immobilisieren", "Immobilize"] },
  { id: "immobilisation_vacuum", type: "procedure", label_de: "Immobilisation auf der Vakuummatratze", label_en: "Immobilisation on vacuum mattress", synonyms: ["Immobilisation", "Vakuummatratze", "Vakuumschiene", "Spineboard", "Schiene", "immobilisieren", "Immobilize"] },
];

const ACTION_BY_ID = new Map(ACTION_CATALOG.map((action) => [action.id, action]));
const MEDICATION_BY_ID = new Map(MEDICATION_CATALOG.map((medication) => [medication.id, medication]));
const INJURY_BY_ID = new Map(INJURY_CATALOG.map((injury) => [injury.id, injury]));
const ALLERGY_BY_ID = new Map(ALLERGY_CATALOG.map((allergy) => [allergy.id, allergy]));
const HISTORY_BY_ID = new Map(HISTORY_CATALOG.map((history) => [history.id, history]));

export const CASE_PROFILE_RULES = {
  stemi: {
    contexts: [
      { id: "stairs", label_de: "nach dem Treppensteigen", label_en: "after climbing stairs" },
      { id: "garden_work", label_de: "während der Gartenarbeit", label_en: "during gardening" },
      { id: "cold_walk", label_de: "nach einem Spaziergang in der Kälte", label_en: "after a walk in the cold" },
      { id: "rest", label_de: "in Ruhe auf dem Sofa", label_en: "at rest on the sofa" },
    ],
    injuryPools: ["none", "thorax_contusion", "forehead_laceration", "rib_contusion"],
    injuryCount: [1, 1],
    historyPools: ["coronary_disease", "hypertension", "heart_failure", "smoker", "diabetes_type2"],
    allergyPools: ["none", "penicillin", "metamizole", "latex", "nsaid"],
    medicationPools: ["bisoprolol", "ramipril", "atorvastatin", "apixaban", "pantoprazole"],
    treatmentVariants: { ecg: ["ecg_12"], oxygen: ["oxygen_mask", "oxygen_nasal"], analgesia_nitro: ["nitroglycerin", "morphine", "piritramide"], transport: ["transport"] },
    vitalRanges: { RR: [[140, 175], [80, 105]], HF: [88, 122], SpO2: [90, 97], BZ: [84, 168], GCS: [14, 15] },
  },
  anaphylaxie: {
    contexts: [
      { id: "wasp_sting", label_de: "wenige Minuten nach einem Wespenstich", label_en: "minutes after a wasp sting" },
      { id: "new_antibiotic", label_de: "kurz nach der ersten Antibiotikadosis", label_en: "shortly after the first antibiotic dose" },
      { id: "food_exposure", label_de: "nach einer Mahlzeit mit unbekannten Zutaten", label_en: "after a meal with unknown ingredients" },
      { id: "latex_exposure", label_de: "nach Kontakt mit Latexhandschuhen", label_en: "after contact with latex gloves" },
    ],
    injuryPools: ["insect_sting", "facial_swelling", "none", "animal_bite"],
    injuryCount: [1, 1],
    historyPools: ["asthma_history", "anxiety", "no_relevant_history", "obesity"],
    allergyPools: ["bee_venom", "nuts", "penicillin", "latex", "none"],
    medicationPools: ["ramipril", "metformin", "pantoprazole", "bisoprolol"],
    treatmentVariants: { adrenaline_im: ["adrenaline_im"], oxygen: ["oxygen_mask", "oxygen_nasal"], volume: ["volume_ringer", "volume_crystalloid"] },
    combinationVariants: { antihistamine_steroid: [["antihistamine_clemastine", "prednisolone"], ["antihistamine_dimetindene", "prednisolone"]] },
    vitalRanges: { RR: [[70, 100], [40, 65]], HF: [110, 148], SpO2: [85, 95], BZ: [70, 135], GCS: [12, 15] },
  },
  hypoglykaemie: {
    contexts: [
      { id: "missed_meal", label_de: "nach einer ausgelassenen Mahlzeit", label_en: "after missing a meal" },
      { id: "exercise", label_de: "nach ungewohnter körperlicher Belastung", label_en: "after unusual physical exertion" },
      { id: "morning", label_de: "am frühen Morgen zu Hause", label_en: "early in the morning at home" },
      { id: "shopping", label_de: "beim Einkaufen im Supermarkt", label_en: "while shopping at the supermarket" },
    ],
    injuryPools: ["none", "knee_abrasion", "forehead_laceration", "wrist_injury"],
    injuryCount: [1, 1],
    historyPools: ["diabetes_type2", "hypertension", "renal_insufficiency", "no_relevant_history", "obesity"],
    allergyPools: ["none", "penicillin", "latex", "adhesive"],
    medicationPools: ["metformin", "ramipril", "bisoprolol", "pantoprazole"],
    treatmentVariants: { bz_check: ["bz_check"], glucose_admin: ["oral_glucose", "iv_dextrose"], recheck_monitor: ["monitoring"] },
    vitalRanges: { RR: [[95, 125], [55, 80]], HF: [78, 112], SpO2: [96, 100], BZ: [28, 58], GCS: [11, 14] },
  },
  asthma: {
    contexts: [
      { id: "sport", label_de: "während des Sportunterrichts", label_en: "during physical education" },
      { id: "pollen", label_de: "nach einem Aufenthalt im hohen Gras", label_en: "after being in tall grass" },
      { id: "cold_air", label_de: "nach dem Lauftraining in kalter Luft", label_en: "after running in cold air" },
      { id: "smoke", label_de: "nach Kontakt mit starkem Rauch", label_en: "after heavy smoke exposure" },
    ],
    injuryPools: ["none", "rib_contusion", "ankle_sprain", "knee_abrasion"],
    injuryCount: [1, 1],
    historyPools: ["asthma_history", "allergy_history", "anxiety", "no_relevant_history"],
    allergyPools: ["none", "nsaid", "penicillin", "nuts", "pollen"],
    medicationPools: ["salbutamol", "budesonide", "metformin", "pantoprazole"],
    treatmentVariants: { salbutamol: ["salbutamol", "ipratropium"], steroid_pred: ["prednisolone", "budesonide"], oxygen: ["oxygen_mask", "oxygen_nasal"] },
    vitalRanges: { RR: [[125, 165], [75, 100]], HF: [102, 136], SpO2: [88, 95], BZ: [78, 120], GCS: [14, 15] },
  },
  opioid: {
    contexts: [
      { id: "park_bench", label_de: "auf einer Parkbank aufgefunden", label_en: "found on a park bench" },
      { id: "bathroom", label_de: "bewusstlos in einer Wohnung aufgefunden", label_en: "found unconscious in an apartment" },
      { id: "party", label_de: "nach einer privaten Feier kollabiert", label_en: "collapsed after a private party" },
      { id: "unknown_substance", label_de: "neben einer unbekannten Substanz aufgefunden", label_en: "found beside an unknown substance" },
    ],
    injuryPools: ["none", "forehead_laceration", "nasal_trauma", "injection_site", "knee_abrasion"],
    injuryCount: [1, 1],
    historyPools: ["no_relevant_history", "anxiety", "previous_fracture", "renal_insufficiency"],
    allergyPools: ["none", "penicillin", "latex", "nsaid"],
    medicationPools: ["pantoprazole", "ramipril", "metformin"],
    treatmentVariants: { ventilation: ["ventilation"], naloxone: ["naloxone"], airway: ["airway"] },
    vitalRanges: { RR: [[70, 105], [40, 70]], HF: [48, 76], SpO2: [70, 86], BZ: [65, 110], GCS: [4, 9] },
  },
  epilepsie: {
    contexts: [
      { id: "bakery", label_de: "vor einer Bäckerei krampfend aufgefunden", label_en: "found seizing outside a bakery" },
      { id: "bedroom", label_de: "im Schlafzimmer krampfend aufgefunden", label_en: "found seizing in a bedroom" },
      { id: "bus_stop", label_de: "an einer Bushaltestelle krampfend aufgefunden", label_en: "found seizing at a bus stop" },
      { id: "workshop", label_de: "in einer Werkstatt krampfend aufgefunden", label_en: "found seizing in a workshop" },
    ],
    injuryPools: ["tongue_bite", "scalp_laceration", "shoulder_contusion", "none"],
    injuryCount: [1, 1],
    historyPools: ["epilepsy_history", "no_relevant_history", "migraine", "renal_insufficiency"],
    allergyPools: ["none", "penicillin", "latex", "nsaid"],
    medicationPools: ["levetiracetam", "ramipril", "pantoprazole"],
    treatmentVariants: { benzo: ["midazolam", "diazepam", "lorazepam"], recovery_position: ["recovery_position"], oxygen: ["oxygen_mask", "oxygen_nasal"] },
    vitalRanges: { RR: [[125, 170], [75, 105]], HF: [108, 142], SpO2: [82, 93], BZ: [62, 125], GCS: [5, 10] },
  },
  bradykardie: {
    contexts: [
      { id: "walk", label_de: "beim Spaziergang kollabiert", label_en: "collapsed during a walk" },
      { id: "bathroom", label_de: "auf dem Weg ins Badezimmer kollabiert", label_en: "collapsed on the way to the bathroom" },
      { id: "garden", label_de: "bei der Gartenarbeit kollabiert", label_en: "collapsed while gardening" },
      { id: "bus", label_de: "an der Bushaltestelle kollabiert", label_en: "collapsed at a bus stop" },
    ],
    injuryPools: ["none", "knee_abrasion", "wrist_injury", "shoulder_contusion", "hip_contusion"],
    injuryCount: [1, 1],
    historyPools: ["hypertension", "coronary_disease", "atrial_fibrillation", "heart_failure", "no_relevant_history"],
    allergyPools: ["none", "penicillin", "latex", "nsaid"],
    medicationPools: ["bisoprolol", "ramipril", "apixaban", "atorvastatin"],
    treatmentVariants: { atropine: ["atropine"], rhythm_monitoring: ["monitoring", "ecg_12"], iv_access: ["iv_access"] },
    vitalRanges: { RR: [[88, 118], [50, 75]], HF: [28, 48], SpO2: [93, 99], BZ: [68, 125], GCS: [13, 15] },
  },
  polytrauma: {
    contexts: [
      { id: "ladder", label_de: "nach einem Sturz von der Leiter", label_en: "after falling from a ladder" },
      { id: "bicycle", label_de: "nach einem Fahrradunfall", label_en: "after a bicycle crash" },
      { id: "construction", label_de: "nach einem Arbeitsunfall auf der Baustelle", label_en: "after a construction-site accident" },
      { id: "stairs", label_de: "nach einem Sturz über eine Treppe", label_en: "after falling down stairs" },
    ],
    injuryPools: ["open_tibia_fracture", "closed_tibia_fracture", "radius_fracture", "shoulder_dislocation", "thigh_stab_wound", "crush_injury", "pelvic_tenderness", "hip_contusion"],
    injuryCount: [2, 2],
    historyPools: ["anticoagulation", "hypertension", "previous_fracture", "no_relevant_history", "diabetes_type2"],
    allergyPools: ["none", "nsaid", "penicillin", "latex", "adhesive"],
    medicationPools: ["apixaban", "ramipril", "metformin", "bisoprolol", "pantoprazole"],
    treatmentVariants: { tourniquet_bleeding_control: ["bleeding_control"], volume_keto: ["volume_ringer", "volume_crystalloid"], analgesia_esketamine: ["esketamine", "paracetamol"], immobilisation: ["immobilisation_splint", "immobilisation_vacuum"] },
    vitalRanges: { RR: [[58, 88], [30, 55]], HF: [116, 148], SpO2: [88, 97], BZ: [82, 165], GCS: [11, 15] },
  },
};

const DEFAULT_ACTION_IDS = {
  ecg: "ecg_12",
  oxygen: "oxygen_mask",
  transport: "transport",
  volume: "volume_ringer",
  bz_check: "bz_check",
  glucose_admin: "oral_glucose",
  recheck_monitor: "monitoring",
  salbutamol: "salbutamol",
  steroid_pred: "prednisolone",
  ventilation: "ventilation",
  naloxone: "naloxone",
  airway: "airway",
  benzo: "midazolam",
  recovery_position: "recovery_position",
  atropine: "atropine",
  rhythm_monitoring: "monitoring",
  iv_access: "iv_access",
  tourniquet_bleeding_control: "bleeding_control",
  volume_keto: "volume_ringer",
  analgesia_esketamine: "esketamine",
  immobilisation: "immobilisation_splint",
};

export function createSeededRandom(seed) {
  let state = Number(seed) >>> 0;
  if (!state) state = 0x6d2b79f5;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] >>> 0;
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length) % list.length];
}

function pickMany(list, count, rng) {
  const shuffled = [...list];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function randomInt(min, max, rng) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function publicEntry(entry) {
  if (!entry) return null;
  return { id: entry.id, label_de: entry.label_de, label_en: entry.label_en };
}

function actionFor(id, fallback) {
  const action = ACTION_BY_ID.get(id);
  if (action) return action;
  return {
    id: `base_${fallback.key}`,
    type: "procedure",
    label_de: fallback.label_de,
    label_en: fallback.label_en,
    synonyms: fallback.any || [],
  };
}

function actionAvoided(action, allergies) {
  return allergies.some((allergy) => (allergy.avoidMedicationIds || []).includes(action.id));
}

function chooseAction(ids, allergies, rng, fallback) {
  const actions = ids.map((id) => actionFor(id, fallback));
  const safe = actions.filter((action) => !actionAvoided(action, allergies));
  return pick(safe.length ? safe : actions, rng);
}

function makeRequiredGroup(group, action, keySuffix = "") {
  const synonyms = [...new Set([...(action.synonyms || []), action.label_de, action.label_en].filter(Boolean))];
  return {
    ...group,
    key: keySuffix ? `${group.key}_${keySuffix}` : group.key,
    base_key: group.base_key || group.key,
    label_de: action.label_de,
    label_en: action.label_en,
    any: synonyms,
  };
}

function buildTreatment(template, rules, allergies, rng) {
  const required = [];
  const actions = [];
  for (const group of template.required || []) {
    const combinations = rules.combinationVariants?.[group.key];
    if (combinations) {
      const selectedIds = pick(combinations, rng);
      for (const actionId of selectedIds) {
        const action = chooseAction([actionId], allergies, rng, group);
        required.push(makeRequiredGroup(group, action, action.id));
        actions.push({ groupKey: `${group.key}_${action.id}`, baseKey: group.key, ...publicEntry(action), type: action.type });
      }
      continue;
    }
    const options = rules.treatmentVariants?.[group.key] || [DEFAULT_ACTION_IDS[group.key]];
    const action = chooseAction(options.filter(Boolean), allergies, rng, group);
    required.push(makeRequiredGroup(group, action));
    actions.push({ groupKey: group.key, baseKey: group.key, ...publicEntry(action), type: action.type });
  }
  return { required, actions };
}

function randomVitals(templateVitals, rules, rng) {
  const ranges = rules.vitalRanges || {};
  const rr = ranges.RR;
  return {
    RR: rr ? `${randomInt(rr[0][0], rr[0][1], rng)}/${randomInt(rr[1][0], rr[1][1], rng)} mmHg` : templateVitals.RR,
    HF: ranges.HF ? `${randomInt(ranges.HF[0], ranges.HF[1], rng)} /min` : templateVitals.HF,
    SpO2: ranges.SpO2 ? `${randomInt(ranges.SpO2[0], ranges.SpO2[1], rng)} %` : templateVitals.SpO2,
    BZ: ranges.BZ ? `${randomInt(ranges.BZ[0], ranges.BZ[1], rng)} mg/dl` : templateVitals.BZ,
    GCS: ranges.GCS ? String(randomInt(ranges.GCS[0], ranges.GCS[1], rng)) : templateVitals.GCS,
  };
}

// Several ways to phrase the same handover. A run draws a different one each
// time so a player never reads the identical script twice, and the dataset
// gets varied sentence structure rather than one memorised template.
export const HINT_TEMPLATES = [
  ({ findings, title, treatment }) =>
    `Befund: ${findings}. Verdacht: ${title}. Allergien und Vorerkrankungen beachten. Maßnahme: ${treatment}.`,
  ({ findings, title, treatment }) =>
    `Ich habe hier einen Patienten, ${findings}. Ich vermute ${title}. Ich mache ${treatment}.`,
  ({ findings, title, treatment }) =>
    `Übergabe an die Leitstelle: ${findings}. Verdachtsdiagnose ${title}. Durchgeführt werden ${treatment}.`,
  ({ findings, title, treatment, vitals }) =>
    `Erstbefund ${findings}. Blutdruck ${vitals.RR}, Herzfrequenz ${vitals.HF}, Sättigung ${vitals.SpO2}. Verdacht auf ${title}. Maßnahmen: ${treatment}.`,
  ({ findings, title, treatment }) =>
    `Notfallmeldung: ${findings}. Es besteht der Verdacht auf ${title}. Ich leite ein: ${treatment}.`,
  ({ findings, title, treatment, vitals }) =>
    `Der Patient zeigt ${findings}, Glasgow Coma Scale ${vitals.GCS}, Blutzucker ${vitals.BZ}. Diagnose am Einsatzort: ${title}. Therapie: ${treatment}.`,
  ({ findings, title, treatment, historyText }) =>
    `Lagemeldung: ${findings}. Vorerkrankungen ${historyText}. Arbeitsdiagnose ${title}. Ich versorge mit ${treatment}.`,
  ({ findings, title, treatment, allergyText }) =>
    `Patient aufgefunden, ${findings}. Allergien: ${allergyText}. Verdacht auf ${title}. Behandlung: ${treatment}.`,
];

function buildHint({ template, findingsText, treatmentText, vitals, allergy, history, rng }) {
  const shape = HINT_TEMPLATES[Math.floor(rng() * HINT_TEMPLATES.length) % HINT_TEMPLATES.length];
  return shape({
    findings: findingsText,
    title: template.title_de,
    treatment: treatmentText,
    vitals,
    allergyText: allergy && allergy.id !== "none" ? allergy.label_de : "keine bekannten Allergien",
    historyText: history.length ? history.map((entry) => entry.label_de).join(" und ") : "keine relevanten Vorerkrankungen",
  });
}

export function randomizeCase(template, rng = Math.random) {
  const rules = CASE_PROFILE_RULES[template.id] || {};
  const context = pick(rules.contexts || [{ id: "scene", label_de: "am Einsatzort", label_en: "at the scene" }], rng);
  const injuryIds = rules.injuryPools || ["none"];
  const injuryCount = randomInt((rules.injuryCount || [1, 1])[0], (rules.injuryCount || [1, 1])[1], rng);
  const injuries = pickMany(injuryIds, injuryCount, rng).map((id) => INJURY_BY_ID.get(id)).filter(Boolean);
  const historyIds = pickMany(rules.historyPools || ["no_relevant_history"], randomInt(1, 2, rng), rng);
  const history = historyIds.map((id) => HISTORY_BY_ID.get(id)).filter(Boolean);
  const allergy = ALLERGY_BY_ID.get(pick(rules.allergyPools || ["none"], rng)) || ALLERGY_CATALOG[0];
  const allergies = [allergy];
  const medicationIds = pickMany(rules.medicationPools || [], randomInt(1, 3, rng), rng);
  const currentMedications = medicationIds.map((id) => MEDICATION_BY_ID.get(id)).filter(Boolean);
  const treatment = buildTreatment(template, rules, allergies, rng);
  const injuryFindings = injuries.filter((injury) => injury.id !== "none").map((injury) => ({ de: injury.finding_de, en: injury.finding_en }));
  const additionalFinding = [
    { de: `Einsatzanlass: ${context.label_de}`, en: `Scene context: ${context.label_en}` },
    ...injuryFindings,
  ];
  const symptoms = [...(template.symptoms || []).map((symptom) => ({ ...symptom })), ...additionalFinding];
  const treatmentText = treatment.required.map((group) => group.label_de).join(", ");
  const findingsText = [context.label_de, ...injuries.filter((injury) => injury.id !== "none").map((injury) => injury.finding_de)].join(", ");
  const profile = {
    variant_id: `${template.id}:${context.id}:${injuries.map((injury) => injury.id).join("+")}:${treatment.actions.map((action) => action.id).join("+")}`,
    incident: { id: context.id, label_de: context.label_de, label_en: context.label_en },
    injuries: injuries.map(publicEntry),
    history: history.map(publicEntry),
    allergies: allergies.map(publicEntry),
    currentMedications: currentMedications.map(publicEntry),
    treatmentPlan: { actions: treatment.actions },
  };
  const vitals = randomVitals(template.vitals, rules, rng);
  const hint_de = buildHint({
    template,
    findingsText,
    treatmentText,
    vitals,
    allergy,
    history,
    rng,
  });
  return {
    ...template,
    story_de: `${template.story_de} ${context.label_de}.`,
    symptoms,
    vitals,
    required: treatment.required,
    hint_de,
    profile,
  };
}
