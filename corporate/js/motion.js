// Page motion, after the main site's js/scroll-fx.js and js/waveform.js.
//
// Same contract as there: one rAF-throttled scroll listener, scroll position
// is the only input, every frame is a pure function of where the page is, and
// scrolling back plays it in reverse. Because nothing depends on time or on
// "has this been seen", a page that re-renders (after a language switch or a
// data refresh) lands in exactly the state it was in — no replays, no flashes.
//
// Opt-in, never opt-out: this module adds html.fx-live when it takes over and
// the motion CSS in portal.css only styles under that class (the load
// animations additionally sit under prefers-reduced-motion: no-preference).
// Without JS, under reduced motion, or if anything here throws, the page is
// simply static.
//
// Only individual `translate` / `scale` / `rotate` properties and custom
// properties are written, so nothing fights the CSS transforms of components.
import { onLangChange } from "./i18n.js";

const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3); // out-cubic
const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const span = (p, a, b) => clamp((p - a) / (b - a));
// Progress of an element's top edge travelling from `from` to `to`, both
// fractions of the viewport height (1 = bottom edge, 0 = top edge).
const travel = (rect, vh, from, to) => clamp((vh * from - rect.top) / (vh * (from - to)));

// ── Text splitting ───────────────────────────────────────────────────────────
// Words become spans; whitespace stays real text so textContent is unchanged.
function splitWords(el, cls, wrapCls) {
  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  if (!text) return [];
  el.textContent = "";
  return text.split(" ").map((word, i, all) => {
    const w = document.createElement("span");
    w.className = cls;
    w.textContent = word;
    const m = document.createElement("span");
    m.className = wrapCls;
    m.appendChild(w);
    el.appendChild(m);
    if (i < all.length - 1) el.appendChild(document.createTextNode(" "));
    return w;
  });
}

