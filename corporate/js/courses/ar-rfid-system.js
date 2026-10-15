// Understand 5: "AR-Brille & Patienten-ID: Von RFID/NFC bis ArUco" (DE + EN)
export default {
  id: "ar-rfid-system",
  version: 1,
  section: "understand",
  icon: "helmet",
  title: {
    de: "AR-Brille & Patienten-ID: Von RFID/NFC bis ArUco",
    en: "AR Headset & Patient ID: From RFID/NFC to ArUco",
  },
  subtitle: {
    de: "Sichere Patienten-Zuordnung per Smartphone und AR-Brille",
    en: "Reliable patient identification via phone and AR glasses",
  },
  summary: {
    de: "Wie J.A.R. jeden Patienten im Einsatz eindeutig zuordnet und Daten ins Sichtfeld bringt: warum Patienten heute RFID-/NFC-Tags für den Smartphone-Scan erhalten und wie künftig ArUco-Marker das direkte optische Auslesen mit der AR-Brille übernehmen.",
    en: "How J.A.R. uniquely identifies every patient on scene and brings data into the field of view: why patients today receive RFID/NFC tags scanned by smartphone and how ArUco markers will enable direct optical reading through AR glasses in the future.",
  },
  audience: {
    de: "Für Einsatzkräfte, Führungskräfte, Ärztliche Leiter Rettungsdienst und technische Partner.",
    en: "For responders, incident commanders, medical directors and technical partners.",
  },
  minutes: 15,
  lessons: [
    {
      id: "warum-eindeutige-patienten-id",
      title: {
        de: "Eindeutige Zuordnung am Einsatzort",
        en: "Unambiguous patient matching on scene",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Bei einem Massenanfall von Verletzten (MANV) versorgen mehrere Trupps gleichzeitig Dutzende Patienten auf engstem Raum, während im Sekundentakt Vitalwerte, Verletzungen und Medikamentengaben diktiert werden. Verwechslungen sind lebensgefährlich. Jede Sprachnotiz braucht ab der ersten Sekunde eine harte physische Verknüpfung zum richtigen Patienten.",
            en: "In a mass-casualty incident (MCI), several teams treat dozens of patients side by side in tight spaces while dictating vital signs, injuries and medications every few seconds. Mix-ups cost lives. Every voice note needs a hard physical link to the right patient from the very first second.",
          },
        },
        {
          type: "figure",
          src: {
            de: "../jar-concept-de.png",
            en: "../jar-concept-en.png",
          },
          alt: {
            de: "Dreistufige J.A.R.-Systemarchitektur: Patient mit Tag, Einsatzkraft mit tragbarer Recheneinheit und AR-Brille sowie Einsatzleitfahrzeug.",
            en: "Three-tier J.A.R. system architecture: patient with tag, responder with wearable compute unit and AR glasses, and command vehicle.",
          },
          caption: {
            de: "Dreistufige Architektur mit eindeutiger Patienten-ID (Tag oder Marker), tragbarem System an der Einsatzkraft und lokalem Server im Einsatzleitfahrzeug.",
            en: "Three-tier architecture with a unique patient ID (tag or marker), wearable responder unit and local server in the command vehicle.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Marker gleich Identität (Fail-Closed-Prinzip).** J.A.R. rät niemals, über welchen Patienten gerade gesprochen wird, sondern öffnet und aktualisiert eine Patientenakte erst dann, wenn zuvor ein physischer Tag oder optischer Marker eindeutig ausgelesen wurde.",
              "**Zweistufiger Weg in die Praxis.** Damit Einsatzkräfte schon heute bei jedem Wetter verlässlich arbeiten können, setzt J.A.R. aktuell auf **RFID-/NFC-Tags am Patienten (Auslesen per Smartphone)** und baut darauf das optische Zielsystem mit **ArUco-Markern für die AR-Brille** auf.",
            ],
            en: [
              "**Marker equals identity (fail-closed principle).** J.A.R. never guesses which patient is being discussed, opening and updating a patient record only after a physical tag or optical marker has been positively scanned.",
              "**Two-stage path into field operation.** So crews can work reliably in any weather today, J.A.R. currently relies on **RFID/NFC tags on the patient (scanned via smartphone)** while building toward direct optical reading with **ArUco markers on AR glasses**.",
            ],
          },
        },
      ],
    },
    {
      id: "rfid-nfc-smartphone-heute",
      title: {
        de: "Heute im Einsatz: RFID/NFC-Tags & Smartphone-Scan",
        en: "In the field today: RFID/NFC tags & smartphone scan",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Heutige AR-Brillen stoßen im rauen Außeneinsatz noch an physikalische Grenzen, weil starkes Gegenlicht, Regen, beschlagene Gläser, Dunkelheit sowie Kameraauflösung und Akkulaufzeit das rein optische Lesen von Markern im Feld ausbremsen. Darauf warten wir nicht.",
            en: "Current AR glasses still hit physical limits in harsh outdoor operations because strong backlight, rain, fogged optics, darkness, camera resolution and battery life hold back purely optical marker reading in the field. We do not wait for that.",
          },
        },
        {
          type: "h",
          text: {
            de: "Warum RFID/NFC per Smartphone die Lücke schließt",
            en: "Why RFID/NFC via smartphone bridges the gap",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Passiver RFID-/NFC-Tag am Patienten.** Solange AR-Brillen optische Marker unter widrigen Bedingungen noch nicht sicher genug lesen, erhält jeder Patient einen passiven **RFID-/NFC-Tag** direkt im Pflaster oder auf der Patientenkarte mit rund **180 Byte** Speicher.",
              "**Unempfindlich gegen Schmutz und Dunkelheit.** Der Chip braucht keine Batterie. Er lässt sich auch durch Kleidung, bei Nässe, Blut oder völliger Dunkelheit fehlerfrei auslesen.",
              "**Scan mit dem vorhandenen Smartphone.** Die Einsatzkraft hält ihr Dienst-Smartphone kurz an den RFID-/NFC-Tag des Patienten und schaltet damit sofort genau diese Patientenakte für die laufende Behandlung scharf.",
              "**Direkte Kopplung mit der Spracheingabe.** Alle danach diktierten Befunde, Sichtungskategorien und Maßnahmen werden automatisch mit der gescannten RFID-/NFC-ID verknüpft und an das Einsatzleitfahrzeug übertragen.",
            ],
            en: [
              "**Passive RFID/NFC tag on the patient.** Until AR glasses can read optical markers reliably under all field conditions, every patient receives a passive **RFID/NFC tag** embedded in a plaster or patient card with roughly **180 bytes** of memory.",
              "**Immune to dirt and darkness.** The chip needs no battery. It reads cleanly even through clothing, in rain, blood or complete darkness.",
              "**Scan with a standard smartphone.** The responder briefly taps their duty smartphone against the patient's RFID/NFC tag, immediately locking that exact patient record in for the ongoing treatment.",
              "**Direct link to voice capture.** All subsequently dictated findings, triage categories and interventions are automatically bound to the scanned RFID/NFC ID and synced to the command vehicle.",
            ],
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "**Sofort einsatzbereit.** Der RFID-/NFC-Workflow läuft auf regulären Dienst-Smartphones ohne Spezial-Optik und braucht keine freie Sichtlinie zum Marker.",
            en: "**Ready for immediate deployment.** The RFID/NFC workflow runs on standard duty smartphones without specialised optics and requires no clear line of sight to a marker.",
          },
        },
      ],
    },
    {
      id: "aruco-marker-ar-zukunft",
      title: {
        de: "Zukunftsbild: ArUco-Marker & direktes AR-Sichtfeld",
        en: "Future target: ArUco markers & direct AR field of view",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Sobald die nächste Generation von AR-Brillen bei Kameraauflösung, Kontrastumfang, Gewicht und Laufzeit für den mehrstündigen Feldeinsatz ausgereift ist, bleibt das Smartphone in der Tasche. Beide Hände bleiben frei. Patienten tragen dann **optische ArUco-Marker**, die direkt von der AR-Brille im Vorbeigehen erkannt werden.",
            en: "Once next-generation AR glasses reach the camera resolution, dynamic range, weight and battery life required for multi-hour field deployments, the smartphone stays in the pocket. Both hands stay free. Patients then wear **optical ArUco markers** read directly by the AR headset at a glance.",
          },
        },
        {
          type: "figure",
          src: {
            de: "../assets/hero/poster.webp",
            en: "../assets/hero/poster.webp",
          },
          alt: {
            de: "3D-Render des J.A.R. Einsatzhelms mit integrierter AR-Brille und eingeblendetem Sichtfeld (HUD).",
            en: "3D render of the J.A.R. incident helmet with integrated AR glasses and head-up display (HUD).",
          },
          caption: {
            de: "Zielbild am Patienten mit Einsatzhelm und AR-Visier, das den ArUco-Marker optisch erkennt und Sichtungskategorie, Vitalwerte sowie das 3D-Körpermodell im Sichtfeld einblendet.",
            en: "Target workflow at the patient with helmet-mounted AR display reading the ArUco marker optically and overlaying triage category, vitals and the 3D body model in the line of sight.",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Optisches Auslesen beim Hinsehen.** Jeder Patient trägt einen kontrastreichen, binären **ArUco-Marker**, dessen eindeutige ID, Distanz und dreidimensionale Raumlage die Brillenkamera schon beim ersten Hinsehen berechnet.",
              "**Patientendaten direkt im Sichtfeld.** Über dem Patienten erscheinen Sichtungskategorie (SK I bis SK IV), Vitalwerte, offene Maßnahmen und das **13-Regionen-3D-Körpermodell** direkt im Head-Up-Display (HUD).",
              "**Optical-Flow-Tracking mit Sicherheits-Abschaltung.** Verdecken die Hände der Einsatzkraft während der Versorgung kurz den ArUco-Marker, hält ein **Lucas-Kanade Optical-Flow-Tracker** die Einblendung stabil am Patienten fest, schaltet das Overlay bei komplettem Spurverlust aber sofort ab (*Fail Closed*), damit niemals Werte eines falschen Patienten im Bild stehenbleiben.",
              "**Freihändige Bedienung mit Handschuhen.** Über Sprachbefehle, Blicksteuerung (Gaze-Dwell) und ein optisch ablesbares ArUco-Unterarmband steuert die Einsatzkraft alle Funktionen ohne Berührung eines Bildschirms.",
            ],
            en: [
              "**Optical reading at a glance.** Every patient wears a high-contrast binary **ArUco marker** whose unique ID, distance and 3D pose in space are computed by the headset camera as soon as the responder looks at the patient.",
              "**Patient data anchored in the field of view.** Triage category (SK I to SK IV), vital signs, pending measures and the **13-region 3D body model** appear right above the patient in the head-up display (HUD).",
              "**Optical-flow coasting with fail-closed cutoff.** When the responder's hands briefly cover the ArUco marker during care, a **Lucas-Kanade optical-flow tracker** keeps the overlay anchored to the patient, yet drops it immediately if tracking is lost (*fail closed*) so data from another patient can never linger on screen.",
              "**Hands-free control with gloves.** Using voice commands, gaze-dwell selection and an optically tracked ArUco forearm wristband, responders control every step without touching a display.",
            ],
          },
        },
        {
          type: "link",
          href: "../demo/paramedic/",
          label: {
            de: "Interaktive AR-Client-Demo starten",
            en: "Launch interactive AR client demo",
          },
        },
      ],
    },
  ],
};
