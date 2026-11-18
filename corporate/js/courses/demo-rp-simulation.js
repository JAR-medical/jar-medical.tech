// Demo course: retinitis pigmentosa in VR/AR. Launches the gaze-contingent
// RP-XR simulator (a WebXR port of Amitoze/rp-simulator, served from
// demo/rp-xr/) and explains the symptoms it shows and how gaze tracking works.
// Needs an access code on top of the grant; the simulator shares it.
import { RP_XR_PASSCODE } from "../passcode.js";

export default {
  id: "demo-rp-simulation",
  version: 1,
  section: "test",
  icon: "eye",
  passcode: RP_XR_PASSCODE,
  title: {
    de: "Demo: Retinitis pigmentosa in VR erleben",
    en: "Demo: experience retinitis pigmentosa in VR",
  },
  subtitle: {
    de: "Blickgesteuerte Simulation für PICO 4 Enterprise",
    en: "Gaze-contingent simulation for PICO 4 Enterprise",
  },
  summary: {
    de: "Ein künstlerisches Ich-Porträt der Retinitis pigmentosa: verbleibende zentrale Sehinsel, verrauchtes Restgesichtsfeld, Photopsien und Nachtblindheit. Das geschädigte Feld folgt Ihrem Blick, während die Welt stillsteht, so wie ein echtes Netzhautskotom. Läuft im Browser, in VR und als Passthrough-Überlagerung.",
    en: "An artistic first-person portrait of retinitis pigmentosa: a surviving central island, a smoke-filled dead field, photopsia and night blindness. The damaged field follows your gaze while the world stays put, the way a real retinal scotoma behaves. Runs in the browser, in VR and as a passthrough overlay.",
  },
  audience: {
    de: "Für Pflege- und Rettungsfachkräfte, Angehörige, Lehrende und alle, die Sehbehinderung nachvollziehen möchten.",
    en: "For nurses, paramedics, relatives, educators and anyone who wants to understand visual impairment.",
  },
  minutes: 14,
  lessons: [
    {
      id: "simulator-starten",
      title: { de: "Simulator starten", en: "Launch the simulator" },
      minutes: 8,
      blocks: [
        {
          type: "callout",
          tone: "warn",
          text: {
            de: "**Lichtempfindlichkeit:** Die Simulation enthält fortlaufendes Flackern bis etwa 12 Hz über das ganze Gesichtsfeld. Vor dem Start erscheint ein Warnhinweis; in den Einstellungen lässt sich „Reduce flashing“ einschalten. Bei Epilepsie oder Migräne bitte nicht verwenden.",
            en: "**Photosensitivity:** the simulation contains continuous flashing at up to about 12 Hz across the whole visual field. A warning appears before it starts, and the settings offer a \"Reduce flashing\" switch. Do not use it if you have epilepsy or migraine.",
          },
        },
        {
          type: "p",
          text: {
            de: "Der Simulator öffnet sich in einem neuen Tab. Am Rechner ist der Mauszeiger Ihr Blick: Wohin Sie zeigen, dorthin wandert die zentrale Sehinsel.",
            en: "The simulator opens in a new tab. On a computer, the mouse pointer is your gaze: the central island moves wherever you point.",
          },
        },
        {
          type: "link",
          href: "../demo/rp-xr/",
          label: { de: "RP-Simulator öffnen", en: "Open the RP simulator" },
        },
        { type: "h", text: { de: "Auf der PICO 4 Enterprise", en: "On the PICO 4 Enterprise" } },
        {
          type: "steps",
          items: {
            de: [
              "Diese Kursseite im PICO-Browser öffnen und auf „RP-Simulator öffnen“ tippen.",
              "Den Warnhinweis lesen und bestätigen.",
              "**Enter VR** wählen für eine Straßenszene oder ein Straßenvideo, oder **Enter passthrough (AR)**, um die Simulation über die echte Umgebung zu legen.",
              "Mit beiden Griffen 1 Sekunde gedrückt die Blickkalibrierung starten und die neun Punkte nacheinander ansehen.",
            ],
            en: [
              "Open this course page in the PICO browser and tap \"Open the RP simulator\".",
              "Read and accept the warning.",
              "Choose **Enter VR** for a street scene or street video, or **Enter passthrough (AR)** to lay the simulation over your real surroundings.",
              "Hold both grips for 1 second to start gaze calibration and look at the nine dots one after another.",
            ],
          },
        },
        {
          type: "table",
          head: { de: ["Eingabe", "Wirkung"], en: ["Input", "Action"] },
          rows: {
            de: [
              ["Trigger (halten)", "normales Sehen zum Vergleich"],
              ["A / X", "Fortschritt der Degeneration: 30 → 60 → 82 → 100 %"],
              ["B / Y", "Blickhilfe (AR-Panel) ein/aus"],
              ["Thumbstick", "Blick steuern oder Degeneration anpassen"],
              ["Thumbstick-Klick", "Szene wechseln (Straße / Video)"],
              ["Beide Griffe 1 s", "Blickkalibrierung"],
            ],
            en: [
              ["Trigger (hold)", "normal vision, for comparison"],
              ["A / X", "degeneration stage: 30 → 60 → 82 → 100 %"],
              ["B / Y", "glance aid (AR panel) on/off"],
              ["Thumbstick", "steer gaze or adjust degeneration"],
              ["Thumbstick click", "switch scene (street / video)"],
              ["Both grips 1 s", "gaze calibration"],
            ],
          },
        },
      ],
    },
    {
      id: "was-sie-sehen",
      title: { de: "Was Sie sehen und warum", en: "What you see and why" },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Bei Retinitis pigmentosa sterben die Stäbchen der Netzhaut von außen nach innen ab. Typisch sind zuerst Nachtblindheit, dann ein immer engeres Gesichtsfeld, bis nur eine kleine zentrale Sehinsel bleibt.",
            en: "In retinitis pigmentosa the retina's rod cells die from the outside in. Night blindness usually comes first, then an ever-narrower visual field, until only a small central island remains.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Zentrale Sehinsel:** der Rest an scharfem Sehen, dessen Größe in echten Grad Exzentrizität eingestellt ist.",
              "**Totes Feld:** außerhalb der Insel kein Bild mehr, nur graues, rauchiges Rauschen.",
              "**Photopsien:** flackernde Lichtnetze und funkelnde Ränder, wie sie viele Betroffene beschreiben.",
              "**Nachtblindheit:** im Dunkeln schrumpft das nutzbare Feld zusätzlich.",
            ],
            en: [
              "**Central island:** what remains of sharp vision, sized in true degrees of eccentricity.",
              "**Dead field:** outside the island there is no image, only grey, smoky noise.",
              "**Photopsia:** flickering light nets and sparkling edges, as many patients describe them.",
              "**Night blindness:** in the dark the usable field shrinks further.",
            ],
          },
        },
        { type: "h", text: { de: "Warum der Blick zählt", en: "Why gaze matters" } },
        {
          type: "p",
          text: {
            de: "Ein Skotom ist an die Netzhaut gebunden, nicht an den Kopf. Bewegen Sie nur die Augen, wandert der Ausfall mit. Der Simulator nutzt deshalb die beste verfügbare Blickquelle: Eye-Tracking über eine Begleit-App, eine Blick-Eingabe des Browsers, den Controller oder, als Rückfall, die Kopfrichtung.",
            en: "A scotoma is tied to the retina, not to the head. Move only your eyes and the loss moves with them. The simulator therefore uses the best gaze source available: eye tracking through a companion app, a browser gaze input, the controller or, as a fallback, head direction.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Der PICO-Browser gibt Webseiten derzeit keinen Zugriff auf das Eye-Tracking. Ohne Begleit-App folgt die Insel deshalb dem Kopf oder dem Thumbstick. Die Darstellung ist ein künstlerisches Porträt zur Veranschaulichung, kein diagnostisches Werkzeug.",
            en: "The PICO browser currently gives web pages no access to eye tracking. Without the companion app, the island therefore follows your head or the thumbstick. The rendering is an artistic portrait for illustration, not a diagnostic tool.",
          },
        },
        {
          type: "p",
          text: {
            de: "Grundlage ist das Projekt rp-simulator von Amitoze. Das Straßenvideo stammt von LOVE SHANGHAI (CC BY 4.0).",
            en: "Based on the rp-simulator project by Amitoze. Street footage by LOVE SHANGHAI (CC BY 4.0).",
          },
        },
      ],
    },
  ],
};
