# J.A.R. Medical website

GitHub Pages publishes the repository root from the `website` branch. The former
preview is now the public website at `https://jar-medical.tech/`, including its
four sector pages, contribution pages and legal pages. Pages inline their CSS
and JavaScript; `assets/` contains their images and app screen recording.
There is no build step or preview password.

The previous homepage, legal pages and their images are preserved at
`/website_old/`. Existing demo and game routes remain in place. The old
`/website-preview/*.html` URLs redirect to their public equivalents and retain
query parameters and fragments. English legal URL aliases redirect to the new
legal pages. The AR-client link uses the existing `/demo/paramedic/` route.

Run `python3 -m http.server 8765` for a local preview, `node --test tests/*.test.mjs`
for unit/link/script checks, and `npm install && npx playwright test` for browser
checks. Homepage tests for the previous design now exercise `/website_old/`.

The recording page (`mitmachen-aufnahme.html`) records in the browser: the
record button sits at the top, a randomly generated mSTaRT radio call is shown
under it, and each take is encoded as a 16 kHz mono PCM16 WAV whose RIFF INFO
chunk carries the exact text read (INAM, Latin-1) and its provenance as
ASCII-escaped JSON (ICMT). Takes upload to the MediCraft contribution API on
Alex PC (`data-api`), which only accepts the `https://jar-medical.tech` origin,
so local previews record but cannot upload. Nothing is sent before the consent
box is ticked and a take is stopped. Bump a template's `v` when its wording
changes; `tests/recording.test.mjs` exercises the shipped script.
