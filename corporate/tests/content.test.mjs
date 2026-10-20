// Checks every course file for structural mistakes the renderer would turn
// into blank or broken lessons, and that schema.sql seeds exactly the course
// and lesson ids the content uses (otherwise saving progress fails).

import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { COURSES } from "../js/catalog.js";
import { ICONS } from "../js/icons.js";
import { VISUAL_TYPES } from "../js/visuals/index.js";

const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const BLOCK_TYPES = new Set(["p", "h", "list", "steps", "callout", "table", "figure", "link", "transcription-demo", ...VISUAL_TYPES]);
const ID = /^[a-z0-9-]{1,64}$/;

function text(v, where) {
  assert.ok(v && typeof v.de === "string" && typeof v.en === "string", `${where}: needs {de, en}`);
  assert.ok(v.de.trim() && v.en.trim(), `${where}: empty translation`);
  assert.ok(!/[<>]/.test(v.de + v.en), `${where}: no HTML allowed`);
}
function lists(v, where) {
  assert.ok(Array.isArray(v?.de) && Array.isArray(v?.en), `${where}: needs {de: [], en: []}`);
  assert.equal(v.de.length, v.en.length, `${where}: de/en length differ`);
  assert.ok(v.de.length > 0, `${where}: empty`);
}

let checked = 0;
for (const course of COURSES) {
  const c = course.id;
  assert.match(c, ID, "course id");
  for (const k of ["title", "subtitle", "summary", "audience"]) text(course[k], `${c}.${k}`);
  assert.ok(["understand", "test", "train"].includes(course.section), `${c}: invalid section "${course.section}"`);
  assert.ok(ICONS[course.icon], `${c}: icon "${course.icon}" is not in js/icons.js`);
  assert.ok(course.subtitle.de.length <= 60 && course.subtitle.en.length <= 60, `${c}: subtitle is one short line on the card`);
  assert.ok(course.lessons.length > 0, `${c}: no lessons`);

  const lessonIds = new Set();
  let minutes = 0;
  for (const l of course.lessons) {
    const at = `${c}/${l.id}`;
    assert.match(l.id, ID, `${at}: lesson id`);
    assert.ok(!lessonIds.has(l.id), `${at}: duplicate lesson id`);
    lessonIds.add(l.id);
    text(l.title, `${at}.title`);
    assert.ok(Number.isInteger(l.minutes) && l.minutes > 0, `${at}: minutes`);
    minutes += l.minutes;

    l.blocks.forEach((b, i) => {
      const w = `${at}.blocks[${i}]`;
      assert.ok(BLOCK_TYPES.has(b.type), `${w}: unknown type ${b.type}`);
      if (b.type === "p" || b.type === "h") text(b.text, w);
      if (b.type === "callout") { text(b.text, w); assert.ok(["info", "warn"].includes(b.tone), `${w}: tone`); }
      if (b.type === "list" || b.type === "steps") lists(b.items, w);
      if (b.type === "table") {
        assert.equal(b.head.de.length, b.head.en.length, `${w}: head`);
        lists(b.rows, w);
        b.rows.de.forEach((r, j) => {
          assert.equal(r.length, b.head.de.length, `${w}: de row ${j} width`);
          assert.equal(b.rows.en[j].length, b.head.de.length, `${w}: en row ${j} width`);
        });
      }
      if (b.type === "figure") { text(b.alt, w); text(b.caption, w); assert.ok(b.src?.de && b.src?.en, `${w}: src`); }
      if (b.type === "link") { text(b.label, w); assert.match(b.href, /^\.\.\/demo\//, `${w}: href`); }
    });

    for (const [i, q] of (l.quiz ?? []).entries()) {
      const w = `${at}.quiz[${i}]`;
      text(q.q, w);
      text(q.explain, w);
      assert.ok(q.options.length >= 2, `${w}: options`);
      q.options.forEach((o, j) => text(o, `${w}.options[${j}]`));
      assert.ok(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length, `${w}: answer`);
    }
  }
  assert.equal(minutes, course.minutes, `${c}: minutes don't add up`);

  // The schema must seed this course and exactly these lessons.
  assert.ok(schema.includes(`('${c}',`), `schema.sql: course '${c}' missing from courses`);
  const seeded = new Set([...schema.matchAll(new RegExp(`\\('${c}',\\s*'([a-z0-9-]+)',\\s*\\d+\\)`, "g"))].map((m) => m[1]));
  assert.deepEqual([...seeded].sort(), [...lessonIds].sort(), `schema.sql: course_lessons for '${c}' out of sync`);
  checked++;
  console.log(`ok - ${c}: ${course.lessons.length} lessons, ${minutes} min, schema in sync`);
}
if (checked === 0) console.log("skip - no courses in catalog (archived on corporate/courses-archive)");
