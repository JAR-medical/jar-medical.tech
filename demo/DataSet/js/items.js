import { BLOCK } from "./world.js";

// The hotbar intentionally stays minimal: one universal med kit and one
// placeable wool block. The med kit applies treatment additively; the report
// can still be spoken afterwards.
export const HOTBAR_ITEMS = Object.freeze([
  Object.freeze({
    id: "med-kit",
    label: "Med-Kit",
    icon: "🩺",
    type: "use",
    help: "Behandelt alles; der Sprachbericht bleibt möglich",
  }),
  Object.freeze({
    id: "emergency-blanket",
    label: "Wolle",
    icon: "🧶",
    type: "block",
    block: BLOCK.EMERGENCY_BLANKET,
    help: "Wollblock platzieren",
  }),
]);

// Kept as a compatibility export for callers that only care about placeable
// blocks.  The active hotbar itself is HOTBAR_ITEMS.
export const HOTBAR_BLOCKS = Object.freeze(
  HOTBAR_ITEMS.filter((item) => item.type === "block").map((item) => item.block)
);

export function hotbarKeyLabel(index) {
  if (index === 9) return "0";
  return String(index + 1);
}
