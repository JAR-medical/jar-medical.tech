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
      quiz: [
        {
          q: {
            de: "Warum liegt das 3D-Modell deckungsgleich auf dem Video?",
            en: "Why does the 3D model line up exactly with the video?",
          },
          options: [
            { de: "Weil für jedes Einzelbild Position, Blickrichtung und Brennweite der Kamera berechnet wurden und das Modell mit genau dieser Kamera projiziert wird", en: "Because the camera's position, viewing direction and focal length were computed for every frame and the model is projected with exactly that camera" },
            { de: "Weil die Drohne GPS-Koordinaten im Video mitsendet", en: "Because the drone embeds GPS coordinates in the video" },
            { de: "Weil das Netz von Hand auf das Video gezeichnet wurde", en: "Because the mesh was drawn onto the video by hand" },
          ],
          answer: 0,
          explain: {
            de: "Structure from Motion bestimmt aus den Bildern selbst, wo die Kamera bei jedem Bild war. Mit diesen Kameras deckt sich das Modell mit jedem Bild des Videos.",
            en: "Structure from motion determines from the images themselves where the camera was for every frame. With these cameras the model matches every frame of the video.",
          },
        },
        {
          q: {
            de: "Warum muss der Stitcher nur 4 statt 6 Freiheitsgrade suchen?",
            en: "Why does the stitcher only search 4 instead of 6 degrees of freedom?",
          },
          options: [
            { de: "Weil die Schwerkraft die Hochachse (+Y) festlegt und Neigung entfällt", en: "Because gravity fixes the vertical axis (+Y), so tilt drops out" },
            { de: "Weil Drohnen nur geradeaus fliegen", en: "Because drones only fly straight ahead" },
            { de: "Weil die Karte zweidimensional ist", en: "Because the map is two-dimensional" },
          ],
          answer: 0,
          explain: {
            de: "Übrig bleiben die Drehung um die Hochachse und die 3D-Verschiebung. Das macht die Suche schnell und eindeutig.",
            en: "What remains is the rotation about the vertical axis and the 3D shift. That makes the search fast and unambiguous.",
          },
        },
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
      quiz: [
        {
          q: {
            de: "Welcher Schritt liefert die Kameraposen zu jedem Bild?",
            en: "Which step delivers the camera pose for every frame?",
          },
          options: [
            { de: "Structure from Motion", en: "Structure from motion" },
            { de: "Georeferenzierung", en: "Georeferencing" },
            { de: "Lagebild", en: "Operating picture" },
          ],
          answer: 0,
          explain: {
            de: "Structure from Motion schätzt aus den Punkt-Zuordnungen, wo die Kamera bei jedem Bild war, und erzeugt eine dünne Punktwolke.",
            en: "Structure from motion estimates from the point matches where the camera was for each frame and creates a sparse point cloud.",
          },
        },
        {
          q: {
            de: "Was fügt der J.A.R.-Hub-Stitcher dem Drohnen-Mesh hinzu?",
            en: "What does the J.A.R. hub stitcher add to the drone mesh?",
          },
          options: [
            { de: "Die Raumscans der AR-Brillen mit den Patientenpositionen im Inneren", en: "The AR headsets' room scans with patient positions indoors" },
            { de: "Ein zweites Drohnenvideo", en: "A second drone video" },
            { de: "Wetterdaten", en: "Weather data" },
          ],
          answer: 0,
          explain: {
            de: "Außen aus der Luft, innen aus den Brillen: Erst zusammen entsteht ein Lagebild, das auch verdeckte Patienten zeigt.",
            en: "Outside from the air, inside from the headsets: only together do they form an operating picture that shows hidden patients too.",
          },
        },
      ],
    },
  ],
};
