# Encrypted preview recording page

The preview remains password-protected. Never commit its password or decrypted
HTML, which includes the inlined styles and scripts. Set
`JAR_PREVIEW_PASSWORD` privately in your environment, then use:

```sh
node tools/preview-crypt.mjs decrypt website-preview/mitmachen-aufnahme.html /private/tmp/recording-source.html
# Edit the private source.
node tools/preview-crypt.mjs encrypt website-preview/mitmachen-aufnahme.html /private/tmp/recording-source.html
node --test tests/*.test.mjs
```

The recording page requires two active confirmations, then captures mono audio
locally as 16 kHz PCM16 WAV. Maximum recording length is 60 seconds. Users can
listen, re-record or download; no backend request occurs before Send.

Six fictional German passages are selected on page load. Session storage avoids
repeating the immediately previous text when storage is available. Re-recording
keeps the assigned passage. Text IDs are versioned: change the ID when changing
a passage. Each clip carries its ID and exact text.

The existing Alex PC API is
`https://elrsisbest.tailb58b58.ts.net`. No SpeakPipe or Benja host is used.
Send creates a consented contribution session, logs a `prompt_shown` event with
both confirmations, their timestamp, page version and passage, then uploads
to `/api/clips` using a pseudonymous token and a stable idempotency key.
The existing API stores WAV, text ID, expected text, consent version and session
data before asynchronous transcription. A receipt means stored, not transcribed.
No API key or contributor token belongs in Git.

Failed uploads retain the local recording for retry or download; reloading loses
unsent audio. The withdrawal code is shown after session creation, even if the
upload fails. Contact the project team with this code to identify a contribution;
the existing backend supports `/api/contributors/withdraw-by-code`.

Run the recording regression tests with the private password in the environment.
Without it, encrypted-payload tests are skipped; encryption round-trip tests
still run. Device microphone verification is separate from mocked tests.
