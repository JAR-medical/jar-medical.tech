// Registry of animated visual blocks. Each module exports VISUALS, a map of
// block type → (block, lang) => Node. render.js merges this registry into its
// renderers, and tests/content.test.mjs accepts exactly these block types.
import { VISUALS as transkription } from "./transkription.js";
import { VISUALS as arMesh } from "./ar-mesh.js";
import { VISUALS as kartierung } from "./kartierung.js";
import { VISUALS as recorder } from "./recorder-demo.js";
import { VISUALS as droneMesh } from "./drone-mesh.js";

export const VISUALS = { ...transkription, ...arMesh, ...kartierung, ...recorder, ...droneMesh };

export const VISUAL_TYPES = Object.freeze(Object.keys(VISUALS));
