// Understand 6: "3D-Mapping: Multi-Headset-Raumkarten & Lagebild" (DE + EN)
export default {
  id: "3d-mapping-lagebild",
  version: 1,
  section: "understand",
  icon: "map",
  title: {
    de: "3D-Mapping: Multi-Headset-Raumkarten & Lagebild",
    en: "3D Mapping: Multi-Headset Spatial Maps & SitRep",
  },
  subtitle: {
    de: "Fusionierte 3D-Karten der AR-Brillen und Luftbild-Layer",
    en: "Fused 3D maps from AR headsets and aerial map overlays",
  },
  summary: {
    de: "Wie J.A.R. ein räumliches 3D-Einsatzlagebild aufbaut: Jede AR-Brille kartiert ihre Umgebung in 3D, mehrere Brillen verschmelzen ihre Teilkarten zu einer gemeinsamen 3D-Karte mit präzisen Patientenankern, ergänzt durch Drohnen- und Satellitendaten externer Systeme.",
    en: "How J.A.R. builds a 3D operational picture: each AR headset maps its surroundings in 3D, multiple headsets fuse their local maps into one shared 3D map with precise patient anchors, complemented by drone and satellite layers from external systems.",
  },
  audience: {
    de: "Für Einsatzleitungen, Führungsstäbe, Sichtungstrupps und technische Projektpartner.",
    en: "For incident commanders, command staffs, triage teams and technical project partners.",
  },
  minutes: 16,
  lessons: [
    {
      id: "eigenentwicklung-headset-3d-mapping",
      title: {
        de: "J.A.R.-Kernentwicklung: 3D-Raumkarten aus mehreren AR-Brillen",
        en: "J.A.R. core technology: 3D spatial maps from multiple AR headsets",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "In verrauchten Gebäuden, U-Bahn-Schächten, Industriehallen oder nach einem Teileinsturz hilft eine flache 2D-Straßenkarte kaum weiter. GPS fällt innen sofort aus. Den zentralen 3D-Mapping-Baustein entwickelt J.A.R. deshalb direkt auf den Geräten der Einsatzkräfte, sodass jede AR-Brille während des Vorgehens selbstständig ihre dreidimensionale Umgebung vermisst.",
            en: "Inside smoke-filled buildings, subway shafts, industrial plants or partially collapsed structures, a flat 2D street map helps very little. Indoors, GPS drops out. J.A.R. therefore builds its core 3D mapping technology directly on the responders' headsets so every AR headset continuously maps its own three-dimensional surroundings as the team advances.",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Lokales 3D-Mapping pro AR-Brille (Spatial Mapping / SLAM).** Über ihre Tiefen- und Trackingkameras tastet jede AR-Brille laufend Wände, Böden, Treppen, Türen und Trümmer ab und baut daraus in Echtzeit ein lokales 3D-Oberflächennetz (Mesh) des durchquerten Bereichs auf.",
              "**Räumliche 3D-Patientenmarkierung.** Sobald ein Patient gesichtet oder über seinen Tag bzw. Marker erfasst wird, speichert die Brille seinen genauen **3D-Raumpunkt** innerhalb dieses Oberflächennetzes inklusive Stockwerk, Raumgeometrie und Liegeposition.",
              "**Multi-Headset-Kartenfusion (Map Merging).** Gehen mehrere Trupps getrennt durch verschiedene Gebäudeteile oder Einsatzabschnitte vor, senden ihre Client-Einheiten die lokalen 3D-Teilkarten an den Server im Einsatzleitfahrzeug, wo gemeinsame Raummerkmale und Ankerpunkte alle Einzelkarten automatisch zu **einer einzigen, gemeinsamen 3D-Karte** verschmelzen.",
            ],
            en: [
              "**Local 3D mapping per AR headset (Spatial Mapping / SLAM).** Using its depth and tracking cameras, each AR headset continuously scans walls, floors, stairs, doorways and debris, building a real-time local 3D surface mesh of the area traversed.",
              "**Spatial 3D patient anchoring.** As soon as a patient is triaged or scanned via tag or marker, the headset pins their exact **3D spatial coordinate** inside that surface mesh, preserving floor level, room geometry and position.",
              "**Multi-headset map fusion (map merging).** When several teams advance through different wings or sectors, their client units stream local 3D sub-maps to the command vehicle server, where matching spatial features and anchor points automatically merge the individual headset scans into **one unified 3D map**.",
            ],
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "**Geteiltes räumliches Wissen.** Hat Trupp 1 einen Patienten im zweiten Untergeschoss markiert, sehen nachfolgende Trupps und die Einsatzleitung diesen Patienten sofort an der exakten 3D-Position in der gemeinsamen Raumkarte samt farbcodiertem 3-Meter-Näherungsring im AR-Sichtfeld.",
            en: "**Shared spatial memory.** Once Team 1 has pinned a patient on the second basement level, follow-on teams and incident command immediately see that patient at the exact 3D coordinate in the fused spatial map complete with a colour-coded 3-metre proximity ring in the AR view.",
          },
        },
      ],
    },
    {
      id: "externe-3d-daten-und-luftbilder",
      title: {
        de: "Integration externer 3D-, Drohnen- & Satellitenlayer",
        en: "Integrating external 3D, drone & satellite layers",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Die 3D-Nahbereichskartierung und die Multi-Brillen-Fusion entstehen direkt bei J.A.R. Großflächige Außenkarten kommen von außen. Einsatzorganisationen betreiben bereits eigene BOS-Drohnen, nutzen amtliche Geodaten oder beziehen Satellitenbilder über Partner wie das **DLR**, die J.A.R. ohne eigene Fluggeräte direkt als zusätzliche Kartenlayer einbindet.",
            en: "Close-range 3D mapping and multi-headset fusion are built in-house by J.A.R. Wide-area outdoor maps come from outside. Response organisations already fly their own UAVs, use official GIS data or receive satellite imagery through partners such as **DLR**, which J.A.R. imports directly as additional map layers.",
          },
        },
        {
          type: "figure",
          src: {
            de: "../demo/DataSet/images/04-luftaufklaerung.jpg",
            en: "../demo/DataSet/images/04-luftaufklaerung.jpg",
          },
          alt: {
            de: "Luftaufklärung über einem Schadensgebiet zur Erstellung aktueller Lagekarten.",
            en: "Aerial reconnaissance over a disaster area used to generate up-to-date incident maps.",
          },
          caption: {
            de: "Externe Drohnen- und Satellitenaufnahmen liefern die großflächige Außenansicht, in die J.A.R. die hochauflösenden 3D-Raumkarten der AR-Brillen einbettet.",
            en: "External drone and satellite imagery provides the wide-area outdoor layer into which J.A.R. embeds the high-resolution 3D indoor and close-range maps from the AR headsets.",
          },
        },
        {
          type: "table",
          head: {
            de: ["Kartenebene", "Herkunft der Daten", "Nutzen im J.A.R.-Gesamtlagebild"],
            en: ["Map layer", "Data source", "Value in the J.A.R. operating picture"],
          },
          rows: {
            de: [
              [
                "1. 3D-Raumkarte & Patientenanker",
                "J.A.R.-Eigenentwicklung (Multi-AR-Brillen-Fusion)",
                "Zentimetergenaue 3D-Umgebungskarte aus den AR-Brillen der Trupps mit räumlich verankerten Patienten über mehrere Räume und Stockwerke.",
              ],
              [
                "2. Drohnen-Orthofotos & 3D-Gelände",
                "Drittanbieter-Systeme (BOS-Drohnen, OpenDroneMap / GeoTIFF)",
                "Aktuelle Luftbild-Mosaike und 3D-Geländemodelle zeigen überflutete Straßen, Trümmerkegel und versperrte Anfahrtswege.",
              ],
              [
                "3. Satelliten- & GIS-Karten",
                "Externe Partner (z. B. DLR, Katasterdaten, OpenStreetMap)",
                "Großräumige Schadensübersicht, Gebäudegrundrisse und vorab gespeicherte Offline-Straßennetze.",
              ],
            ],
            en: [
              [
                "1. 3D spatial map & patient anchors",
                "J.A.R. in-house tech (multi-AR-headset fusion)",
                "Centimetre-accurate 3D environment map built by the responders' AR headsets with spatially anchored patients across rooms and floors.",
              ],
              [
                "2. Drone orthophotos & 3D terrain",
                "Third-party systems (agency UAVs, OpenDroneMap / GeoTIFF)",
                "Up-to-date aerial orthomosaics and 3D surface models reveal flooded roads, debris piles and blocked access routes.",
              ],
              [
                "3. Satellite & GIS base maps",
                "External partners (e.g. DLR, cadastral GIS, OpenStreetMap)",
                "Wide-area disaster overview, building footprints and pre-cached offline road networks.",
              ],
            ],
          },
        },
        {
          type: "p",
          text: {
            de: 'Liefern externe Drohnen Live-Kamerabilder samt Flugtelemetrie (GPS, Höhe, Gimbal-Winkel), erkennt das Modul `drone2overlay` zusätzlich Personen, Fahrzeuge sowie Gefahrenflächen wie Rauch, Feuer oder Überflutung (`CLIPSeg`) und projiziert sie per **Ray-Terrain-Georeferenzierung** als prüfbare Hinweise (**"Unbestätigter KI-Kandidat"**) auf die Karte.',
            en: 'When external drones supply live camera frames with flight telemetry (GPS, altitude, gimbal pose), the `drone2overlay` module also detects people, vehicles and hazard footprints such as smoke, fire or flooding (`CLIPSeg`) and projects them onto the map via **ray-terrain georeferencing** as reviewable cues (**"Unconfirmed AI candidate"**).',
          },
        },
      ],
    },
    {
      id: "fusion-im-einsatzlagebild",
      title: {
        de: "Vom 3D-Anker ins gemeinsame Einsatzlagebild",
        en: "From 3D anchor to the shared incident operating picture",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Im Einsatzleitfahrzeug laufen alle Ebenen zusammen. Dort verbinden sich die fusionierte 3D-Raumkarte der AR-Brillen, die Patienten-Scans (RFID/NFC bzw. ArUco) und die externen Luftbild-Layer in einer gemeinsamen Ansicht.",
            en: "Inside the command vehicle, all layers meet. There, the fused 3D spatial map from the AR headsets, the patient scans (RFID/NFC or ArUco) and the external aerial layers converge in one shared view.",
          },
        },
        {
          type: "figure",
          src: {
            de: "../demo/DataSet/images/05-lagebild.png",
            en: "../demo/DataSet/images/05-lagebild.png",
          },
          alt: {
            de: "Screenshot des J.A.R. Einsatzlagebilds mit Kartenlayern, Einsatzraster und Patientenmarkierungen.",
            en: "Screenshot of the J.A.R. incident operating picture with map layers, operational grid and patient markers.",
          },
          caption: {
            de: "Das Lagebild im Einsatzleitfahrzeug verbindet Außenkarten, Einsatzraster (A1 bis J8), Gefahrenzonen und die räumlich erfassten Patienten.",
            en: "The command vehicle operating picture combines outdoor map layers, the operational grid (A1 to J8), hazard zones and spatially tracked patients.",
          },
        },
        {
          type: "list",
          items: {
            de: [
              "**Durchgängiger Blick von außen nach innen.** Die Einsatzleitung überblickt das gesamte Gebiet im **Einsatzraster (A1 bis J8)** auf Basis externer Luft- und Straßenkarten und zoomt direkt in die von den AR-Brillen aufgebaute 3D-Raumkarte einzelner Gebäude und Patienten hinein.",
              "**Ehrliche Georeferenzierung ohne Schätzwerte.** Fehlt bei einem Bild oder einem Offline-Abschnitt vorübergehend eine gesicherte Koordinate, erfindet J.A.R. niemals einen Kartenpunkt, sondern weist einen Unsicherheitsradius aus oder legt den Eintrag in die Prüf-Warteschlange.",
              "**Zwei-Wege-Synchronisation mit den Trupps.** Zeichnet die Einsatzleitung Gefahrenbereiche, Sammelplätze oder Haltepunkte im Lagebild ein, erscheinen diese Markierungen sofort in der 3D-Karte und im Sichtfeld der vernetzten AR-Brillen.",
            ],
            en: [
              "**Continuous zoom from wide area to indoor 3D.** Incident command views the entire sector in the **operational grid (A1 to J8)** over external aerial and street maps and zooms directly into the headset-built 3D spatial map of individual buildings and patients.",
              "**Honest georeferencing without invented coordinates.** Whenever a frame or offline sector temporarily lacks verified coordinates, J.A.R. never fabricates a map pin, displaying an explicit uncertainty radius or placing the item in the review queue instead.",
              "**Two-way sync with field teams.** When incident command draws hazard zones, casualty collection points or staging areas on the map, those markers appear immediately inside the fused 3D map and field of view of the connected AR headsets.",
            ],
          },
        },
        {
          type: "link",
          href: "../demo/",
          label: {
            de: "Live-Lagebild-Demo öffnen",
            en: "Open live operating picture demo",
          },
        },
      ],
    },
  ],
};
