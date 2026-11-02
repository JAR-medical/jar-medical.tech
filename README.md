# J.A.R. Medical website

The static site served at https://jar-medical.tech/ by GitHub Pages from the
`website` branch. It has no build step.

`/info/` introduces the project through photographs, with transcription as the
focus, early partner logos and live-demo links, and links to the sector pages.
German content works without JavaScript; English, mobile navigation and the
illustrative transcription examples are added by `info/info.js`. Photo sources
and licenses are retained in the page footer.

All information on setup, the backend and operations lives in the private
repository **`JAR-medical/website_setup`**. That covers the site overview, the
J.A.R. Corporate portal with Supabase and its security model, the transcription
server, the drone-model pipeline and the tooling notes.

This repository keeps only what the site needs to run, plus the tests that CI
runs on every push.
