# J.A.R. Medical website

The static site served at https://jar-medical.tech/ by GitHub Pages from the
`website` branch. It has no build step.

`/sz` (also `/sz/`) redirects to the Süddeutsche Zeitung article about the
project, preserving the article's `?reduced=true` parameter. A meta refresh
and clickable article link provide fallbacks when JavaScript is disabled.

`/info/` introduces the project through photographs, with transcription as the
focus, early partner logos and live-demo links, and links to the sector pages.
German content works without JavaScript; English, mobile navigation and the
illustrative transcription examples are added by `info/info.js`. Photo sources
and licenses are retained in the page footer.
The info page uses the same-origin Cloudflare country response to default
German visitors to German, with browser language as the offline fallback.
An explicit language selection is remembered and takes precedence.

A shared voting banner runs on the main public pages through 9 November 2026
(Europe/Berlin), linking to the BWKI audience award. `assets/vote-banner.js`
removes the notice and its layout space at midnight on 10 November, including
in tabs left open. Archived pages and the fullscreen demo clients stay separate.

The demo retries each failed or stalled map tile once. If the map remains
incomplete, it switches to the included local road network and reports the
change in the event log. Select an OpenStreetMap base layer to reconnect.

All information on setup, the backend and operations lives in the private
repository **`JAR-medical/website_setup`**. That covers the site overview, the
J.A.R. Corporate portal with Supabase and its security model, the transcription
server, the drone-model pipeline and the tooling notes.

This repository keeps only what the site needs to run, plus the tests that CI
runs on every push.
