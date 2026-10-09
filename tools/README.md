# Public contribution page

The site and contribution page are public; there is no preview password.
Edit `mitmachen-aufnahme.html` directly. Its CSS and scripts are inlined.

The exception is the read-aloud corpus. `node tools/record-sentences.mjs` writes
`assets/corpus/mstart-4000-v1.js` (4,000 sentences, fixed seed, numbers written out,
Latin-1 only) and the first passage shown before the script runs. The page loads
that file before its recorder. Change the templates there, not the file, and bump
`CORPUS_NAME` in the generator and `CORPUS` in the page's script so new takes are
told apart from old ones.
The first 800 sentences come from the original bank and must not change: takes
already recorded refer to them by id (s001 to s800). The other 3,200 come from
`extensionTemplates`. Ids below s1000 keep three digits, higher ones are plain numbers.

Run `node --test tests/*.test.mjs` for the recorder consent/fallback checks and
site integrity checks. No microphone or recording is used by those tests.
`preview-crypt.mjs` is retained only as an unused historical editing utility;
no deployed page uses it.
