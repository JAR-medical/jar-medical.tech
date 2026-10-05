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

The contribution page retains the preview's SpeakPipe consent gate: opening it
does not load the external recorder until the visitor clicks its load button.
Removing the site password does not remove microphone or contribution consent.
