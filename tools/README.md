# Public contribution page

The site and contribution page are public; there is no preview password.
Edit `mitmachen-aufnahme.html` directly. Its CSS and scripts are inlined.

The promoted preview uses a configured SpeakPipe widget. The visitor must click
the consent/load button before its iframe or loader is requested. The widget
handles microphone permission, playback and submission. Its provider and data
handling are described in `datenschutz.html`.

Run `node --test tests/*.test.mjs` for the recorder consent/fallback checks and
site integrity checks. No microphone or recording is used by those tests.
`preview-crypt.mjs` is retained only as an unused historical editing utility;
no deployed page uses it.
