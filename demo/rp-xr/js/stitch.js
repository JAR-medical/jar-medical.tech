// Pure shader stitcher for RP-XR (WebGL2 GLSL ES 3.00).
// Stitches chunk sources in fixed slot order.
// No DOM, no WebGL: importable in node.

export const CHUNKS = Object.freeze([
  '00-prelude',
  '10-field',
  '12-nyctalopia',
  '15-glance-panel',
  '20-smoke',
  '21-photopsia',
  '22-sparkle',
  '23-murk',
  '24-transition',
  '80-overlay',
  '90-composite',
]);

export const CHUNK_QUALE = Object.freeze({
  '12-nyctalopia': 'nyctalopia',
  '20-smoke': 'smoke',
  '21-photopsia': 'photopsia',
  '22-sparkle': 'sparkle',
  '23-murk': 'murk',
  '24-transition': 'transition',
});

// PURE: (chunk sources, qualia, field, panel, mode) in -> GLSL ES 3.00 source out.
// mode is 'vr' | 'ar' | 'desktop'.
// #version 300 es is guaranteed to be the first line.
// In 'ar' mode:
//   - #define RP_AR is added
//   - glance panel and nyctalopia are compiled out (no defines, chunks excluded)
// Disabled qualia are excluded at stitch time: their chunk text is omitted
// AND their Q_* define is absent.
// 10-field is structural and ALWAYS included; Q_FIELD selects whether the full
// geometry or full-survival short-circuit compiles.
export function stitchShader(sources, qualia = {}, field = { enabled: true }, panel = { enabled: false }, mode = 'vr') {
  const isAR = mode === 'ar';

  const defines = [];
  if (isAR) {
    defines.push('#define RP_AR');
  }

  for (const [name, q] of Object.entries(qualia)) {
    if (q && q.enabled) {
      if (isAR && name === 'nyctalopia') {
        continue;
      }
      defines.push(`#define Q_${name.toUpperCase()}`);
    }
  }

  if (field && field.enabled) {
    defines.push('#define Q_FIELD');
  }

  if (panel && panel.enabled && !isAR) {
    defines.push('#define Q_PANEL');
  }

  const isChunkIncluded = (c) => {
    if (c === '15-glance-panel') {
      return Boolean(panel && panel.enabled && !isAR);
    }
    if (c === '12-nyctalopia') {
      return Boolean(qualia && qualia.nyctalopia && qualia.nyctalopia.enabled && !isAR);
    }
    if (c in CHUNK_QUALE) {
      const qname = CHUNK_QUALE[c];
      return Boolean(qualia && qualia[qname] && qualia[qname].enabled);
    }
    return true; // structural chunks: 00-prelude, 10-field, 80-overlay, 90-composite
  };

  const body = CHUNKS
    .filter(isChunkIncluded)
    .map(c => {
      const src = sources[c];
      if (typeof src !== 'string') {
        throw new Error(`Missing shader chunk: ${c}`);
      }
      return src;
    })
    .join('\n');

  let out = '#version 300 es\n';
  if (defines.length > 0) {
    out += defines.join('\n') + '\n';
  }
  out += body;
  return out;
}
