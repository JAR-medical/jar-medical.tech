// Course: ar-mesh-sichtung ("Katastrophenschutz (AR): Mesh-Netz der AR-Brillen")
// Section: understand · Icon: helmet
export default {
  id: "ar-mesh-sichtung",
  version: 1,
  section: "understand",
  icon: "helmet",
  title: {
    de: "Katastrophenschutz (AR): Mesh-Netz der AR-Brillen",
    en: "Civil protection (AR): the AR glasses mesh",
  },
  subtitle: {
    de: "Ausfallsichere Patientenerfassung & Headset-Mesh",
    en: "Fail-safe patient tracking & headset mesh",
  },
  summary: {
    de: "Wie Einsatzkräfte per RFID/NFC am Patienten berührungslos Akten öffnen, Befunde freihändig im AR-Head-Up-Display erfassen und bis zu 20 Headsets ohne Mobilfunknetz im lokalen Mesh synchronisieren.",
    en: "How responders open patient records contactlessly via RFID/NFC, document findings hands-free in the AR head-up display, and sync up to 20 headsets in a local mesh without mobile networks.",
  },
  audience: {
    de: "Für Notfallsanitäter, Feuerwehr-Führungskräfte, Katastrophenschutz und IT-Leiter.",
    en: "For paramedics, fire service leads, civil protection and emergency IT directors.",
  },
  minutes: 15,
  lessons: [
    {
      id: "scanner-patienten-id",
      title: {
        de: "Kontaktloser RFID/NFC-Scan & Fail-Closed-Prinzip",
        en: "Contactless RFID/NFC scan & fail-closed principle",
      },
      minutes: 5,
      blocks: [
        { type: "ar-scan-sequence" },
        {
          type: "p",
          text: {
            de: "Im Massenanfall von Verletzten verlangt jede Dokumentation eine eindeutige Patientenbindung. Jeder Patient erhält einen passiven RFID/NFC-Tag mit 180 Byte Speicher. Ein kleiner Scanner an der Jacke liest den Tag beim Herantreten kontaktlos aus und öffnet die passende Akte in der AR-Brille.",
            en: "In a mass-casualty incident, every note demands an unambiguous patient link. Every patient receives a passive RFID/NFC tag with 180 bytes of storage. A small jacket scanner reads the tag contactlessly upon approach, opening the matching record in the AR glasses.",
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "Das Fail-Closed-Prinzip schützt vor Verwechslungen: Ohne bestätigten Tag-Scan wird niemals auf Verdacht eine Akte geöffnet. Diktierte Notizen ohne Zuweisung landen im lokalen Puffer, nie bei einem falschen Patienten.",
            en: "The fail-closed principle prevents dangerous mix-ups: without a verified tag scan, no patient record is ever opened on suspicion. Dictated notes without assignment stay in local buffer, never in the wrong file.",
          },
        },
      ],
    },
    {
      id: "sprechen-speichern-hud",
      title: {
        de: "Freihändige Sprachdokumentation im AR-Visier",
        en: "Hands-free voice documentation in the AR HUD",
      },
      minutes: 5,
      blocks: [
        { type: "ar-hud-mock" },
        {
          type: "p",
          text: {
            de: "Mit freien Händen versorgen Einsatzkräfte Verletzte, während das AR-Visier alle relevanten Informationen blickfeldfest einblendet: Sichtungskategorie SK I bis SK IV, Vitalparameter, Maßnahmen und ein 13-Regionen-Körpermodell zur räumlichen Lokalisierung von Verletzungen.",
            en: "Responders treat casualties hands-free while the AR visor overlays critical data in the field of view: triage category T1 to T4, vitals, interventions, and a 13-region body model for spatial injury mapping.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Echtzeit-Synchronisation: Sobald der Sanitäter spricht, wandelt das System die Äußerung in strukturierte Daten um. Vitalwerte und Maßnahmen erscheinen unmittelbar auf dem HUD und werden im Einsatznetz verteilt.",
            en: "Real-time sync: as soon as the paramedic speaks, the system converts the utterance into structured data. Vitals and interventions appear immediately on the HUD and sync across the mesh.",
          },
        },
      ],
    },
    {
      id: "mesh-netz-live",
      title: {
        de: "Lokales AR-Mesh-Netz & Ausfallsichere Synchronisation",
        en: "Local AR mesh network & fail-safe synchronization",
      },
      minutes: 5,
      blocks: [
        { type: "ar-mesh-network" },
        {
          type: "p",
          text: {
            de: "Bis zu 20 AR-Brillen bilden mit dem Server im Einsatzleitwagen ein lokales WLAN-Mesh ohne Mobilfunk. Alle 2 Sekunden sendet der Hub ein UDP-Beacon auf Port 45454. Alle 5 Sekunden melden Headsets ihren Status per Heartbeat (Akku, CPU, Tracking, Spool).",
            en: "Up to 20 AR headsets form a local Wi-Fi mesh with the command vehicle server without cellular networks. The hub broadcasts a UDP beacon on port 45454 every 2 s. Headsets report status via heartbeat every 5 s (battery, CPU, tracking, spool).",
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "Ausfallsicherer Puffer: Reißt die Funkverbindung ab, speichert der Offline-Spool bis zu 2 GiB Daten und 100.000 Segmente. Läuft der Puffer voll, werden nur alte Raumgeometrien verworfen – Transkripte gehen niemals verloren.",
            en: "Fail-safe spool: if radio links drop, the offline spool stores up to 2 GiB and 100,000 segments. When full, only oldest room meshes are dropped – clinical transcripts are never lost.",
          },
        },
      ],
    },
  ],
};
