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
      quiz: [
        {
          q: {
            de: "Was geschieht nach dem Fail-Closed-Prinzip, wenn die Einsatzkraft spricht, ohne dass zuvor ein Tag gescannt wurde?",
            en: "According to the fail-closed principle, what happens if a responder speaks before scanning a patient tag?",
          },
          options: [
            {
              de: "Es wird keine Patientenakte geöffnet oder verändert; das Audio verbleibt im lokalen Puffer.",
              en: "No patient record is opened or modified; audio remains safely in the local buffer.",
            },
            {
              de: "Das System ordnet die Daten automatisch dem geografisch nächsten Patienten zu.",
              en: "The system automatically assigns data to the geographically nearest patient.",
            },
            {
              de: "Die AR-Brille bricht die Spracherkennung mit einem lauten Alarmton ab.",
              en: "The AR headset aborts speech recognition with a loud alarm tone.",
            },
            {
              de: "Die Daten werden sofort an die Cloud gesendet, damit ein Leitstellen-Disponent entscheidet.",
              en: "The data is immediately sent to the cloud for a dispatch operator to decide.",
            },
          ],
          answer: 0,
          explain: {
            de: "Fail-closed bedeutet: J.A.R. rät niemals. Ohne verifizierten Tag-Scan wird keine Akte angelegt oder überschrieben.",
            en: "Fail-closed means J.A.R. never guesses. Without a verified tag scan, no patient file is created or altered.",
          },
        },
        {
          q: {
            de: "Welche technischen Eigenschaften machen den passiven RFID/NFC-Tag ideal für den Katastropheneinsatz?",
            en: "Which technical properties make the passive RFID/NFC tag ideal for mass-casualty triage?",
          },
          options: [
            {
              de: "Er benötigt keine Batterie, fasst rund 180 Byte und funktioniert bei Nässe, Blut, Schmutz und Dunkelheit.",
              en: "It requires no battery, holds roughly 180 bytes, and works in wet conditions, blood, dirt and darkness.",
            },
            {
              de: "Er sendet per GPS kontinuierlich Live-Koordinaten über 10 Kilometer.",
              en: "It continuously broadcasts live GPS coordinates over 10 kilometres.",
            },
            {
              de: "Er speichert hochauflösende Röntgenbilder direkt auf dem Chip.",
              en: "It stores high-resolution X-ray scans directly on the chip.",
            },
            {
              de: "Er ersetzt die AR-Brille vollständig durch ein integriertes Display.",
              en: "It completely replaces the AR headset with an integrated display.",
            },
          ],
          answer: 0,
          explain: {
            de: "Der passive 180-Byte-Tag benötigt keine eigene Stromversorgung und lässt sich selbst durch dicke Einsatzkleidung, Schmutz oder bei Dunkelheit kontaktlos auslesen.",
            en: "The passive 180-byte tag requires no power source and reads contactlessly through heavy clothing, dirt, fluids or complete darkness.",
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
      quiz: [
        {
          q: {
            de: "Welchen Hauptvorteil bietet das AR-Visier Heiligenschein während der Patientenversorgung?",
            en: "What is the primary benefit of the Heiligenschein AR visor during casualty care?",
          },
          options: [
            {
              de: "Beide Hände bleiben frei für lebensrettende Maßnahmen, während Vitalwerte und Triage im Sichtfeld stehen.",
              en: "Both hands remain completely free for life-saving care while vitals and triage stay in view.",
            },
            {
              de: "Es blockiert das Sichtfeld vollständig, um Ablenkungen am Unfallort auszublenden.",
              en: "It completely blocks the field of view to eliminate distractions at the scene.",
            },
            {
              de: "Es ersetzt die Notwendigkeit von Verbandmaterial und Tourniquets durch Laserimpulse.",
              en: "It replaces bandages and tourniquets with therapeutic laser pulses.",
            },
            {
              de: "Es dient ausschließlich als Sonnenblende bei Einsätzen am Tag.",
              en: "It serves purely as a sun visor during daytime operations.",
            },
          ],
          answer: 0,
          explain: {
            de: "Das AR-Visier ermöglicht freihändiges Arbeiten: Triage-Kategorie, Vitalwerte und Körpermodell werden blickfeldfest eingeblendet, ohne dass ein Tablet gehalten werden muss.",
            en: "The AR visor enables hands-free operation: triage category, vitals and the body model are displayed in the field of view without needing to hold a tablet.",
          },
        },
        {
          q: {
            de: "Wie werden Verletzungen auf dem virtuellen 13-Regionen-Körpermodell dokumentiert?",
            en: "How are injuries documented on the virtual 13-region body model?",
          },
          options: [
            {
              de: "Über Sprachbefehle wie 'Starke Blutung rechter Oberschenkel' oder Gestensteuerung, direkt den 13 Regionen zugeordnet.",
              en: "Via voice commands like 'Heavy bleeding right thigh' or gestures, directly bound to the 13 anatomical regions.",
            },
            {
              de: "Ausschließlich durch handschriftliche Notizen auf der Papier-Sichtungskarte.",
              en: "Exclusively via handwritten notes on the paper triage card.",
            },
            {
              de: "Durch automatische Röntgenstrahlung aus der AR-Kamera.",
              en: "Through automated X-ray radiation from the AR camera.",
            },
            {
              de: "Verletzungen können im System nicht anatomisch zugeordnet werden.",
              en: "Injuries cannot be anatomically localized in the system.",
            },
          ],
          answer: 0,
          explain: {
            de: "Das 13-Regionen-Modell ordnet Befunde (Blutung, Fraktur, Wunde) per Sprache oder Gaze-Auswahl präzise Körperregionen zu und verankert sie am Patientenmarker.",
            en: "The 13-region model maps findings (bleeding, fracture, wound) precisely to body regions via voice or gaze selection, anchoring them to the patient marker.",
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
      quiz: [
        {
          q: {
            de: "Was passiert mit aufgezeichneten Transkripten, wenn der Offline-Spool (2 GiB) bei Verbindungsabbruch vollzulaufen droht?",
            en: "What happens to recorded transcripts if the offline spool (2 GiB) threatens to fill up during link loss?",
          },
          options: [
            {
              de: "Es werden ausschließlich ältere Raumgeometrie-Meshes verworfen; Transkript-Segmente werden niemals gelöscht.",
              en: "Only older room-geometry meshes are discarded; transcript segments are never dropped.",
            },
            {
              de: "Das Headset löscht zuerst die ältesten Patientenbefunde, um Platz für Audio zu schaffen.",
              en: "The headset deletes the oldest patient findings first to create room for audio.",
            },
            {
              de: "Das gesamte Dateisystem wird formatiert und neu initialisiert.",
              en: "The entire file system is formatted and re-initialised.",
            },
            {
              de: "Die Brille schaltet sich sofort ab, um Datenverlust zu verhindern.",
              en: "The headset immediately shuts down to prevent data corruption.",
            },
          ],
          answer: 0,
          explain: {
            de: "Die Priorisierungslogik garantiert: Klinische Befunde und Transkript-Segmente besitzen höchste Priorität und werden niemals verworfen. Nur 3D-Karten-Revisionen werden freigegeben.",
            en: "The prioritization logic guarantees: clinical findings and transcripts have highest priority and are never dropped. Only 3D spatial mesh revisions are discarded.",
          },
        },
        {
          q: {
            de: "Über welchen Mechanismus finden AR-Brillen den Hub im Einsatzleitfahrzeug im lokalen Netz?",
            en: "By what mechanism do AR headsets discover the command vehicle hub on the local network?",
          },
          options: [
            {
              de: "Über einen UDP-Discovery-Beacon auf Port 45454, der alle 2 Sekunden ausgesendet wird.",
              en: "Via a UDP discovery beacon on port 45454 broadcast every 2 seconds.",
            },
            {
              de: "Über eine weltweite DNS-Abfrage an öffentliche Google-Server.",
              en: "Via a global DNS lookup to public Google servers.",
            },
            {
              de: "Durch manuelles Scannen eines Papier-QR-Codes auf dem Wagendach.",
              en: "By manually scanning a paper QR code on the vehicle roof.",
            },
            {
              de: "Ausschließlich über Bluetooth Low Energy mit maximal 1 Meter Reichweite.",
              en: "Exclusively via Bluetooth Low Energy with a maximum 1-metre range.",
            },
          ],
          answer: 0,
          explain: {
            de: "Der Hub sendet alle 2 Sekunden ein UDP-Beacon auf Port 45454. Die Brillen klinken sich automatisch ein und senden alle 5 Sekunden ihren Heartbeat.",
            en: "The hub broadcasts a UDP beacon on port 45454 every 2 seconds. Headsets join automatically and report telemetry heartbeats every 5 seconds.",
          },
        },
      ],
    },
  ],
};
