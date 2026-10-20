// Shared helpers for the animated course visuals (js/visuals/*.js).
// Everything is built with DOM calls, never innerHTML. Colors come from the
// portal tokens (css/tokens.css) so the visuals match the rest of the portal.

const SVG_NS = "http://www.w3.org/2000/svg";

// Pick the language variant of a {de, en} value; plain strings pass through.
export function L(lang, value) {
  if (value == null) return "";
  if (typeof value === "object" && !Array.isArray(value)) return value[lang] ?? value.de ?? "";
  return value;
}

// svg("circle", {cx: 4, r: 2}, child...) — SVG element with attributes.
export function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key === "text") node.textContent = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// Adds a <style> element once per id. Visual modules keep their CSS next to
// their code this way instead of growing portal.css.
export function injectStyle(id, css) {
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}

export function prefersReducedMotion() {
  try {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  } catch {
    return false;
  }
}

// Runs frame(tSeconds, dtSeconds) on requestAnimationFrame while `node` is in
// the document and on screen. Pauses offscreen, stops for good once the node
// is removed (the course page replaces lesson DOM on navigation and language
// change). With reduced motion, frame is called once with `still` = true so
// the visual can draw a meaningful static end state.
// Returns { stop() }.
export function animate(node, frame, { still = prefersReducedMotion() } = {}) {
  let raf = 0;
  let visible = true;
  let stopped = false;
  let last = 0;
  let elapsed = 0;
  let observer = null;

  const stop = () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    observer?.disconnect();
  };

  const tick = (now) => {
    raf = 0;
    if (stopped) return;
    if (!node.isConnected) {
      // Not attached yet (first frames after render) or removed for good.
      if (elapsed > 0) return stop();
      raf = requestAnimationFrame(tick);
      return;
    }
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    elapsed += dt;
    try {
      frame(elapsed, dt, false);
    } catch (e) {
      console.error("visual: frame failed, animation stopped", e);
      return stop();
    }
    if (visible) raf = requestAnimationFrame(tick);
  };

  if (still) {
    // Draw once, as soon as the node is attached.
    const once = () => {
      if (node.isConnected) {
        try { frame(0, 0, true); } catch (e) { console.error("visual: still frame failed", e); }
      } else if (!stopped) requestAnimationFrame(once);
    };
    requestAnimationFrame(once);
    return { stop };
  }

  if ("IntersectionObserver" in globalThis) {
    observer = new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible && !raf && !stopped) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    });
    observer.observe(node);
  }
  raf = requestAnimationFrame(tick);
  return { stop };
}

// Canvas sized to its CSS box at device pixel ratio. Calls draw(ctx, w, h)
// through the returned resize() whenever the box changes; returns
// { canvas, ctx, size: () => ({w, h}) }.
export function hiDpiCanvas(className, onResize) {
  const canvas = document.createElement("canvas");
  canvas.className = className;
  const ctx = canvas.getContext("2d");
  let w = 0;
  let h = 0;
  const fit = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    const nw = Math.max(1, Math.round(rect.width));
    const nh = Math.max(1, Math.round(rect.height));
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    onResize?.(w, h);
  };
  if ("ResizeObserver" in globalThis) new ResizeObserver(fit).observe(canvas);
  return { canvas, ctx, size: () => { fit(); return { w, h }; } };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
