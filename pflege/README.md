# Pflege placeholder

GitHub Pages serves `index.html` at `/pflege/` (and redirects `/pflege` there).
The standalone German page follows the unlocked preview's light canvas, navy/teal
headings, typography, pill buttons, navy transcription panel and dark lower band.
The documentation panel is a fictional concept illustration, not a working app.
It uses no JavaScript, third-party assets or forms. The logo and favicon reuse
the repository's brand assets. Contact uses the preview's public address; legal
links use the public site's existing pages.

Preview from the repository root with `python3 -m http.server 8765`, then open
`http://localhost:8765/pflege/`. Validate site links with
`node --test tests/*.test.mjs`. Publish through the existing `website` branch.
