// Course symbols, drawn like the main site's cell icons (24px grid, 1.6
// stroke, round caps, currentColor). Built with DOM calls, never innerHTML.
// A course names its symbol in its content file: `icon: "triage"`.
const SVG_NS = "http://www.w3.org/2000/svg";

// Each shape: [tag, attributes]. Every shape gets pathLength="1" so the
// motion layer can draw it stroke by stroke.
export const ICONS = {
  // A triage tag (Umhängekarte) with its eyelet and a cross.
  triage: [
    ["path", { d: "M8 3.5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" }],
    ["circle", { cx: "12", cy: "7.2", r: "1.2" }],
    ["path", { d: "M12 11.2v6M9 14.2h6" }],
  ],
  // A microphone with acoustic waves for the transcription & diarization demo.
  voice: [
    ["rect", { x: "9", y: "3.5", width: "6", height: "10", rx: "3" }],
    ["path", { d: "M6 10.5a6 6 0 0 0 12 0M12 16.5v4M9 20.5h6" }],
  ],
  // System overview / compass
  compass: [
    ["circle", { cx: "12", cy: "12", r: "8.5" }],
    ["path", { d: "M14.8 9.2l-2 5.6-5.6 2 2-5.6 5.6-2Z" }],
  ],
  // Edge AI / processor chip
  cpu: [
    ["rect", { x: "6.5", y: "6.5", width: "11", height: "11", rx: "1.8" }],
    ["path", { d: "M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" }],
  ],
  // Privacy & offline shield
  shield: [
    ["path", { d: "M12 3.5l7 3v5.2c0 4.5-3 7.6-7 8.8-4-1.2-7-4.3-7-8.8V6.5l7-3Z" }],
    ["path", { d: "M9.2 12.2l2 2 3.8-4" }],
  ],
  // Speech waveform / ASR pipeline
  waveform: [
    ["path", { d: "M3.5 12h2M7.5 8v8M11.5 5v14M15.5 9v6M19.5 11v2" }],
  ],
  // Map / operating picture
  map: [
    ["path", { d: "M3.5 6.5l5.5-2 6 2 5.5-2v13l-5.5 2-6-2-5.5 2v-13Z" }],
    ["path", { d: "M9 4.5v13M15 6.5v13" }],
  ],
  // Responder AR helmet / visor
  helmet: [
    ["path", { d: "M4.5 13a7.5 7.5 0 0 1 15 0v2.5H4.5V13Z" }],
    ["path", { d: "M6.5 15.5l1.5 4h8l1.5-4M8 12h8" }],
  ],
  // AR system: glasses visor + RFID/NFC waves + network node
  arSystem: [
    ["rect", { x: "3.5", y: "6.5", width: "17", height: "7", rx: "2.5" }],
    ["path", { d: "M10.5 13.5l1.5-2 1.5 2M7.5 10h2M14.5 10h2" }],
    ["path", { d: "M8.5 17.5a5 5 0 0 1 7 0M10.2 19.8a2.5 2.5 0 0 1 3.6 0" }],
  ],
  // 3D terrain layers, satellite/drone fusion & flood level
  layers3d: [
    ["path", { d: "M12 3.5l8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" }],
    ["path", { d: "M3.5 12.5l8.5 4.5 8.5-4.5" }],
    ["path", { d: "M3.5 16.8c2.2-1.2 4.5 1.2 6.8 0s4.5-1.2 6.8 0 2.2 0.8 3.4 0" }],
  ],
  // Clinical documentation / JAR Scribe
  scribe: [
    ["rect", { x: "6", y: "3.5", width: "12", height: "17", rx: "2" }],
    ["path", { d: "M9 8.5h6M9 12h6M9 15.5h4" }],
  ],
  // Fallback for a course without a symbol of its own.
  course: [
    ["path", { d: "M4 6h5M4 12h5M4 18h5M12 6h8M12 12h8M12 18h8" }],
  ],
};

export function courseIcon(name) {
  const shapes = ICONS[name] || ICONS.course;
  const svg = document.createElementNS(SVG_NS, "svg");
  for (const [k, v] of Object.entries({
    viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "1.6",
    "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", focusable: "false",
  })) svg.setAttribute(k, v);
  for (const [tag, attrs] of shapes) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.setAttribute("pathLength", "1");
    svg.appendChild(node);
  }
  const box = document.createElement("span");
  box.className = "course-icon";
  box.appendChild(svg);
  return box;
}
