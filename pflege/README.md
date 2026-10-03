# Pflege placeholder

GitHub Pages serves `index.html` at `/pflege/` (and redirects `/pflege` there).
The standalone German page follows the preview's navy/mint palette, typography,
rounded panels and pill buttons. It uses no JavaScript, external assets or forms.
Contact and legal links reuse the public site's existing destinations.

Preview from the repository root with `python3 -m http.server 8765`, then open
`http://localhost:8765/pflege/`. Validate site links with
`node --test tests/*.test.mjs`. Publish through the existing `website` branch.
