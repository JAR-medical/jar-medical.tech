// Demo course: from drone flight to 3D mesh. Real drone footage (credited in
// assets/drone/CREDITS.json) with the photogrammetry model reconstructed from
// it (assets/drone/model/), a stitching animation and the software chain.
// Visuals live in js/visuals/drone-mesh.js.
export default {
  id: "demo-3d-kartierung",
  version: 1,
  section: "test",
  icon: "compass",
  title: {
    de: "Demo: Vom Drohnenflug zum 3D-Mesh",
    en: "Demo: from drone flight to 3D mesh",
  },
  subtitle: {
    de: "Echte Drohnenaufnahme, exaktes 3D-Modell",
    en: "Real drone footage, exact 3D model",
  },
  summary: {
    de: "Aus einer echten Drohnenaufnahme eines nach einem Erdbeben eingestürzten Wohnhauses wurde per Photogrammetrie ein exaktes, texturiertes 3D-Modell berechnet. Sie sehen, wie es deckungsgleich auf dem Video liegt, können es frei drehen und lernen, wie Teilkarten zusammengesetzt werden und welche Software-Kette dahintersteht.",
    en: "Photogrammetry turned real drone footage of a residential building that collapsed in an earthquake into an exact, textured 3D model. See it line up with the video, turn it freely and learn how partial maps are stitched together and which software chain is behind it.",
  },
  audience: {
    de: "Für Einsatzleitungen, Drohnen- und Geoinformations-Fachberater sowie technische Projektpartner.",
    en: "For incident commanders, drone and geoinformation specialists and technical project partners.",
  },
  minutes: 12,
  lessons: [
    {
      id: "drohnenflug-zu-mesh",
      title: { de: "Vom Überflug zum Mesh", en: "From flyover to mesh" },
      minutes: 7,
      blocks: [
        { type: "drone-mesh-player" },
        {
          type: "p",
          text: {
            de: "Nach einem Gebäudeeinsturz zeigt das Mesh Trümmerkegel, Hohlräume, in denen Verschüttete überleben können, und freie Stellflächen für Drehleiter und Kran. Im MANV wird daraus die Grundlage für **Suchabschnitte, Patientenablage und Anfahrtswege**.",
            en: "After a building collapse, the mesh shows debris piles, voids where trapped people can survive and free standing space for aerial ladders and cranes. In an MCI this becomes the basis for **search sectors, casualty collection point and access routes**.",
          },
        },
        { type: "stitch-demo" },
      ],
    },
    {
      id: "software-pipeline",
      title: { de: "Die Software-Kette dahinter", en: "The software chain behind it" },
      minutes: 5,
      blocks: [
        { type: "mapping-software-pipeline" },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "Luftbilder sehen kein Gebäudeinneres. Erst der Hub-Stitcher verbindet das Drohnen-Mesh mit den Raumscans der AR-Brillen, sodass auch Patienten in Kellern und Treppenhäusern an der richtigen Stelle im Lagebild erscheinen.",
            en: "Aerial images cannot see inside buildings. Only the hub stitcher joins the drone mesh with the AR headsets' room scans, so patients in basements and stairwells also appear in the right place in the operating picture.",
          },
        },
      ],
    },
  ],
};
