// Renders course content blocks (see the format in courses/*.js) into DOM
// nodes. Course text supports two inline markups: **bold** and `code`.
import { t } from "./i18n.js";
import { el } from "./ui.js";
import { renderTranscriptionDemo } from "./transcription-widget.js";
import { VISUALS } from "./visuals/index.js";

const LINK_PREFIXES = ["../demo/"];

// Pick the language variant of a {de, en} value; plain strings pass through.
function tx(value, lang) {
  if (value == null) return "";
  if (typeof value === "object" && !Array.isArray(value)) return value[lang] ?? value.de ?? "";
  return value;
}

// Escapes by construction (text nodes) and turns **bold** into <strong> and
// `code` into <code>.
export function inline(text) {
  const frag = document.createDocumentFragment();
  const src = String(text ?? "");
  const tokenRe = /\*\*(.+?)\*\*|`([^`]+?)`/g;
  let last = 0;
  let m;
  while ((m = tokenRe.exec(src)) !== null) {
    if (m.index > last) frag.append(document.createTextNode(src.slice(last, m.index)));
    if (m[1] != null) frag.append(el("strong", {}, m[1]));
    else frag.append(el("code", { class: "inline-code" }, m[2]));
    last = tokenRe.lastIndex;
  }
  if (last < src.length) frag.append(document.createTextNode(src.slice(last)));
  return frag;
}

const asArray = (value) => (Array.isArray(value) ? value : []);

const RENDERERS = {
  p: (b, lang) => el("p", {}, inline(tx(b.text, lang))),

  h: (b, lang) => el("h3", { class: "lesson-subhead" }, inline(tx(b.text, lang))),

  list: (b, lang) => el("ul", { class: "checklist" },
    asArray(tx(b.items, lang)).map((item) => el("li", {}, inline(item)))),

  steps: (b, lang) => el("ol", { class: "steps-list" },
    asArray(tx(b.items, lang)).map((item) => el("li", {}, inline(item)))),

  callout: (b, lang) => {
    const warn = b.tone === "warn";
    return el("div", { class: "callout " + (warn ? "callout-warn" : "callout-info"), role: "note" },
      el("span", { class: "callout-label" }, warn ? t("callout_warn") : t("callout_info")),
      el("p", {}, inline(tx(b.text, lang))));
  },

  table: (b, lang) => {
    const head = asArray(tx(b.head, lang));
    const rows = asArray(tx(b.rows, lang));
    return el("div", { class: "table-wrap" },
      el("table", { class: "data-table" },
        head.length ? el("thead", {}, el("tr", {}, head.map((h) => el("th", { scope: "col" }, inline(h))))) : null,
        el("tbody", {}, rows.map((row) => el("tr", {}, asArray(row).map((cell) => el("td", {}, inline(cell))))))));
  },

  figure: (b, lang) => {
    const src = String(tx(b.src, lang));
    if (!src || /^\s*javascript:/i.test(src)) return null;
    const caption = tx(b.caption, lang);
    return el("figure", { class: "lesson-figure" },
      el("img", { src, alt: tx(b.alt, lang), loading: "lazy" }),
      caption ? el("figcaption", { class: "figure-caption" }, inline(caption)) : null);
  },

  link: (b, lang) => {
    const href = String(b.href ?? "");
    if (!LINK_PREFIXES.some((prefix) => href.startsWith(prefix))) {
      console.warn("render: link block with disallowed href skipped", href);
      return null;
    }
    return el("p", { class: "lesson-link" },
      el("a", { class: "btn btn-outline", href, target: "_blank", rel: "noopener" }, tx(b.label, lang)));
  },

  "transcription-demo": (b, lang) => renderTranscriptionDemo(b, lang),

  ...VISUALS,
};

export function renderBlocks(blocks, lang) {
  const frag = document.createDocumentFragment();
  for (const block of asArray(blocks)) {
    const render = block && RENDERERS[block.type];
    if (!render) {
      console.warn("render: unknown block type skipped", block && block.type);
      continue;
    }
    const node = render(block, lang);
    if (node) frag.append(node);
  }
  return frag;
}
