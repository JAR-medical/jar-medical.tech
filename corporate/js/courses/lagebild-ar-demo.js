// Test 3: "Live-Lagebild & AR-Client Simulation" (DE + EN)
export default {
  id: "lagebild-ar-demo",
  version: 1,
  section: "test",
  icon: "map",
  title: {
    de: "Live-Lagebild & AR-Client Simulation",
    en: "Live Operating Picture & AR Simulation",
  },
  subtitle: {
    de: "Einsatzleitung und Trupp-Sicht interaktiv im Browser testen",
    en: "Test incident command and responder views interactively",
  },
  summary: {
    de: "Testen Sie beide Seiten von J.A.R. im Katastrophenschutz direkt im Browser: das Echtzeit-Lagebild der Einsatzleitung mit drei MANV-Übungslagen (Neubiberg, Halle, München) sowie die interaktive Sanitäter- und AR-Simulation am Patienten.",
    en: "Test both sides of J.A.R. in disaster response right in your browser: incident command's real-time operating picture with three MCI scenarios (Neubiberg, Halle, Munich) and the interactive paramedic and AR simulation at the patient.",
  },
  audience: {
    de: "Für Einsatzleiter, Organisatorische Leiter, Leitende Notärzte und Sanitätstrupps.",
    en: "For incident commanders, operational leads, senior emergency physicians and paramedic teams.",
  },
  minutes: 12,
  lessons: [
    {
      id: "lagebild-demo-testen",
      title: {
        de: "Das Lagebild der Einsatzleitung erproben",
        en: "Exploring incident command's operating picture",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "In der Lagebild-Demo steuern Sie als Einsatzleitung eine laufende Großschadenslage auf einer echten Karte mit Einsatzraster. Alle Bewegungen, Sichtungen, Funksprüche und Klinikkapazitäten laufen live ab.",
            en: "In the operating-picture demo you act as incident command managing a live mass-casualty exercise on a real map with an operational grid. All unit movements, triage updates, radio calls and hospital capacities unfold in real time.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Drei Übungslagen wählen:** Neubiberg (Explosion & Teileinsturz, MANV 25), Halle/Saale (Hochwasser Kröllwitz, MANV 20) oder München (Altstadt, MANV 50).",
              "**Patienten & Einsatzmittel filtern:** Klicken Sie Patientenmarker oder Trupps auf der Karte an, prüfen Sie Vitalwerte und greifen Sie bei Engpässen ein.",
              "**Transport & Kliniken disponieren:** Weisen Sie transportbereiten Patienten Zielkliniken nach freier Kapazität (SK I–III) zu und exportieren Sie Lagemeldung oder CSV.",
            ],
            en: [
              "**Pick from three scenarios:** Neubiberg (explosion & partial collapse, MCI 25), Halle/Saale (river flood, MCI 20) or Munich (old town, MCI 50).",
              "**Filter patients & units:** select patient markers or teams on the map, inspect vital signs and intervene when bottlenecks arise.",
              "**Dispatch transport & hospitals:** assign receiving hospitals based on live bed capacity (SK I–III) and export the situation report or CSV.",
            ],
          },
        },
        {
          type: "link",
          href: "../demo/",
          label: {
            de: "Lagebild-Demo der Einsatzleitung starten →",
            en: "Launch Incident Command Operating Picture →",
          },
        },
      ],
    },
    {
      id: "ar-client-testen",
      title: {
        de: "Den AR-Client & Sanitäter-Ablauf testen",
        en: "Testing the AR client & paramedic workflow",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Das Gegenstück zum Lagebild ist die Trupp-Anwendung am Patienten. Sie läuft auf AR-Brillen (PICO 4 Enterprise, Meta Quest, HoloLens 2), im Kamera-Modus auf dem Smartphone oder direkt als Simulation am Bildschirm.",
            en: "The counterpart to the operating picture is the team application at the patient. It runs on AR headsets (PICO 4 Enterprise, Meta Quest, HoloLens 2), in camera mode on a phone, or directly as a desktop simulation.",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Sichtung am Patienten:** Führen Sie eine Vorsichtung nach mSTaRT durch oder wählen Sie als Arzt direkt die Sichtungskategorie.",
              "**Verletzungen lokalisieren:** Markieren Sie Befunde (Blutung, Fraktur, Wunde, Verbrennung, Prellung, Amputation) am Körpermodell.",
              "**Karte & Übergabe:** Weisen Sie die Umhängekarte per QR-Scan zu und übergeben Sie die Daten ans Lagebild.",
            ],
            en: [
              "**Triage at the patient:** run an mSTaRT pre-triage or select the triage category directly as a physician.",
              "**Localise injuries:** mark findings (bleeding, fracture, wound, burn, contusion, amputation) on the body model.",
              "**Tag & handover:** assign the hanging tag via QR scan and pass the record to the operating picture.",
            ],
          },
        },
        {
          type: "link",
          href: "../demo/paramedic/",
          label: {
            de: "Sanitäter- & AR-Simulation starten →",
            en: "Launch Paramedic & AR Simulation →",
          },
        },
      ],
    },
  ],
};
