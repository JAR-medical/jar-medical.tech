// Hero scroll track — a port of the main site's js/hero-scroll.js (after
// mistral.ai's home hero). The hero sits in a two-screen track, pins for one,
// and as the visitor scrolls the left column folds away while the side cell
// grows to fill the view; the lead ends large and centred with the two ways in
// beneath it. Scrolling back reverses it.
//
// Markup:  <div class="hero-track" data-hero-scroll>
//            <section class="hero"> …four cells… </section>
//          </div>
//
// Same contract as there: one rAF-throttled scroll listener, scroll position
// is the only input, nothing runs on a timer. The script writes one progress
// value, --p (0..1), on .hero; the grid in portal.css is a function of it. The
// side cell's lead and buttons are measured once in flow and then placed here,
// because their path from the corner to the centre can't be expressed in CSS
// without reflowing the text. Below 1024px and under reduced motion the track
// stays inert and the hero is the plain grid; the media query matches the one
// in portal.css.
export function initHeroScroll() {
  const track = document.querySelector("[data-hero-scroll]");
  if (!track || !window.matchMedia) return;
  const hero = track.querySelector(".hero");
  const side = hero?.querySelector(".hero__side");
  const lead = side?.querySelector(":scope > p");
  const actions = side?.querySelector(":scope > .hero__actions");
  if (!hero || !side || !lead || !actions) return;
  const titleInner = hero.querySelector(".hero__title > div");
  const aside = hero.querySelector(".hero__aside");
  const canvas = hero.querySelector(".hero__art canvas");
  const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
  const lerp = (a, b, t) => a + (b - a) * t;
  let geo = null; // measured start/end geometry, null when inert
  let lastP = -1;

  const clearPlacement = () => {
    lead.style.translate = "";
    lead.style.scale = "";
    actions.style.translate = "";
  };

  // Read the layout at p = 0 with the side cell's contents still in flow,
  // then lift them out. Offsets, not bounding rects: the load animation is
  // still moving these elements for the first second and a rect would bake
  // that offset in.
  function measure() {
    track.classList.remove("is-measured");
    clearPlacement();
    lastP = -1;
    if (!mq.matches) {
      track.classList.remove("is-live");
      hero.style.removeProperty("--p");
      geo = null;
      return;
    }
    track.classList.add("is-live");
    hero.style.setProperty("--p", "0");
    const cw = hero.clientWidth;
    const ch = hero.clientHeight;
    const sideLeft = side.offsetLeft;
    const sideTop = side.offsetTop;
    const L0 = { x: sideLeft + lead.offsetLeft, y: sideTop + lead.offsetTop, w: lead.offsetWidth, h: lead.offsetHeight };
    const A0 = { x: sideLeft + actions.offsetLeft, y: sideTop + actions.offsetTop, w: actions.offsetWidth, h: actions.offsetHeight };
    if (L0.w < 1 || L0.h < 1) { geo = null; return; }

    // End state: the lead about three fifths of the sheet wide, never taller
    // than a bit over half of it, the buttons centred below.
    let s = Math.min(cw * 0.62, 960) / L0.w;
    s = Math.max(1, Math.min(s, (ch * 0.55) / L0.h));
    const gap = Math.max(16, A0.y - (L0.y + L0.h)) * 1.5;
    const groupH = L0.h * s + gap + A0.h;
    const top = (ch - groupH) / 2;

    // The buttons wrap inside a box as wide as the side cell; centre what is
    // actually drawn, not the box, or they land left of the lead's axis.
    let actVisible = 0;
    const aLeft = actions.getBoundingClientRect().left;
    for (const child of actions.children) actVisible = Math.max(actVisible, child.getBoundingClientRect().right - aLeft);
    if (!actVisible) actVisible = A0.w;

    geo = {
      sideLeft, sideTop, s, L0, A0,
      L1: { x: (cw - L0.w * s) / 2, y: top },
      A1: { x: (cw - actVisible) / 2, y: top + L0.h * s + gap },
    };
    hero.style.setProperty("--lead-w", L0.w + "px");
    hero.style.setProperty("--act-w", Math.ceil(A0.w) + "px");
    hero.style.setProperty("--row2-h", (aside ? aside.offsetHeight : ch * 0.4) + "px");
    if (titleInner) hero.style.setProperty("--title-w", titleInner.offsetWidth + "px");
    if (canvas) {
      hero.style.setProperty("--art-w", canvas.clientWidth + "px");
      hero.style.setProperty("--art-h", canvas.clientHeight + "px");
    }
    track.classList.add("is-measured");
  }

  // Positions are computed in hero coordinates and converted to the side
  // cell's, whose left edge moves with the folding column.
  function place(el, a, b, p, scale) {
    const x = lerp(a.x, b.x, p) - geo.sideLeft * (1 - p);
    const y = lerp(a.y, b.y, p) - geo.sideTop;
    el.style.translate = `${x.toFixed(2)}px ${y.toFixed(2)}px`;
    if (scale !== undefined) el.style.scale = scale.toFixed(4);
  }

  let queued = false;
  function frame() {
    queued = false;
    if (!geo) return;
    const total = track.offsetHeight - hero.offsetHeight;
    // The sheet pins under the fixed bar, so progress starts there.
    let p = total > 0 ? (navOffset() - track.getBoundingClientRect().top) / total : 0;
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    if (p === lastP) return;
    lastP = p;
    hero.style.setProperty("--p", p.toFixed(4));
    place(lead, geo.L0, geo.L1, p, lerp(1, geo.s, p));
    place(actions, geo.A0, geo.A1, p);
  }
  const navOffset = () => parseFloat(getComputedStyle(hero).top) || 0;
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  };

  let remeasureQueued = false;
  function remeasure() {
    if (remeasureQueued) return;
    remeasureQueued = true;
    requestAnimationFrame(() => {
      remeasureQueued = false;
      measure();
      frame();
    });
  }

  measure();
  frame();
  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", remeasure, { passive: true });
  window.addEventListener("orientationchange", () => setTimeout(remeasure, 120));
  mq.addEventListener?.("change", remeasure);
  // The lead's size depends on the font and the language. The language switch
  // swaps text in place, so watch the side cell's text; our own writes are
  // style attributes and don't trigger this.
  document.fonts?.ready?.then(remeasure);
  new MutationObserver(remeasure).observe(side, { childList: true, characterData: true, subtree: true });
}