// Deterministic noise for the decoding labels: a hash, not Math.random().
const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%/+=<>";
function glyph(i, k) {
  let h = (i * 374761393 + k * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return GLYPHS.charAt(h % GLYPHS.length);
}

// ── Effects ──────────────────────────────────────────────────────────────────
// Each factory returns { draw(rect, vh, vw, atEnd), setup?() }. setup() splits
// text and is re-run after a language switch, which rewrites textContent.
const EFFECTS = [
  // Section headlines rise out of a mask, word by word.
  {
    selector: "#ablauf h2, #signin .access__head h2, .dash-section > h2",
    make(el) {
      let words = [];
      return {
        setup() { words = splitWords(el, "fx-rise", "fx-mask"); },
        draw(r, vh, vw, atEnd) {
          const p = atEnd ? 1 : travel(r, vh, 0.96, 0.62);
          const n = words.length;
          words.forEach((w, i) => {
            const lo = n > 1 ? (i / (n - 1)) * 0.45 : 0;
            const t = ease(span(p, lo, lo + 0.55));
            w.style.translate = `0 ${((1 - t) * 105).toFixed(1)}%`;
            w.style.rotate = `${((1 - t) * 4).toFixed(2)}deg`;
          });
        },
      };
    },
  },
  // Monospace labels settle from noise into the word, left to right.
  {
    selector: "#ablauf .eyebrow, #signin .eyebrow",
    make(el) {
      let text = "", shown = null, last = "";
      return {
        setup() {
          text = (el.textContent || "").replace(/\s+/g, " ").trim();
          el.textContent = "";
          const real = document.createElement("span");
          real.className = "visually-hidden";
          real.textContent = text;
          shown = document.createElement("span");
          shown.className = "fx-decode";
          shown.setAttribute("aria-hidden", "true");
          el.append(real, shown);
          last = "";
        },
        draw(r, vh, vw, atEnd) {
          const p = atEnd ? 1 : travel(r, vh, 0.94, 0.6);
          const tick = Math.floor(p * 24);
          let out = "";
          for (let i = 0; i < text.length; i++) {
            const c = text.charAt(i);
            const at = text.length > 1 ? (i / (text.length - 1)) * 0.7 : 0;
            out += c === " " || p >= at + 0.3 ? c : p > at ? glyph(i, tick) : " ";
          }
          if (out !== last) { shown.textContent = out; last = out; }
          shown.style.setProperty("--decoded", p.toFixed(3));
        },
      };
    },
  },
  // The three steps converge from a staircase; a mint scan line crosses each.
  {
    selector: ".how-steps li",
    make(el) {
      const i = [...el.parentNode.children].indexOf(el);
      return {
        draw(r, vh, vw, atEnd) {
          const p = atEnd ? 1 : travel(r, vh, 1.0, 0.5);
          const step = vw > 900 ? i : 0;
          el.style.translate = `0 ${((1 - ease(p)) * (40 + step * 46)).toFixed(1)}px`;
          el.style.setProperty("--fx-scan", smooth(span(p, 0.2, 0.9)).toFixed(3));
          el.style.setProperty("--fx-col", smooth(span(p, 0.1, 0.8)).toFixed(3));
        },
      };
    },
  },
  // Course cards arrive as a wave, each from its own depth.
  {
    selector: ".course-card",
    make(el) {
      const i = [...el.parentNode.children].indexOf(el);
      return {
        draw(r, vh, vw, atEnd) {
          const p = atEnd ? 1 : travel(r, vh, 1.05, 0.55);
          const depth = vw > 900 ? 60 + (i % 2) * 60 : 44;
          el.style.translate = `0 ${((1 - ease(p)) * depth).toFixed(1)}px`;
        },
      };
    },
  },
  // Stat tiles and the auth card rise and sharpen.
  {
    selector: ".stat-tile, .auth-card",
    make(el) {
      const i = el.classList.contains("stat-tile") ? [...el.parentNode.children].indexOf(el) : 0;
      return {
        draw(r, vh, vw, atEnd) {
          const p = atEnd ? 1 : travel(r, vh, 1.0, 0.6);
          const t = ease(span(p, i * 0.08, 1));
          el.style.translate = `0 ${((1 - t) * 36).toFixed(1)}px`;
          el.style.setProperty("--fx-fade", t.toFixed(3));
          el.style.setProperty("--fx-col", smooth(span(p, 0.15, 0.9)).toFixed(3));
        },
      };
    },
  },
  // Content blocks (dashboard sections, tables, lesson text, quiz) rise in as
  // they enter the lower part of the screen.
  {
    selector: ".dash-section, .table-wrap, .lesson-body > *, .quiz-question, .lesson-pager, .contact-line, .certificate",
    make(el) {
      return {
        draw(r, vh, vw, atEnd) {
          const p = atEnd ? 1 : travel(r, vh, 1.0, 0.82);
          const t = ease(p);
          el.style.translate = `0 ${((1 - t) * 28).toFixed(1)}px`;
          el.style.setProperty("--fx-fade", t.toFixed(3));
        },
      };
    },
  },
  // The hero halo drifts slower than the page as it scrolls away.
  {
    selector: ".hero__title",
    make(el) {
      return {
        draw(r) {
          const q = clamp(-r.top / Math.max(1, r.height));
          el.style.setProperty("--fx-drift", (q * 90).toFixed(1) + "px");
        },
      };
    },
  },
];

// ── The voice wave (js/waveform.js on the main site) ─────────────────────────
// Three tapered sine bundles, breathing like speech. Runs only while on screen
// and the tab is visible; under reduced motion it paints one still frame.
function mountWave(canvas, reduced) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  let width = 0, height = 0, time = 0, running = false, onScreen = false, frame = 0;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!running) paint();
  };

  const paint = () => {
    ctx.clearRect(0, 0, width, height);
    const cy = height / 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.lineWidth = i === 0 ? 2 : 1.25;
      const alpha = Math.max(0.1, (i === 0 ? 0.75 : 0.3 - i * 0.1) + Math.sin(time + i * Math.PI) * 0.1);
      ctx.strokeStyle = `rgba(142, 199, 184, ${alpha.toFixed(3)})`;
      const f = 0.015 + i * 0.005;
      const amp = height * 0.1 + (0.5 + Math.sin(time * 1.5) * 0.5) * (height * 0.3) * (1 - i * 0.2);
      const phase = time * 2.5 + i * (Math.PI / 3);
      ctx.moveTo(0, cy);
      for (let x = 0; x <= width; x += 3) {
        const win = Math.sin((x / width) * Math.PI);
        const y = Math.sin(x * f + phase) + Math.sin(x * f * 1.7 + phase * 1.3) * 0.6 + Math.cos(x * f * 0.4 - phase * 0.8) * 0.3;
        ctx.lineTo(x, cy + y * amp * win);
      }
      ctx.stroke();
    }
  };

  const loop = () => {
    if (!running) return;
    time += 0.02;
    paint();
    frame = requestAnimationFrame(loop);
  };
  const update = () => {
    const should = !reduced && onScreen && document.visibilityState === "visible";
    if (should && !running) { running = true; frame = requestAnimationFrame(loop); }
    if (!should && running) { running = false; cancelAnimationFrame(frame); }
  };

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver((entries) => {
    onScreen = entries.some((e) => e.isIntersecting);
    update();
  }).observe(canvas);
  document.addEventListener("visibilitychange", update);
  resize();
}

