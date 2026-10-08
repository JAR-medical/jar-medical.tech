# Public contribution page

The site and contribution page are public; there is no preview password.
Edit `mitmachen-aufnahme.html` directly. Its CSS and scripts are inlined.

The exception is the read-aloud corpus between `/* sentences:begin */` and
`/* sentences:end */`: `node tools/record-sentences.mjs` regenerates those 800
sentences (fixed seed, numbers written out, Latin-1 only) and the first passage
shown before the script runs. Change the templates there, not the page, and
bump `CORPUS` in the page's script so new takes are told apart from old ones.

Run `node --test tests/*.test.mjs` for the recorder consent/fallback checks and
site integrity checks. No microphone or recording is used by those tests.
`preview-crypt.mjs` is retained only as an unused historical editing utility;
no deployed page uses it.
