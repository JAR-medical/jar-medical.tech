// Minimal HTML/JS inspection helpers. The site has no build step and no npm
// dependencies, so the tests parse the shipped files directly rather than
// pulling in a DOM library.
import vm from 'node:vm';

/**
 * Every `data-i18n` attribute value in document order, including repeats
 * (the same key is deliberately reused, e.g. nav_problem in nav and footer).
 */
export function i18nKeyOccurrences(html) {
  const out = [];
  const re = /data-i18n\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(m[1]);
  return out;
}

/** Unique `data-i18n` keys in a document, sorted. */
export function i18nKeys(html) {
  return [...new Set(i18nKeyOccurrences(html))].sort();
}

/**
 * The inner HTML of every element carrying `data-i18n`, keyed by key.
 * Mirrors what index.html itself does to build its German dictionary:
 * `nodes.forEach(el => de[key] = el.innerHTML)`.
 *
 * Returns a Map<key, string[]> so callers can detect the case where the same
 * key is attached to two elements with *different* text - in the real page the
 * last one silently wins and switching to German would rewrite the other node.
 */
export function i18nMarkupText(html) {
  const out = new Map();
  // Match an opening tag that carries data-i18n, then its content up to the
  // matching close tag. The markup is hand-written and never nests an element
  // of the same name inside a translated element, so a non-greedy scan with a
  // depth counter over same-name tags is sufficient and exact here.
  const openRe = /<([a-zA-Z][\w-]*)\b([^>]*\bdata-i18n\s*=\s*"([^"]*)"[^>]*)>/g;
  let m;
  while ((m = openRe.exec(html)) !== null) {
    const [, tag, attrs, key] = m;
    if (/\/\s*$/.test(attrs)) continue; // self-closing: no inner text
    const start = openRe.lastIndex;
    const scan = new RegExp(`<(/?)${tag}\\b`, 'gi');
    scan.lastIndex = start;
    let depth = 1;
    let end = -1;
    let s;
    while ((s = scan.exec(html)) !== null) {
      depth += s[1] === '/' ? -1 : 1;
      if (depth === 0) { end = s.index; break; }
    }
    if (end === -1) throw new Error(`unclosed <${tag}> for data-i18n="${key}"`);
    const text = html.slice(start, end);
    if (!out.has(key)) out.set(key, []);
    out.get(key).push(text);
  }
  return out;
}

/** Collapse whitespace so hand-wrapped markup compares equal to a one-line dict value. */
export function normalize(s) {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Extract the `{ ... }` object literal assigned to `varName` from JS source.
 * Brace-balanced, and aware of strings, template literals, regex-free comments.
 */
export function extractObjectLiteral(src, varName) {
  const decl = new RegExp(`(?:var|let|const)\\s+${varName}\\s*=\\s*\\{`);
  const m = decl.exec(src);
  if (!m) throw new Error(`could not find declaration of ${varName}`);
  const start = m.index + m[0].length - 1; // at the '{'
  let i = start;
  let depth = 0;
  let quote = null;
  while (i < src.length) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i += 2; continue; }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i === -1) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i); if (i === -1) break; i += 2; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    i++;
  }
  throw new Error(`unbalanced object literal for ${varName}`);
}

/** Evaluate a plain object literal in a fresh, empty context. No globals reachable. */
export function evalObjectLiteral(literal, label = 'object') {
  try {
    return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 5000 });
  } catch (err) {
    throw new Error(`${label} is not a valid JS object literal: ${err.message}`);
  }
}

/** Pull `varName`'s object literal out of an HTML file's inline <script>s. */
export function objectFromHtml(html, varName) {
  return evalObjectLiteral(extractObjectLiteral(html, varName), varName);
}

/** Every `id="..."` in a document. */
export function elementIds(html) {
  const out = new Set();
  const re = /\sid\s*=\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) out.add(m[1]);
  return out;
}

/**
 * Every reference a browser would actually fetch or navigate to:
 * href/src attributes, plus the `url=` of a `<meta http-equiv="refresh">`.
 * Returns [{ attr, value, line }].
 */
export function references(html) {
  const out = [];
  const lineAt = (idx) => html.slice(0, idx).split('\n').length;

  const attrRe = /\b(href|src)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    out.push({ attr: m[1], value: m[2], line: lineAt(m.index) });
  }

  const refreshRe = /<meta[^>]*http-equiv\s*=\s*"refresh"[^>]*content\s*=\s*"([^"]*)"/gi;
  while ((m = refreshRe.exec(html)) !== null) {
    const url = /url\s*=\s*(.+)$/i.exec(m[1]);
    if (url) out.push({ attr: 'meta-refresh', value: url[1].trim(), line: lineAt(m.index) });
  }
  return out;
}

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/** True for anything the filesystem cannot answer for: http(s), mailto, tel, data, protocol-relative. */
export function isExternal(value) {
  return EXTERNAL.test(value);
}
