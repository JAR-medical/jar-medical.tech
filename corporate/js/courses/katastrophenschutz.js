// Produktschulung "J.A.R. im Katastrophenschutz" — plain course data (DE + EN).
// Content is limited to what index.html, the AR client (demo/paramedic/) and demo/ describe.
export default {
  id: "katastrophenschutz",
  version: 1,
  icon: "triage", // see js/icons.js
  title: {
    de: "J.A.R. im Katastrophenschutz",
    en: "J.A.R. in civil protection",
  },
  subtitle: {
    de: "Produktschulung: AR-Sichtung und Lagebild",
    en: "Product training: AR triage and operating picture",
  },
  summary: {
    de: "Diese Schulung zeigt, wie J.A.R. Sichtung, Dokumentation und Informationsfluss im MANV unterstützen soll – vom AR-Client des Trupps bis zum Lagebild der Einsatzleitung. Sie lernen Bedienung, Datenschutz und die Grenzen des Prototyps kennen und erfahren, wie Sie J.A.R. in Ihrer Organisation ausprobieren können.",
    en: "This course shows how J.A.R. is meant to support triage, documentation and the flow of information in a mass-casualty incident – from the team's AR client to incident command's operating picture. You will learn how it is operated, how it handles privacy, where the prototype's limits are, and how to try J.A.R. in your own organisation.",
  },
  audience: {
    de: "Für Einsatzkräfte und Führungskräfte aus Rettungsdienst, Feuerwehr, Hilfsorganisationen und Katastrophenschutz-Einheiten, die J.A.R. nutzen oder bewerten möchten.",
    en: "For responders and commanders in EMS, fire services, relief organisations and civil-protection units who want to use or evaluate J.A.R.",
  },
  minutes: 58,
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: "warum-jar",
      title: { de: "Warum J.A.R.?", en: "Why J.A.R.?" },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Bei großen Verletzungslagen – dem **MANV** – müssen alle Patientinnen und Patienten schnell und vollständig gesichtet werden. Die Informationen sollen lückenlos bei der Einsatzleitung und bei allen behandelnden Einsatzkräften ankommen. Genau an diesem Informationsfluss setzt J.A.R. an.",
            en: "In a major incident with many casualties – a **mass-casualty incident (MCI)** – every patient has to be triaged quickly and completely. The information must reach incident command and every treating responder without gaps. That flow of information is exactly where J.A.R. comes in.",
          },
        },
        { type: "h", text: { de: "Sichtung heute: Papier, Funk und verlorene Zeit", en: "Triage today: paper, radio and lost time" } },
        {
          type: "list",
          items: {
            de: [
              "Sämtliche Informationen eines Patienten – inklusive aller medizinischen Maßnahmen – werden auf einer **Sichtungskarte aus Papier** festgehalten.",
              "Die Informationen müssen erst von den Sichtungstrupps an die Einsatzleitung übertragen werden. Eine **Live-Übertragung ist nicht möglich**.",
              "Wer einen Patienten übernimmt, muss sich erst „einlesen“ – Zeit, die in der Behandlung fehlt.",
            ],
            en: [
              "Everything about a patient – including every medical measure taken – is recorded on a **paper triage tag**.",
              "The triage teams then have to pass that information on to incident command. **Live transmission is not possible.**",
              "Whoever takes over a patient first has to “read up” on them – time that is missing from treatment.",
            ],
          },
        },
        { type: "h", text: { de: "Die Idee: Sichtung direkt im Blickfeld", en: "The idea: triage right in your field of view" } },
        {
          type: "p",
          text: {
            de: "J.A.R. verbindet **Augmented Reality** und **Edge-AI** zu einem durchgängigen Informationsfluss vom ersten Sichtungstrupp bis zur Einsatzleitung. Drei Bausteine tragen die Idee:",
            en: "J.A.R. combines **augmented reality** and **edge AI** into one continuous flow of information, from the first triage team all the way to incident command. Three building blocks carry the idea:",
          },
        },
        {
          type: "table",
          head: { de: ["Baustein", "Was er leisten soll"], en: ["Building block", "What it is meant to do"] },
          rows: {
            de: [
              ["AR-HUD im Blickfeld", "Relevante Informationen erscheinen über ein Head-up-Display in der Brille – inklusive Benachrichtigungen der Einsatzleitung. Die Hände bleiben frei für die Versorgung."],
              ["Live-Lagebild statt Papier", "Patienten erhalten einfache Identifikationsnummern. Ihre Daten werden bei der Behandlung eingeblendet und stehen der Einsatzleitung in Echtzeit zur Verfügung."],
              ["Edge-AI-Transkription", "Maßnahmen werden per Sprache protokolliert. Die Transkription läuft direkt auf dem Gerät – auch ohne stabile Netzverbindung."],
            ],
            en: [
              ["AR HUD in the field of view", "Relevant information appears on a head-up display in the headset – including notifications from incident command. Hands stay free for patient care."],
              ["Live operating picture instead of paper", "Patients get simple ID numbers. Their data is shown during treatment and is available to incident command in real time."],
              ["Edge-AI transcription", "Measures are logged by voice. Transcription runs directly on the device – even without a stable network connection."],
            ],
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "**Einordnung:** J.A.R. ist ein Startup- und Schülerprojekt (Gymnasium Neubiberg, UnternehmerTUM Makerspace, LMU). Was Sie in dieser Schulung sehen, sind Prototypen und Demos – kein fertiges, zugelassenes Produkt.",
            en: "**Context:** J.A.R. is a student startup project (Gymnasium Neubiberg, UnternehmerTUM Makerspace, LMU). What you see in this course are prototypes and demos – not a finished, approved product.",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Welches Problem der heutigen Sichtung beschreibt J.A.R. als Ausgangslage?",
            en: "Which problem with today's triage does J.A.R. start from?",
          },
          options: [
            { de: "Es gibt zu viele Einsatzkräfte an der Einsatzstelle.", en: "There are too many responders on scene." },
            { de: "Die Daten auf der Papierkarte erreichen die Einsatzleitung nicht live.", en: "The data on the paper tag does not reach incident command live." },
            { de: "Sichtungskarten sind zu teuer.", en: "Triage tags are too expensive." },
            { de: "Die Einsatzleitung kann keine Funkgeräte nutzen.", en: "Incident command cannot use radios." },
          ],
          answer: 1,
          explain: {
            de: "Die Informationen müssen erst von den Sichtungstrupps an die Einsatzleitung übertragen werden – eine Live-Übertragung ist mit Papier nicht möglich.",
            en: "The information has to be relayed from the triage teams to incident command first – with paper, live transmission is not possible.",
          },
        },
        {
          q: {
            de: "Wo soll die Transkription der gesprochenen Maßnahmen laufen?",
            en: "Where is transcription of spoken measures meant to run?",
          },
          options: [
            { de: "Direkt auf dem Gerät, als Edge-AI", en: "Directly on the device, as edge AI" },
            { de: "In einem Rechenzentrum im Ausland", en: "In a data centre abroad" },
            { de: "Bei der Integrierten Leitstelle per Telefon", en: "At the dispatch centre, by phone" },
            { de: "Gar nicht – Maßnahmen werden weiter auf Papier notiert", en: "Nowhere – measures are still written on paper" },
          ],
          answer: 0,
          explain: {
            de: "Die Transkription läuft als Edge-AI direkt auf dem Gerät – schnell, robust und auch ohne stabile Netzverbindung.",
            en: "Transcription runs as edge AI directly on the device – fast, robust and even without a stable network connection.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 2
    {
      id: "system-ueberblick",
      title: { de: "Das System im Überblick", en: "The system at a glance" },
      minutes: 8,
      blocks: [
        {
          type: "p",
          text: {
            de: "Die Konzeptübersicht zeigt, wie die Komponenten von J.A.R. ineinandergreifen sollen: vom Patienten über die Einsatzkraft mit AR-Brille bis zum Server im Einsatzleitfahrzeug.",
            en: "The concept overview shows how J.A.R.'s components are meant to work together: from the patient, through the responder wearing AR glasses, to the server in the command vehicle.",
          },
        },
        {
          type: "figure",
          src: { de: "../jar-concept-de.png", en: "../jar-concept-en.png" },
          alt: {
            de: "Konzeptübersicht mit drei Bereichen: Patient (NFC-Tag im Pflaster), Sanitäter (Client-Side Compute Unit und AR-Brille) und Einsatzleitfahrzeug (Server mit Weboberfläche und Edge AI), verbunden durch Pfeile in beide Richtungen.",
            en: "Concept overview with three areas: patient (NFC tag in a plaster), paramedic (client-side compute unit and AR glasses) and command vehicle (server with web interface and edge AI), connected by arrows in both directions.",
          },
          caption: {
            de: "Abb. 1 – J.A.R.-Konzeptübersicht: Patient, Sanitäter, Einsatzleitfahrzeug.",
            en: "Fig. 1 – J.A.R. concept overview: patient, paramedic, command vehicle.",
          },
        },
        { type: "h", text: { de: "Die drei Bereiche", en: "The three areas" } },
        {
          type: "table",
          head: { de: ["Bereich", "Komponente", "Aufgabe im Konzept"], en: ["Area", "Component", "Role in the concept"] },
          rows: {
            de: [
              ["Patient", "NFC-Tag", "im Pflaster integriert, ca. 180 Byte Speicher"],
              ["Sanitäter", "Client-Side Compute Unit", "Transkription, Mesh-Kommunikation"],
              ["Sanitäter", "AR-Brille", "Darstellung der Patientendaten, Mikrofon"],
              ["Einsatzleitfahrzeug", "Server mit Weboberfläche", "Darstellung aller Patienten und Einsatztrupps"],
              ["Einsatzleitfahrzeug", "Edge AI", "kleines Sprachmodell (LLM) mit hohem Durchsatz und hoher Parallelität"],
            ],
            en: [
              ["Patient", "NFC tag", "built into a plaster, about 180 bytes of storage"],
              ["Paramedic", "Client-side compute unit", "transcription, mesh communication"],
              ["Paramedic", "AR glasses", "display of patient data, microphone"],
              ["Command vehicle", "Server with web interface", "display of all patients and teams"],
              ["Command vehicle", "Edge AI", "small language model (LLM) with high throughput and high parallelism"],
            ],
          },
        },
        {
          type: "p",
          text: {
            de: "Die Daten fließen in beide Richtungen: Was der Trupp am Patienten festhält, soll im Lagebild der Einsatzleitung erscheinen – und Benachrichtigungen der Einsatzleitung sollen im HUD der Einsatzkräfte ankommen.",
            en: "Data flows both ways: whatever the team records at the patient is meant to appear in incident command's operating picture – and notifications from incident command are meant to reach the responders' HUD.",
          },
        },
        { type: "h", text: { de: "Konzept und heutiger Prototyp", en: "Concept versus today's prototype" } },
        {
          type: "p",
          text: {
            de: "Die Abbildung beschreibt das Zielbild. Die heute verfügbaren Teile sind zwei eigenständige Web-Anwendungen: der **AR-Client** für den Trupp (TriARge) und das **Lagebild** der Einsatzleitung als Live-Demo. Beide laufen ohne Installation im Browser.",
            en: "The figure describes the target picture. The parts available today are two separate web apps: the **AR client** for the team (TriARge) and incident command's **operating picture** as a live demo. Both run in the browser without installation.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "Im Prototyp hängt am Patienten **eine gedruckte Umhängekarte mit QR-Code** statt eines NFC-Tags.",
              "Der AR-Client ist eine statische Web-App ohne Backend: der Einsatz lebt im Speicher der laufenden Sitzung.",
              "Die Verbindung zwischen AR-Client und Lagebild über einen zentralen Server (Hub) ist der **nächste Entwicklungsschritt** – heute erzeugt die Lagebild-Demo ihre Daten in einer Simulation.",
            ],
            en: [
              "In the prototype, the patient wears **a printed hanging tag with a QR code** instead of an NFC tag.",
              "The AR client is a static web app with no backend: the incident lives in the memory of the current session.",
              "Connecting the AR client and the operating picture through a central server (hub) is the **next development step** – today the operating-picture demo generates its data in a simulation.",
            ],
          },
        },
        { type: "h", text: { de: "Geräte und Betriebsarten des AR-Clients", en: "Devices and modes of the AR client" } },
        {
          type: "table",
          head: { de: ["Betriebsart", "Was sie tut", "Wo sie läuft"], en: ["Mode", "What it does", "Where it runs"] },
          rows: {
            de: [
              ["AR-Modus", "Lagekarte und Ablauf im Blickfeld, bedient per Blick, Hand oder Controller", "PICO 4 (Enterprise), Meta Quest, Microsoft HoloLens 2"],
              ["Kamera-Modus", "derselbe Ablauf flach, mit echtem QR-Scan der Umhängekarte", "Handy, Laptop"],
              ["Simulation", "derselbe Ablauf ohne Kamera und ohne Headset", "überall"],
            ],
            en: [
              ["AR mode", "Situation map and workflow in the field of view, operated by gaze, hand or controller", "PICO 4 (Enterprise), Meta Quest, Microsoft HoloLens 2"],
              ["Camera mode", "the same workflow on a flat screen, with real QR scanning of the hanging tag", "phone, laptop"],
              ["Simulation", "the same workflow without camera or headset", "anywhere"],
            ],
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Die Startseite des AR-Clients prüft das Gerät und sperrt Betriebsarten, die es nicht beherrscht. Ablauf, Bedienung und Lagekarte sind auf allen drei Brillen dieselben.",
            en: "The AR client's start page checks the device and locks any mode it cannot support. Workflow, controls and situation map are the same on all three headsets.",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Wo steht laut Konzept der Server mit der Weboberfläche für alle Patienten und Einsatztrupps?",
            en: "According to the concept, where is the server with the web interface for all patients and teams?",
          },
          options: [
            { de: "In der AR-Brille", en: "In the AR glasses" },
            { de: "Im Pflaster am Patienten", en: "In the plaster on the patient" },
            { de: "Im Einsatzleitfahrzeug", en: "In the command vehicle" },
          ],
          answer: 2,
          explain: {
            de: "Die Konzeptübersicht ordnet den Server mit Weboberfläche und die Edge AI dem Einsatzleitfahrzeug zu.",
            en: "The concept overview places the server with web interface and the edge AI in the command vehicle.",
          },
        },
        {
          q: {
            de: "Womit wird ein Patient im heutigen Prototyp gekennzeichnet?",
            en: "How is a patient marked in today's prototype?",
          },
          options: [
            { de: "Mit einem NFC-Tag im Pflaster", en: "With an NFC tag in a plaster" },
            { de: "Gar nicht – nur über die GPS-Position", en: "Not at all – only by GPS position" },
            { de: "Mit einem Farbband am Handgelenk", en: "With a coloured wristband" },
            { de: "Mit einer gedruckten Umhängekarte mit QR-Code", en: "With a printed hanging tag carrying a QR code" },
          ],
          answer: 3,
          explain: {
            de: "Das NFC-Tag ist Teil des Konzepts. Der Prototyp arbeitet mit gedruckten, nummerierten Umhängekarten mit QR-Code.",
            en: "The NFC tag is part of the concept. The prototype uses printed, numbered hanging tags with QR codes.",
          },
        },
        {
          q: {
            de: "Welche Betriebsart des AR-Clients braucht weder Kamera noch Headset?",
            en: "Which AR client mode needs neither a camera nor a headset?",
          },
          options: [
            { de: "AR-Modus", en: "AR mode" },
            { de: "Simulation", en: "Simulation" },
            { de: "Kamera-Modus", en: "Camera mode" },
          ],
          answer: 1,
          explain: {
            de: "Die Simulation zeigt denselben Ablauf ohne Kamera und ohne Headset und läuft deshalb überall.",
            en: "Simulation shows the same workflow without camera or headset, so it runs anywhere.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 3
    {
      id: "ar-client-im-einsatz",
      title: { de: "Der AR-Client im Einsatz", en: "The AR client in action" },
      minutes: 10,
      blocks: [
        {
          type: "p",
          text: {
            de: "Der AR-Client TriARge ist der Trupp-Teil von J.A.R. Im MANV macht nicht dieselbe Person alles – deshalb beginnt jeder Einsatz mit einer Frage: **Was machen Sie gerade?**",
            en: "The TriARge AR client is the team side of J.A.R. In a mass-casualty incident, no single person does everything – so every deployment starts with one question: **What are you doing right now?**",
          },
        },
        { type: "h", text: { de: "Der Ablauf", en: "The workflow" } },
        {
          type: "steps",
          items: {
            de: [
              "**Tätigkeit wählen:** Vorsichtung, Sichtung (ärztlich), Registrierung oder Behandlung & Transport.",
              "Die **Lagekarte** zeigt alle bereits angelegten Patienten dieses Einsatzes – zu Beginn ist sie leer.",
              "**„Neuer Patient“:** Im AR-Modus wandert ein Ring über den Boden; Sie zeigen auf die Stelle, an der der Patient liegt, und setzen ihn fest. Flach (Handy, Laptop) entsteht der Patient dort, wo Sie stehen.",
              "Am Patienten erledigen Sie, **was Ihre Tätigkeit vorsieht**.",
              "Weiter zum **nächsten** Patienten.",
            ],
            en: [
              "**Choose your task:** pre-triage, triage (physician), registration, or treatment & transport.",
              "The **situation map** shows every patient already created in this incident – at the start it is empty.",
              "**“New patient”:** in AR mode a ring travels across the ground; you point at the spot where the patient lies and fix it. On a flat screen (phone, laptop) the patient is created where you are standing.",
              "At the patient you do **whatever your task calls for**.",
              "Move on to the **next** patient.",
            ],
          },
        },
        { type: "h", text: { de: "Die vier Tätigkeiten", en: "The four tasks" } },
        {
          type: "p",
          text: {
            de: "Die Wahl ist keine Beschriftung: Sie bestimmt, was beim Öffnen eines Patienten passiert und ob Sie neue Patienten anlegen dürfen. Die gewählte Tätigkeit steht oben links im Blickfeld und auf **jeder Protokollzeile** – so lässt sich später sagen, ob eine Kategorie aus der Vorsichtung oder aus der ärztlichen Sichtung stammt. Gewechselt wird jederzeit über die Lage.",
            en: "The choice is not just a label: it decides what happens when you open a patient and whether you may create new ones. Your task is shown at the top left of the field of view and on **every protocol line** – so it is clear afterwards whether a category came from pre-triage or from physician triage. You can switch at any time via the situation view.",
          },
        },
        {
          type: "table",
          head: { de: ["Tätigkeit", "Am Patienten", "Neue anlegen?"], en: ["Task", "At the patient", "Create new?"] },
          rows: {
            de: [
              ["Vorsichtung", "Ja/Nein-Fragebogen → vorgeschlagene Kategorie → Umhängekarte", "ja"],
              ["Sichtung (ärztlich)", "Kategorie direkt wählen, SK IV regulär möglich", "ja"],
              ["Registrierung", "direkt in den Kartenschritt – Karte zuweisen oder Nummer ändern", "ja"],
              ["Behandlung & Transport", "Maßnahmen festhalten, Abtransport buchen", "nein"],
            ],
            en: [
              ["Pre-triage", "yes/no questionnaire → suggested category → hanging tag", "yes"],
              ["Triage (physician)", "choose the category directly, SK IV available as a regular option", "yes"],
              ["Registration", "straight to the tag step – assign a tag or change its number", "yes"],
              ["Treatment & transport", "record measures, book the transport", "no"],
            ],
          },
        },
        {
          type: "p",
          text: {
            de: "Behandlung & Transport legt bewusst niemanden an: Wer behandelt, arbeitet an Patienten, die schon auf der Lagekarte stehen. Eine Maßnahme nimmt man durch erneutes Antippen zurück. Abtransportierte Patienten bleiben auf der Karte, wo sie lagen – Marker und Kartenpunkt werden aber matt.",
            en: "Treatment & transport deliberately creates no one: whoever treats works on patients already on the situation map. Tapping a measure again removes it. Transported patients stay on the map where they lay, but their marker and map dot are dimmed.",
          },
        },
        { type: "h", text: { de: "Umhängekarte und Nummer", en: "Hanging tag and number" } },
        {
          type: "list",
          items: {
            de: [
              "**Erst sichten, dann die Karte:** Die Umhängekarte wird zuletzt umgehängt und ihre Nummer zugewiesen – per Scan oder von Hand.",
              "Die Karten sind **austauschbare, nummerierte Rohlinge**. Welche Karte zu welchem Patienten gehört, entscheidet sich im Einsatz.",
              "Eine Karte kann nur an **einem** Patienten hängen; die App bucht sie nicht still auf einen anderen um.",
              "Liefert das Gerät keine Kamera, wählen Sie die Nummer mit **−/+**. Der Ablauf läuft in beiden Fällen durch.",
            ],
            en: [
              "**Triage first, tag last:** the hanging tag goes on at the end and its number is assigned – by scan or by hand.",
              "The tags are **interchangeable, numbered blanks**. Which tag belongs to which patient is decided on scene.",
              "A tag can hang on only **one** patient; the app never silently moves it to someone else.",
              "If the device provides no camera, you pick the number with **−/+**. The workflow completes either way.",
            ],
          },
        },
        { type: "h", text: { de: "Marker am Boden und das HUD", en: "Ground markers and the HUD" } },
        {
          type: "list",
          items: {
            de: [
              "Über jedem angelegten Patienten liegt ein **Ring am Boden** – gefüllt in der Sichtungsfarbe, gestrichelt, solange er ungesichtet ist.",
              "Der Marker **ist** die Schaltfläche: Einen Patienten öffnen Sie, indem Sie seinen Marker anklicken. Von selbst geht nichts auf.",
              "Treten Sie auf etwa **drei Meter** heran, steigt über dem Marker eine kleine Anzeige auf: Nummer, Sichtungskategorie, Karte und ob schon etwas festgehalten wurde.",
              "Alles zu einem Patienten – Handlungskarte, Körpermodell, Anzeige – steht **raumfest über seinem Marker** und wandert nicht mit Ihnen mit.",
              "Das HUD sitzt an den **Rändern** des Blickfelds, die Mitte bleibt frei. Es zieht erst nach, wenn Ihr Blick rund 40° abgewandert ist. Solange kein Schritt ansteht, gibt es nur zwei kleine Knöpfe am unteren Rand: „Neuer Patient“ und „Tätigkeit“.",
            ],
            en: [
              "Every patient you create gets a **ring on the ground** – filled in the triage colour, dashed while still untriaged.",
              "The marker **is** the button: you open a patient by selecting their marker. Nothing opens by itself.",
              "Step within about **three metres** and a small display rises above the marker: number, triage category, tag, and whether anything has been recorded yet.",
              "Everything belonging to a patient – action card, body model, display – stays **anchored above their marker** and does not follow you around.",
              "The HUD sits at the **edges** of the field of view, keeping the centre clear. It only follows once your gaze has moved about 40° away. While no step is pending there are just two small buttons at the bottom: “New patient” and “Task”.",
            ],
          },
        },
        { type: "h", text: { de: "Bedienung", en: "Controls" } },
        {
          type: "table",
          head: { de: ["Eingabe", "So funktioniert sie", "Hinweis"], en: ["Input", "How it works", "Note"] },
          rows: {
            de: [
              ["Blick + Verweilen", "Fadenkreuz in der Blickmitte, 1,1 s auf einem Knopf löst aus", "funktioniert überall, trägt auf der PICO"],
              ["Controller", "Strahl zielen, Trigger drücken", "PICO, Quest"],
              ["Hände", "direkt antippen", "HoloLens 2; der PICO-Browser stellt keine Handeingabe bereit"],
            ],
            en: [
              ["Gaze + dwell", "crosshair in the centre of view; resting 1.1 s on a button triggers it", "works everywhere; the main input on PICO"],
              ["Controller", "aim the ray, pull the trigger", "PICO, Quest"],
              ["Hands", "tap directly", "HoloLens 2; the PICO browser offers no hand input"],
            ],
          },
        },
        {
          type: "link",
          href: "../demo/paramedic/",
          label: { de: "AR-Client selbst ausprobieren", en: "Try the AR client yourself" },
        },
      ],
      quiz: [
        {
          q: {
            de: "In welcher Tätigkeit können Sie keine neuen Patienten anlegen?",
            en: "In which task can you not create new patients?",
          },
          options: [
            { de: "Vorsichtung", en: "Pre-triage" },
            { de: "Registrierung", en: "Registration" },
            { de: "Sichtung (ärztlich)", en: "Triage (physician)" },
            { de: "Behandlung & Transport", en: "Treatment & transport" },
          ],
          answer: 3,
          explain: {
            de: "Wer behandelt, arbeitet an Patienten, die schon auf der Lagekarte stehen – deshalb legt Behandlung & Transport bewusst niemanden an.",
            en: "Whoever treats works on patients already on the situation map – so treatment & transport deliberately creates no one.",
          },
        },
        {
          q: {
            de: "Wie öffnen Sie im AR-Modus einen bereits angelegten Patienten?",
            en: "How do you open an existing patient in AR mode?",
          },
          options: [
            { de: "Indem Sie seinen Marker am Boden anklicken", en: "By selecting their marker on the ground" },
            { de: "Er öffnet sich automatisch, sobald Sie näher als drei Meter herantreten", en: "It opens automatically once you are within three metres" },
            { de: "Nur über die Einsatzleitung", en: "Only via incident command" },
          ],
          answer: 0,
          explain: {
            de: "Der Marker ist die Schaltfläche. Ab drei Metern erscheint zwar eine Anzeige, geöffnet wird aber nur, was Sie anklicken.",
            en: "The marker is the button. A display appears from three metres, but only what you select is opened.",
          },
        },
        {
          q: {
            de: "Wann wird die Umhängekarte zugewiesen?",
            en: "When is the hanging tag assigned?",
          },
          options: [
            { de: "Vor dem Einsatz, fest pro Patient vorgedruckt", en: "Before the incident, pre-printed for each patient" },
            { de: "Zuletzt – erst sichten, dann Karte umhängen und Nummer zuweisen", en: "Last – triage first, then hang the tag and assign its number" },
            { de: "Gar nicht, die App vergibt nur interne Nummern", en: "Never; the app only uses internal numbers" },
          ],
          answer: 1,
          explain: {
            de: "Die Karten sind austauschbare Rohlinge. Erst wird gesichtet, dann die Karte umgehängt und ihre Nummer per Scan oder von Hand zugewiesen.",
            en: "The tags are interchangeable blanks. Triage comes first, then the tag is hung and its number assigned by scan or by hand.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 4
    {
      id: "am-patienten-dokumentieren",
      title: { de: "Am Patienten dokumentieren", en: "Documenting at the patient" },
      minutes: 10,
      blocks: [
        {
          type: "p",
          text: {
            de: "Am geöffneten Patienten steht neben der Handlungskarte ein **Körpermodell** – ein geschlechtsneutraler Mensch, aufgeteilt in **dreizehn Regionen**. Hier halten Sie fest, wo es den Patienten getroffen hat.",
            en: "Next to the action card of an open patient stands a **body model** – a gender-neutral human figure divided into **thirteen regions**. This is where you record where the patient is injured.",
          },
        },
        { type: "h", text: { de: "Befunde am Körpermodell", en: "Findings on the body model" } },
        {
          type: "steps",
          items: {
            de: [
              "Drehen Sie das Modell: mit dem Controller greifen und ziehen. Nur mit Blick dreht es sich von selbst weiter und hält an, sobald Ihr Blick auf einem Körperteil liegt.",
              "Tippen Sie die betroffene **Region** an.",
              "Wählen Sie einen der sechs Befunde: **Blutung, Fraktur, Wunde, Verbrennung, Prellung, Amputation**.",
              "Regionen mit Befund werden **rot**. Erneutes Antippen streicht den Befund wieder.",
            ],
            en: [
              "Rotate the model: grab and drag with the controller. With gaze only, it keeps turning on its own and stops as soon as your gaze rests on a body part.",
              "Tap the affected **region**.",
              "Choose one of six findings: **bleeding, fracture, wound, burn, contusion, amputation**.",
              "Regions with a finding turn **red**. Tapping again removes the finding.",
            ],
          },
        },
        {
          type: "p",
          text: {
            de: "Befunde gehen in jeder Tätigkeit. Sie hängen an der Region, nicht frei in der Akte – weitergegeben wird also zum Beispiel „Blutung, Oberschenkel rechts“. Dieselbe Figur steht klein neben der Anzeige über jedem Marker, dort in der Sichtungsfarbe: So erkennen Sie schon aus einigen Metern, wer da liegt und wo die Verletzung sitzt. Lädt das Modell nicht, zeichnet die App einfache Quader – ein fehlendes Modell hält den Einsatz nicht auf.",
            en: "Findings work in every task. They are tied to the region rather than floating loose in the record – so what gets passed on is, for example, “bleeding, right thigh”. A small copy of the figure appears next to the display above every marker, coloured by triage category, so you can tell from a few metres away who is lying there and where they are hurt. If the model fails to load, the app draws simple boxes instead – a missing model does not hold up the operation.",
          },
        },
        { type: "h", text: { de: "Vorsichtung: Sprechen statt Tippen", en: "Pre-triage: speak instead of tapping" } },
        {
          type: "p",
          text: {
            de: "Die Vorsichtung ist im Prototyp ein Fragebogen aus Ja und Nein – sechs Fragen nach dem **mSTaRT-Schema**, jede wird vorgelesen, ein Schritt zurück ist möglich. Das ist genau das, was sich sagen lässt, während beide Hände am Patienten sind.",
            en: "In the prototype, pre-triage is a yes/no questionnaire – six questions following the **mSTaRT scheme**, each read aloud, with a step back available. That is exactly the kind of input you can give by voice while both hands are on the patient.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "Der Knopf **Sprechen** schaltet das Mikrofon zu. Die Wörter **„ja“, „nein“, „zurück“ und „weiter“** bedienen den Ablauf.",
              "Die Spracherkennung läuft **nur lokal auf dem Gerät**. Kann der Browser das nicht zusichern, bleibt das Mikrofon aus.",
              "Die Knöpfe bleiben immer daneben bestehen: Im Lärm einer Einsatzstelle darf die Bedienung nicht am Mikrofon hängen.",
              "Eine abgeschlossene Vorsichtung schreibt Kategorie, Sofortmaßnahmen und zwei Protokollzeilen: den Antwortpfad und die ausschlaggebende Begründung.",
            ],
            en: [
              "The **Speak** button switches the microphone on. The words **“ja”, “nein”, “zurück” and “weiter”** (yes, no, back, next) drive the workflow.",
              "Speech recognition runs **only locally on the device**. If the browser cannot guarantee that, the microphone stays off.",
              "The buttons always remain available: amid the noise of an incident scene, operation must not depend on the microphone.",
              "A completed pre-triage records the category, immediate measures and two protocol lines: the answer path and the decisive reason.",
            ],
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "**Die Kategorie ist ein Vorschlag.** J.A.R. ersetzt nicht den Sichtungsalgorithmus Ihrer Organisation und nicht die Entscheidung der verantwortlichen Ärztin oder des verantwortlichen Arztes. **SK IV (blau)** vergibt die Vorsichtung nie von selbst – das ist eine ärztliche Entscheidung. In der Vorsichtung gibt es SK IV nur als ausdrücklich beschrifteten Override, der als solcher protokolliert wird.",
            en: "**The category is a suggestion.** J.A.R. does not replace your organisation's triage algorithm or the decision of the responsible physician. Pre-triage never assigns **SK IV (blue)** on its own – that is a physician's decision. In pre-triage, SK IV exists only as an explicitly labelled override, which is logged as such.",
          },
        },
        { type: "h", text: { de: "Das Armband aus Papier", en: "The paper wristband" } },
        {
          type: "p",
          text: {
            de: "Ihre Hände und Ihr Blick sind beim Patienten – eine Knopfreihe im Blickfeld ist beides nicht. Deshalb gibt es ein Armband aus Papier für den linken Unterarm: sechs Felder, jedes mit einem ArUco-Marker und einem Zeichen – **Ja, Nein, Zurück, Patient, Tätigkeit, Lagebild**. Berühren löst aus; „Ja“ am Band, „ja“ gesagt und der Ja-Knopf sind dieselbe Handlung.",
            en: "Your hands and your eyes are on the patient – a row of buttons in your field of view is neither. That is why there is a paper wristband for the left forearm: six fields, each with an ArUco marker and a symbol – **Yes, No, Back, Patient, Task, Operating picture**. Touching a field triggers it; “Yes” on the band, saying “yes” and the Yes button are one and the same action.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Drucken ohne Skalierung**, sonst stimmen die Markergrößen nicht. Matt drucken – Glanzpapier spiegelt, und ein gespiegelter Marker wird nicht erkannt.",
              "Ausschneiden, auf festes Papier kleben oder laminieren und mit Gummi- oder Klettband am Arm befestigen.",
              "**Im Headset-Browser** wird die Berührung über die Controller erkannt: Ein Controller trägt das Band, die Spitze des anderen berührt. Ist nur ein Controller da, bleibt die Knopfreihe am Blickfeldrand stehen.",
              "**Vor einer Kamera** (Kamera-Modus) gilt ein Feld als gedrückt, wenn sein Marker verdeckt ist. Eine Berührung muss kurz stehen bleiben – Darüberstreifen löst nichts aus.",
            ],
            en: [
              "**Print without scaling**, otherwise the marker sizes are wrong. Print on matte paper – glossy paper reflects, and a reflecting marker is not recognised.",
              "Cut it out, glue it to card or laminate it, and fasten it to your arm with an elastic or hook-and-loop strap.",
              "**In the headset browser**, touches are detected via the controllers: one controller carries the band, the tip of the other one touches it. With only one controller, the button row at the edge of the view stays in place.",
              "**In front of a camera** (camera mode), a field counts as pressed when its marker is covered. A touch has to be held briefly – brushing over the band triggers nothing.",
            ],
          },
        },
        { type: "h", text: { de: "Ausblick: Diktat per Edge-AI", en: "Outlook: dictation via edge AI" } },
        {
          type: "p",
          text: {
            de: "Freitext-Befunde per Spracheingabe ohne Netz sind vorgesehen, aber noch nicht im AR-Client umgesetzt. Die ASR-Seite der Demo zeigt den geplanten Weg mit einer **vorbereiteten Demoausgabe**: Auslöser (QR-Scan oder das Wort „Vorsichtung“), Stille entfernen, Relevanzfilter, Sprache zu deutschem Text, Abgleich mit der Patientenkarte, Extraktion in ein festes Berichtsschema und Übernahme ins Lagebild. Leere Felder bleiben dabei leer.",
            en: "Free-text findings by offline voice input are planned but not yet built into the AR client. The demo's ASR page illustrates the intended pipeline with a **prepared demo output**: trigger (QR scan or the word “Vorsichtung”), silence trimming, relevance filter, speech to German text, matching against the patient record, extraction into a fixed report schema, and hand-over to the operating picture. Empty fields stay empty.",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Was passiert, wenn der Browser nicht zusichern kann, dass die Spracherkennung lokal läuft?",
            en: "What happens if the browser cannot guarantee that speech recognition runs locally?",
          },
          options: [
            { de: "Die Sprache wird an einen Cloud-Dienst geschickt.", en: "The audio is sent to a cloud service." },
            { de: "Die App lässt sich nicht mehr bedienen.", en: "The app can no longer be operated." },
            { de: "Das Mikrofon bleibt aus; die Knöpfe funktionieren weiter.", en: "The microphone stays off; the buttons keep working." },
            { de: "Die Aufnahme wird gespeichert und später übertragen.", en: "The recording is stored and uploaded later." },
          ],
          answer: 2,
          explain: {
            de: "Die Erkennung läuft nur lokal. Ist das nicht gesichert, bleibt das Mikrofon aus – die Knöpfe bestehen immer daneben.",
            en: "Recognition runs locally only. If that cannot be guaranteed, the microphone stays off – the buttons are always available as well.",
          },
        },
        {
          q: {
            de: "Wie entfernen Sie einen versehentlich gesetzten Befund am Körpermodell?",
            en: "How do you remove a finding set by mistake on the body model?",
          },
          options: [
            { de: "Den Befund in derselben Region erneut antippen", en: "Tap the finding in the same region again" },
            { de: "Den Patienten löschen und neu anlegen", en: "Delete the patient and create them again" },
            { de: "Das geht nur in der Einsatzleitung", en: "Only incident command can do that" },
          ],
          answer: 0,
          explain: {
            de: "Erneutes Antippen streicht den Befund wieder.",
            en: "Tapping it again removes the finding.",
          },
        },
        {
          q: {
            de: "Wer vergibt SK IV (blau)?",
            en: "Who assigns SK IV (blue)?",
          },
          options: [
            { de: "Die Vorsichtung automatisch", en: "Pre-triage, automatically" },
            { de: "Ärztliches Personal – in der Vorsichtung nur als beschrifteter, protokollierter Override", en: "Medical staff – in pre-triage only as a labelled, logged override" },
            { de: "Die Registrierung", en: "Registration" },
            { de: "Das Lagebild nach Ablauf einer Zeitgrenze", en: "The operating picture after a timeout" },
          ],
          answer: 1,
          explain: {
            de: "SK IV ist eine ärztliche Entscheidung. Die Vorsichtung vergibt sie nie von selbst; dort gibt es sie nur als ausdrücklich beschrifteten Override.",
            en: "SK IV is a physician's decision. Pre-triage never assigns it on its own; there it exists only as an explicitly labelled override.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 5
    {
      id: "lagebild-einsatzleitung",
      title: { de: "Das Lagebild der Einsatzleitung", en: "Incident command's operating picture" },
      minutes: 10,
      blocks: [
        {
          type: "p",
          text: {
            de: "Das Lagebild ist das Gegenstück zum AR-Client: die Ansicht für die Einsatzleitung im Einsatzleitfahrzeug. Die Live-Demo zeigt es auf einer echten OpenStreetMap-Karte – mit **simulierten Übungslagen und ohne echte Personendaten**. Einsatzkräfte bewegen sich dort auf dem echten Wegenetz, sichten und transportieren Patienten; Gefahrenstellen verändern sich.",
            en: "The operating picture is the counterpart to the AR client: the view for incident command in the command vehicle. The live demo shows it on a real OpenStreetMap map – with **simulated exercise scenarios and no real personal data**. Units move along the real road and path network, triage and transport patients, and hazards evolve over time.",
          },
        },
        { type: "h", text: { de: "Sichtungskategorien und Farben", en: "Triage categories and colours" } },
        {
          type: "p",
          text: {
            de: "AR-Client und Lagebild verwenden dieselbe Farbpalette. Die Kennzahlen zählen die Patienten je Kategorie:",
            en: "The AR client and the operating picture use the same colour palette. The key figures count patients per category:",
          },
        },
        {
          type: "table",
          head: { de: ["Kategorie", "Farbe im Lagebild"], en: ["Category", "Colour in the operating picture"] },
          rows: {
            de: [
              ["SK I", "rot"],
              ["SK II", "gelb"],
              ["SK III", "grün"],
              ["SK IV", "blau"],
              ["verstorben", "dunkelgrau"],
              ["ungesichtet", "grau"],
            ],
            en: [
              ["SK I", "red"],
              ["SK II", "yellow"],
              ["SK III", "green"],
              ["SK IV", "blue"],
              ["deceased", "dark grey"],
              ["untriaged", "grey"],
            ],
          },
        },
        { type: "h", text: { de: "Was die Einsatzleitung sieht", en: "What incident command sees" } },
        {
          type: "list",
          items: {
            de: [
              "**Karte mit Einsatzraster:** Jeder Patient steht in einem Rasterfeld. Ein eigener Lageplan oder ein Luftbild lässt sich mit einstellbarer Deckkraft darüberlegen.",
              "**Einsatzabschnitte** wie Schadensstelle, Patientenablage, Behandlungsplatz, Betreuungsstelle und Ablage Verstorbene. Weitet sich eine Lage aus, kommen Abschnitte im Verlauf dazu.",
              "**Einsatzmittel** – Trupps, Rettungsmittel und Führungsfahrzeuge mit ihrem Status.",
              "**Patientenliste** mit Kategorie, Zustand, Abschnitt und Rasterfeld; ein Filter blendet nur noch nicht versorgte bzw. nicht abtransportierte Patienten ein.",
              "**Gefahrenlage**, **Ereignisse** und **Warnungen** – zum Beispiel ungesichtete Marker, ein Behandlungsplatz nahe der Kapazitätsgrenze, kein freies Transportmittel oder ein Trupp ohne Statusmeldung.",
              "**Sprechfunk:** Über den Knopf „Funk“ startet in der Demo eine simulierte Sprechfunk-Auswertung; die Meldungen erscheinen im Funkprotokoll.",
            ],
            en: [
              "**Map with incident grid:** every patient sits in a grid cell. Your own site plan or an aerial image can be overlaid with adjustable opacity.",
              "**Incident sectors** such as the damage site, casualty collection point, treatment area, care point for the uninjured and area for the deceased. When an incident grows, sectors are added as it unfolds.",
              "**Units** – teams, ambulances and command vehicles with their status.",
              "**Patient list** with category, condition, sector and grid cell; a filter shows only patients not yet treated or not yet transported.",
              "**Hazards**, **events** and **warnings** – for example untriaged markers, a treatment area close to capacity, no free transport, or a team that has not reported its status.",
              "**Radio:** in the demo, the “Funk” button starts a simulated radio-traffic evaluation; the messages appear in the radio log.",
            ],
          },
        },
        { type: "h", text: { de: "Transport steuern", en: "Steering transport" } },
        {
          type: "p",
          text: {
            de: "Der Bereich **Transport & Kliniken** zeigt die gemeldete freie Kapazität der Zielkliniken je Sichtungskategorie, ihre Versorgungsstufe, Entfernung und Fahrzeit sowie alle laufenden und abgeschlossenen Transporte. Für einen transportbereiten Patienten kann die Einsatzleitung eine Zielklinik vorgeben oder die Wahl automatisch lassen. Die **Lagemeldung** fasst Lage, Sichtung, Versorgung und Transport, Gefahren, Einsatzabschnitte und offene Punkte zusammen; die Patientenliste lässt sich als CSV exportieren.",
            en: "The **Transport & hospitals** area shows each receiving hospital's reported free capacity per triage category, its level of care, distance and drive time, plus all ongoing and completed transports. For a patient ready for transport, incident command can set a destination hospital or leave the choice automatic. The **situation report** summarises the situation, triage, care and transport, hazards, incident sectors and open items; the patient list can be exported as CSV.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Warnungen im Lagebild sind Hinweise. Die Führungsentscheidung – etwa über Nachforderungen oder Zielkliniken – bleibt bei der Einsatzleitung.",
            en: "Warnings in the operating picture are prompts. Command decisions – such as requesting more resources or choosing hospitals – remain with incident command.",
          },
        },
        { type: "h", text: { de: "Drei Übungslagen", en: "Three exercise scenarios" } },
        {
          type: "table",
          head: { de: ["Übungslage", "Szenario"], en: ["Scenario", "Situation"] },
          rows: {
            de: [
              ["Neubiberg", "Explosion mit Teileinsturz an der Hauptstraße (MANV 25)"],
              ["Halle (Saale)", "Hochwasser der Saale in Kröllwitz (Wassergefahr groß, MANV 20)"],
              ["München", "lebensbedrohliche Einsatzlage an mehreren Orten der Altstadt (MANV 50)"],
            ],
            en: [
              ["Neubiberg", "explosion with partial building collapse on the main street (alert keyword “MANV 25”)"],
              ["Halle (Saale)", "Saale river flood in Kröllwitz (major water hazard, alert keyword “MANV 20”)"],
              ["Munich", "life-threatening incident at several locations in the old town (alert keyword “MANV 50”)"],
            ],
          },
        },
        {
          type: "p",
          text: {
            de: "Die Lage läuft in Einsatzzeit ab; Sie können sie anhalten, mit 1× bis 8× beschleunigen und neu abspielen. Jede Übungslage hat eine eigene, teilbare Adresse.",
            en: "The scenario runs in incident time; you can pause it, speed it up from 1× to 8×, and replay it. Each exercise scenario has its own shareable address.",
          },
        },
        {
          type: "link",
          href: "../demo/",
          label: { de: "Lagebild-Demo öffnen", en: "Open the operating-picture demo" },
        },
      ],
      quiz: [
        {
          q: {
            de: "Welche Farbe hat SK II im Lagebild?",
            en: "What colour is SK II in the operating picture?",
          },
          options: [
            { de: "Rot", en: "Red" },
            { de: "Grün", en: "Green" },
            { de: "Blau", en: "Blue" },
            { de: "Gelb", en: "Yellow" },
          ],
          answer: 3,
          explain: {
            de: "SK I ist rot, SK II gelb, SK III grün und SK IV blau.",
            en: "SK I is red, SK II yellow, SK III green and SK IV blue.",
          },
        },
        {
          q: {
            de: "Welche Daten zeigt die Lagebild-Demo?",
            en: "What data does the operating-picture demo show?",
          },
          options: [
            { de: "Echte Patientendaten aus laufenden Einsätzen", en: "Real patient data from live incidents" },
            { de: "Simulierte Übungslagen ohne echte Personendaten", en: "Simulated exercise scenarios with no real personal data" },
            { de: "Daten aus dem Krankenhausinformationssystem", en: "Data from the hospital information system" },
          ],
          answer: 1,
          explain: {
            de: "Die Demo spielt simulierte Übungslagen ab – ausdrücklich ohne echte Personendaten.",
            en: "The demo plays simulated exercise scenarios – explicitly without real personal data.",
          },
        },
        {
          q: {
            de: "Was zeigt der Bereich „Transport & Kliniken“ unter anderem?",
            en: "What does the “Transport & hospitals” area show, among other things?",
          },
          options: [
            { de: "Die gemeldete freie Kapazität der Zielkliniken je Sichtungskategorie", en: "The reported free capacity of receiving hospitals per triage category" },
            { de: "Die Dienstpläne der Kliniken", en: "The hospitals' duty rosters" },
            { de: "Die Abrechnung der Transporte", en: "Billing for the transports" },
          ],
          answer: 0,
          explain: {
            de: "Neben laufenden und abgeschlossenen Transporten zeigt er die gemeldete freie Kapazität je Kategorie, Versorgungsstufe, Entfernung und Fahrzeit.",
            en: "Besides ongoing and completed transports, it shows reported free capacity per category, level of care, distance and drive time.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 6
    {
      id: "datenschutz-offline-grenzen",
      title: { de: "Datenschutz, Offline-Betrieb und Grenzen", en: "Privacy, offline operation and limits" },
      minutes: 8,
      blocks: [
        {
          type: "p",
          text: {
            de: "An einer Einsatzstelle gibt es womöglich kein Netz, und Patientendaten sind besonders schutzwürdig. J.A.R. ist deshalb darauf ausgelegt, so viel wie möglich vor Ort zu verarbeiten.",
            en: "There may be no network at an incident scene, and patient data deserves special protection. J.A.R. is therefore designed to process as much as possible on site.",
          },
        },
        { type: "h", text: { de: "Lokale Verarbeitung", en: "Local processing" } },
        {
          type: "list",
          items: {
            de: [
              "**Sprache bleibt auf dem Gerät:** Die Spracherkennung im AR-Client läuft nur lokal. Patiententon gehört nicht auf fremde Server.",
              "**Edge statt Cloud:** Im Konzept laufen Transkription und Sprachmodell auf Geräten vor Ort – in der Einheit des Sanitäters und im Einsatzleitfahrzeug.",
              "**Kein Backend im Prototyp:** Der AR-Client ist eine statische Web-App. Der Einsatz lebt im Speicher der laufenden Sitzung.",
              "**Ohne Netz starten:** Auf der HoloLens 2 lässt sich der AR-Client über Edge als App installieren; danach öffnet er im eigenen Fenster und läuft ohne Netz – ohne Entwicklermodus und ohne Zertifikat.",
              "**Demo ohne Personendaten:** Das Lagebild arbeitet ausschließlich mit simulierten Übungslagen.",
            ],
            en: [
              "**Speech stays on the device:** speech recognition in the AR client runs locally only. Patient audio does not belong on third-party servers.",
              "**Edge, not cloud:** in the concept, transcription and the language model run on devices on site – in the paramedic's unit and in the command vehicle.",
              "**No backend in the prototype:** the AR client is a static web app. The incident lives in the memory of the current session.",
              "**Starting without a network:** on HoloLens 2, the AR client can be installed as an app through Edge; it then opens in its own window and runs offline – without developer mode or certificates.",
              "**Demo without personal data:** the operating picture works only with simulated exercise scenarios.",
            ],
          },
        },
        { type: "h", text: { de: "Rückfallebenen im Gerät", en: "Built-in fallbacks" } },
        {
          type: "table",
          head: { de: ["Wenn …", "… dann"], en: ["If …", "… then"] },
          rows: {
            de: [
              ["das Mikrofon nicht lokal erkennen kann oder es zu laut ist", "bedienen Sie per Knopf, Blick oder Controller"],
              ["keine Kamera verfügbar ist", "wählen Sie die Kartennummer mit −/+"],
              ["nur ein Controller da ist", "bleibt die Knopfreihe am Blickfeldrand statt des Armbands"],
              ["das Körpermodell nicht lädt", "zeichnet die App einfache Quader als Regionen"],
            ],
            en: [
              ["the microphone cannot recognise locally, or it is too loud", "operate by button, gaze or controller"],
              ["no camera is available", "pick the tag number with −/+"],
              ["only one controller is present", "the button row at the edge of the view stays instead of the wristband"],
              ["the body model fails to load", "the app draws simple boxes as regions"],
            ],
          },
        },
        { type: "h", text: { de: "Grenzen des Prototyps", en: "Limits of the prototype" } },
        {
          type: "list",
          items: {
            de: [
              "AR-Client und Lagebild sind heute **noch nicht miteinander verbunden**; die Anbindung an einen zentralen Server ist der nächste Schritt.",
              "Positionen und Akten überleben ein **Neuladen** der Seite noch nicht dauerhaft.",
              "Ob die PICO 4 Enterprise im Browser die Kamera herausgibt, ist **nicht bestätigt**. Alternativen: Handy im Kamera-Modus oder ein nativer Build.",
              "Fragt eine Brille beim Start nach einer Spielfläche, ist das ihre eigene Sicherheitsgrenze. Abhilfe: in den Einstellungen der Brille auf **stationär / Sitzmodus** umstellen.",
            ],
            en: [
              "The AR client and the operating picture are **not yet connected** today; connecting them to a central server is the next step.",
              "Positions and records do not yet survive a **page reload**.",
              "Whether the PICO 4 Enterprise exposes its camera to the browser is **not confirmed**. Alternatives: a phone in camera mode, or a native build.",
              "If a headset asks for a play area at start-up, that is its own safety boundary. Fix: switch the headset settings to **stationary / seated mode**.",
            ],
          },
        },
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "**Kein Medizinprodukt.** J.A.R. ist ein Schüler- und Startup-Projekt für Übungszwecke und kein zertifiziertes Medizinprodukt. Es unterstützt Dokumentation und Informationsfluss – es ersetzt **nicht** den Sichtungsalgorithmus Ihrer Organisation, **nicht** die Entscheidung der verantwortlichen Ärztin oder des verantwortlichen Arztes und **nicht** die Papier-Sichtungskarte als Rückfallebene. Fallen Geräte aus, wird mit Papier-Sichtungskarten weitergearbeitet. Die Verantwortung bleibt bei der Person, die sichtet.",
            en: "**Not a medical device.** J.A.R. is a student startup project for training purposes and not a certified medical device. It supports documentation and the flow of information – it does **not** replace your organisation's triage algorithm, the decision of the responsible physician, or the paper triage tag as a fallback. If devices fail, work continues with paper triage tags. Responsibility stays with the person doing the triage.",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Was gilt, wenn bei einem Einsatz die Geräte ausfallen?",
            en: "What applies if the devices fail during an incident?",
          },
          options: [
            { de: "Die Sichtung wird bis zur Reparatur unterbrochen.", en: "Triage is paused until the devices are repaired." },
            { de: "Die Einsatzleitung übernimmt die Sichtung allein.", en: "Incident command takes over triage on its own." },
            { de: "Es wird mit Papier-Sichtungskarten weitergearbeitet.", en: "Work continues with paper triage tags." },
          ],
          answer: 2,
          explain: {
            de: "J.A.R. ersetzt die Papier-Sichtungskarte als Rückfallebene nicht. Fallen Geräte aus, geht es mit Papier weiter.",
            en: "J.A.R. does not replace the paper triage tag as a fallback. If devices fail, work continues on paper.",
          },
        },
        {
          q: {
            de: "Welche Aussage über J.A.R. ist richtig?",
            en: "Which statement about J.A.R. is correct?",
          },
          options: [
            { de: "Es ist ein zertifiziertes Medizinprodukt.", en: "It is a certified medical device." },
            { de: "Es unterstützt Dokumentation und Informationsfluss, ersetzt aber keine ärztliche Entscheidung.", en: "It supports documentation and information flow but does not replace a physician's decision." },
            { de: "Es legt die Sichtungskategorie verbindlich fest.", en: "It sets the triage category bindingly." },
            { de: "Es ersetzt den Sichtungsalgorithmus der Organisation.", en: "It replaces the organisation's triage algorithm." },
          ],
          answer: 1,
          explain: {
            de: "J.A.R. ist kein Medizinprodukt. Die Kategorie ist ein Vorschlag; Algorithmus und ärztliche Entscheidung bleiben bei Ihrer Organisation.",
            en: "J.A.R. is not a medical device. The category is a suggestion; the algorithm and the physician's decision remain with your organisation.",
          },
        },
        {
          q: {
            de: "Wie kann man auf der HoloLens 2 den AR-Client ohne Netz starten?",
            en: "How can the AR client be started offline on HoloLens 2?",
          },
          options: [
            { de: "Über Edge als App installieren", en: "Install it as an app through Edge" },
            { de: "Per Sideload eines signierten Pakets mit Zertifikat", en: "Sideload a signed package with a certificate" },
            { de: "Gar nicht – er braucht immer Netz", en: "Not at all – it always needs a network" },
          ],
          answer: 0,
          explain: {
            de: "Über Edge installiert, steht der AR-Client im Startmenü und läuft ohne Netz – ohne Entwicklermodus und ohne Zertifikat.",
            en: "Installed through Edge, the AR client appears in the Start menu and runs offline – with no developer mode and no certificate.",
          },
        },
      ],
    },

    // ------------------------------------------------------------------ 7
    {
      id: "einfuehrung-organisation",
      title: { de: "Einführung in Ihrer Organisation", en: "Introducing J.A.R. in your organisation" },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "J.A.R. lässt sich ohne Installation und ohne eigene Server ausprobieren. Gehen Sie am besten in kleinen Schritten vor – vom Browser am Schreibtisch bis zur Brille in einer Übung.",
            en: "You can try J.A.R. without installing anything and without your own servers. It works best in small steps – from the browser at your desk to the headset in an exercise.",
          },
        },
        { type: "h", text: { de: "Schritt für Schritt ausprobieren", en: "Trying it step by step" } },
        {
          type: "steps",
          items: {
            de: [
              "**Lagebild ansehen:** Öffnen Sie die Lagebild-Demo und spielen Sie eine Übungslage durch – Neubiberg, Halle oder München.",
              "**AR-Client in der Simulation:** Öffnen Sie den AR-Client auf einem beliebigen Gerät und wählen Sie die Simulation. Gehen Sie jede der vier Tätigkeiten einmal durch.",
              "**Kamera-Modus mit echten Karten:** Drucken Sie die Umhängekarten (A4, 3 Seiten, 12 Karten) **ohne Skalierung**, schneiden Sie sie aus und lochen Sie sie oben rechts. Scannen Sie sie mit dem Handy.",
              "**Armband drucken:** matt und ohne Skalierung, dann laminieren oder auf festes Papier kleben.",
              "**Brille im AR-Modus:** Öffnen Sie die bereitgestellte Kopie des AR-Clients im Browser der Brille und tippen Sie auf **AR-Modus**. AR braucht eine sichere HTTPS-Verbindung.",
            ],
            en: [
              "**Explore the operating picture:** open the operating-picture demo and play through an exercise scenario – Neubiberg, Halle or Munich.",
              "**AR client in simulation:** open the AR client on any device and choose simulation. Walk through each of the four tasks once.",
              "**Camera mode with real tags:** print the hanging tags (A4, 3 pages, 12 tags) **without scaling**, cut them out and punch a hole at the top right. Scan them with a phone.",
              "**Print the wristband:** matte and without scaling, then laminate it or glue it to card.",
              "**Headset in AR mode:** open the hosted copy of the AR client in the headset's browser and tap **AR mode**. AR requires a secure HTTPS connection.",
            ],
          },
        },
        {
          type: "link",
          href: "../demo/",
          label: { de: "Zur Lagebild-Demo", en: "Go to the operating-picture demo" },
        },
        {
          type: "link",
          href: "../demo/paramedic/",
          label: { de: "Zum AR-Client", en: "Go to the AR client" },
        },
        { type: "h", text: { de: "In Übungen einsetzen", en: "Using it in exercises" } },
        {
          type: "list",
          items: {
            de: [
              "Setzen Sie J.A.R. ausschließlich in **Übungen** ein – zusätzlich zur gewohnten Papier-Sichtungskarte, nicht an ihrer Stelle.",
              "Lassen Sie jede Tätigkeit von der Person bedienen, die sie auch in der Übung ausführt: Vorsichtung, ärztliche Sichtung, Registrierung, Behandlung & Transport.",
              "Halten Sie fest, was in Ihrer Organisation anders läuft – Begriffe, Abschnitte, Abläufe. Diese Rückmeldungen helfen dem Projekt am meisten.",
            ],
            en: [
              "Use J.A.R. in **exercises** only – alongside your usual paper triage tag, not instead of it.",
              "Have each task operated by the person who performs it in the exercise: pre-triage, physician triage, registration, treatment & transport.",
              "Note what works differently in your organisation – terms, sectors, procedures. This feedback helps the project most.",
            ],
          },
        },
        { type: "h", text: { de: "Wie es weitergeht", en: "What comes next" } },
        {
          type: "list",
          items: {
            de: [
              "Anbindung des AR-Clients an einen zentralen Server, damit zugewiesene Karten sofort im Lagebild erscheinen",
              "Räumliche Anker, damit Positionen ein Neuladen überleben",
              "Ein nativer Build für PICO, in dem die Brille die Karten selbst scannen kann",
              "Diktat von Freitext-Befunden per Offline-Spracherkennung",
            ],
            en: [
              "Connecting the AR client to a central server, so that assigned tags appear in the operating picture immediately",
              "Spatial anchors, so that positions survive a reload",
              "A native PICO build in which the headset can scan the tags itself",
              "Dictation of free-text findings via offline speech recognition",
            ],
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Fragen, Übungsanfragen oder Rückmeldungen? Die Kontaktdaten des Projektteams (Johannes Nirschl, Alexander Kluge, Jonas Kaindl, Neubiberg) finden Sie im Bereich **Kontakt** auf der Startseite.",
            en: "Questions, exercise requests or feedback? You will find the project team's contact details (Johannes Nirschl, Alexander Kluge, Jonas Kaindl, Neubiberg) in the **Contact** section of the homepage.",
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Wie sollen die Umhängekarten gedruckt werden?",
            en: "How should the hanging tags be printed?",
          },
          options: [
            { de: "Auf Seitengröße angepasst", en: "Scaled to fit the page" },
            { de: "Auf Glanzpapier", en: "On glossy paper" },
            { de: "Ohne Skalierung", en: "Without scaling" },
            { de: "Gar nicht – sie werden nur am Bildschirm gezeigt", en: "Not at all – they are only shown on screen" },
          ],
          answer: 2,
          explain: {
            de: "Gedruckt wird ohne Skalierung; danach ausschneiden und oben rechts lochen.",
            en: "Print without scaling, then cut out and punch a hole at the top right.",
          },
        },
        {
          q: {
            de: "Wie setzen Sie J.A.R. in Ihrer Organisation ein?",
            en: "How should you use J.A.R. in your organisation?",
          },
          options: [
            { de: "In Übungen, zusätzlich zur Papier-Sichtungskarte", en: "In exercises, alongside the paper triage tag" },
            { de: "Im Realeinsatz anstelle der Papier-Sichtungskarte", en: "In real incidents instead of the paper triage tag" },
            { de: "Nur in der Integrierten Leitstelle", en: "Only at the dispatch centre" },
          ],
          answer: 0,
          explain: {
            de: "J.A.R. ist ein Prototyp für Übungszwecke und kein Medizinprodukt – die Papier-Sichtungskarte bleibt bestehen.",
            en: "J.A.R. is a prototype for training purposes and not a medical device – the paper triage tag stays in place.",
          },
        },
      ],
    },
  ],
};
