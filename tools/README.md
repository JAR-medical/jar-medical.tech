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

The recording page requires two active confirmations, including explicit consent
to automatic upload, then captures mono audio locally as 16 kHz PCM16 WAV.
Stopping the recording or reaching the 60-second limit uploads it automatically.
Only a confirmed storage acknowledgement enables Next, which selects a different
passage without starting the microphone. Interruptions (hidden tab, lost mic)
retain the local recording for an explicit retry rather than auto-uploading it.
No backend request occurs before a recording is stopped.

An optional, initially unchecked “medical professional / rescue worker” box
uses the existing API's `medic_context` session field. Alex PC stores selected
status as `metadata_json.medic=true` on clips, plus the boolean in each
`prompt_shown` audit event. It is not a required consent checkbox and is not
published. Once a session is created, the choice remains fixed for that visit
and is applied to every subsequent recording and retry.

Six fictional German passages are selected on page load. Session storage avoids
repeating the immediately previous text when storage is available. Re-recording
keeps the assigned passage. Text IDs are versioned: change the ID when changing
a passage. Each clip carries its ID and exact text.

The existing Alex PC API is
`https://elrsisbest.tailb58b58.ts.net`. No SpeakPipe or Benja host is used.
Auto-upload creates a consented contribution session, logs a `prompt_shown`
event for each passage with both confirmations, automatic-upload consent,
optional medical context, their timestamp, page version and passage, then uploads
to `/api/clips` using a pseudonymous token and a stable idempotency key.
The existing API stores WAV, text ID, expected text, consent version and session
data before asynchronous transcription. A receipt means stored, not transcribed.
No API key or contributor token belongs in Git.

Failed uploads retain the local recording and its idempotency key for retry or download; reloading loses
unsent audio. The withdrawal code is shown after session creation, even if the
upload fails. Contact the project team with this code to identify a contribution;
the existing backend supports `/api/contributors/withdraw-by-code`.

Run the recording regression tests with the private password in the environment.
Without it, encrypted-payload tests are skipped; encryption round-trip tests
still run. Device microphone verification is separate from mocked tests.
