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