// ── Engine ───────────────────────────────────────────────────────────────────
export function initMotion() {
  try {
    if (!window.matchMedia || !window.requestAnimationFrame) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.querySelectorAll("canvas.fx-wave").forEach((c) => mountWave(c, reduced));
    if (reduced) return;

    const main = document.getElementById("main");
    if (!main) return;
    const root = document.documentElement;
    root.classList.add("fx-live", "fx-intro");
    // Headings on the app pages animate on their first render only. They
    // render once data has arrived, so the intro ends a moment after that.
    let introTimer = 0;
    const endIntro = () => root.classList.remove("fx-intro");
    const fallback = setTimeout(endIntro, 8000);
    const maybeEndIntro = () => {
      if (introTimer || !main.querySelector(".page-head, .lesson, .empty-state, .notice-error")) return;
      clearTimeout(fallback);
      introTimer = setTimeout(endIntro, 2000);
    };

    // One element can carry several effects (a heading rises and its rule
    // draws), so instances are tracked per effect.
    const live = []; // { el, inst }
    const known = EFFECTS.map(() => new WeakSet());

    const scan = () => {
      EFFECTS.forEach((def, d) => {
        document.body.querySelectorAll(def.selector).forEach((el) => {
          if (known[d].has(el)) return;
          known[d].add(el);
          const inst = def.make(el);
          inst.setup?.();
          live.push({ el, inst });
        });
      });
      for (let i = live.length - 1; i >= 0; i--) if (!live[i].el.isConnected) live.splice(i, 1);
      maybeEndIntro();
    };

    let queued = false;
    const frame = () => {
      queued = false;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      // At the very bottom nothing can travel further, so everything is home.
      const atEnd = window.scrollY + vh >= document.documentElement.scrollHeight - 2;
      for (const { el, inst } of live) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue; // far off screen: leave as is
        inst.draw(r, vh, vw, atEnd);
      }
    };
    const request = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(frame);
    };

    // Pages render into #main after data arrives and re-render on changes.
    new MutationObserver(() => { scan(); request(); }).observe(main, { childList: true, subtree: true });
    // The language switch rewrites textContent, which wipes split words.
    onLangChange(() => {
      for (const { el, inst } of live) if (inst.setup && el.isConnected) inst.setup();
      request();
    });
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request, { passive: true });
    scan();
    request();
  } catch (e) {
    // Motion is decoration: never let it take the page down.
    document.documentElement.classList.remove("fx-live", "fx-intro");
    console.warn("motion: disabled", e);
  }
}
