// Course 3: "KI-Transkription & Sprecher-Diarisierung" (DE + EN)
// Live voice capture on the website -> Cloudflare Tunnel (configurable in
// js/config.js or directly in the widget, with seamless diarized preview while
// the tunnel is not set up yet) -> J.A.R. Transcription Model + Diarization
// Model -> speaker-separated transcript with timestamps and click-to-play audio.
export default {
  id: "jar-transcription-demo",
  version: 1,
  section: "test",
  icon: "voice",
  title: {
    de: "KI-Transkription & Sprecher-Diarisierung",
    en: "AI Transcription & Speaker Diarization",
  },
  subtitle: {
    de: "Sprachaufnahme, Cloudflare-Tunnel & Sprechertrennung",
    en: "Voice capture, Cloudflare Tunnel & speaker separation",
  },
  summary: {
    de: "Nehmen Sie Ihre Stimme direkt im Browser auf, verbinden Sie den Kurs über einen Cloudflare-Tunnel mit unserem Modell-Rechner (oder testen Sie sofort im integrierten Vorschau-Modus) und sehen Sie das nach Sprechern getrennte, zeitgestempelte Transkript unseres Transkriptions- und Diarisierungsmodells.",
    en: "Capture your voice directly in the browser, connect via Cloudflare Tunnel to our model computer (or test immediately in the built-in preview mode) and inspect the speaker-diarized, timestamped transcript produced by our transcription and diarization models.",
  },
  audience: {
    de: "Für Partnerorganisationen, Einsatzkräfte, Klinikteams und Entwickler, die unsere Spracherkennung und Sprecher-Diarisierung live über das eigene Mikrofon erproben möchten.",
    en: "For partner organisations, responders, clinical teams and developers who want to test our speech recognition and speaker diarization live with their own microphone.",
  },
  minutes: 12,
  lessons: [
    // ------------------------------------------------------------------ 1
    {
      id: "live-transkription-diarisierung",
      title: {
        de: "Live-Sprachaufnahme & Sprecher-Diarisierung",
        en: "Live voice capture & speaker diarization",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Hier testen Sie unsere Sprachpipeline direkt über Ihr Mikrofon: Der Browser zeichnet Ihre Stimme als **16-kHz-Mono-WAV** auf und sendet sie über einen **Cloudflare-Tunnel** an unseren Modell-PC, auf dem unser **J.A.R.-Transkriptionsmodell** und unser **Sprecher-Diarisierungsmodell** laufen. Das fertige Transkript erscheint unmittelbar darunter – farbig getrennt nach Sprechenden und mit sekundengenauen Zeitstempeln.",
            en: "Test our speech pipeline directly with your microphone: the browser records your voice as **16 kHz mono WAV** and sends it through a **Cloudflare Tunnel** to our model PC running our **J.A.R. transcription model** and **speaker diarization model**. The finished transcript appears right below – colour-coded by speaker with exact timestamps.",
          },
        },
        {
          type: "callout",
          tone: "info",
          text: {
            de: "**Auch ohne laufenden Cloudflare-Tunnel sofort testbar:** Solange der Cloudflare-Tunnel zum Modell-PC noch nicht eingerichtet ist, verarbeitet das Widget Ihre Mikrofonaufnahme im integrierten Diarisierungs-Vorschau-Modus, sodass Sie das nach Sprechern getrennte Transkript und die Audio-Wiedergabe je Sprecherwechsel sofort sehen und anhören können.",
            en: "**Testable even before the Cloudflare Tunnel is set up:** while the Cloudflare Tunnel to the model PC is not yet active, the widget processes your microphone recording in its built-in diarization preview mode so you can immediately see the speaker-separated transcript and play back each speaker turn.",
          },
        },
        {
          type: "transcription-demo",
        },
      ],
    },

    // ------------------------------------------------------------------ 2
    {
      id: "cloudflare-tunnel-und-modelle",
      title: {
        de: "Cloudflare-Tunnel & Unsere Modell-Pipeline",
        en: "Cloudflare Tunnel & our model pipeline",
      },
      minutes: 6,
      blocks: [
        {
          type: "p",
          text: {
            de: "Da **jar-medical.tech** als statische HTTPS-Website ausgeliefert wird, werden Sprachaufnahmen über einen verschlüsselten **Cloudflare-Tunnel** an unseren dedizierten Modell-PC weitergeleitet. Dort greifen fünf Verarbeitungsstufen ineinander, um aus dem gesprochenen Dialog am Patienten ein nach Sprechern getrenntes Transkript zu erzeugen:",
            en: "Because **jar-medical.tech** is served as a static HTTPS site, voice recordings are forwarded through an encrypted **Cloudflare Tunnel** to our dedicated model PC. Five processing stages work together there to turn a spoken bedside or field dialogue into a speaker-separated transcript:",
          },
        },
        {
          type: "transcription-pipeline-visual",
        },
        {
          type: "h",
          text: {
            de: "So richten Sie den Cloudflare-Tunnel auf dem Modell-PC ein",
            en: "How to set up the Cloudflare Tunnel on the model PC",
          },
        },
        {
          type: "steps",
          items: {
            de: [
              "**Lokalen Modell-Server starten:** Starten Sie auf Ihrem Modell-PC den FastAPI-/WhisperX-Diarisierungsdienst auf Port `8765` (Endpunkte `GET /api/info`, `POST /api/jobs` und `GET /api/jobs/{id}`).",
              "**Cloudflare-Tunnel öffnen:** Führen Sie auf demselben Rechner `cloudflared tunnel --url http://127.0.0.1:8765` (oder Ihren benannten Cloudflare-Tunnel) aus. Cloudflare gibt eine HTTPS-Adresse wie `https://ihr-name.trycloudflare.com` aus.",
              "**Tunnel-URL eintragen:** Fügen Sie diese HTTPS-Adresse entweder direkt oben im Kurs-Widget unter **„Cloudflare-Tunnel-URL konfigurieren“** ein oder hinterlegen Sie sie dauerhaft in `corporate/js/config.js` unter `TRANSCRIPTION_TUNNEL_URL`.",
            ],
            en: [
              "**Start local model server:** launch the FastAPI / WhisperX diarization server on port `8765` on your model PC (endpoints `GET /api/info`, `POST /api/jobs` and `GET /api/jobs/{id}`).",
              "**Open Cloudflare Tunnel:** run `cloudflared tunnel --url http://127.0.0.1:8765` (or your named Cloudflare Tunnel) on the same machine. Cloudflare outputs an HTTPS address such as `https://your-name.trycloudflare.com`.",
              "**Configure tunnel URL:** paste that HTTPS address either directly into the widget under **“Configure Cloudflare Tunnel URL”** or set it permanently in `corporate/js/config.js` under `TRANSCRIPTION_TUNNEL_URL`.",
            ],
          },
        },
        {
          type: "table",
          head: {
            de: ["Modell-Komponente", "Architektur / Verfahren", "Ergebnis im MANV-Benchmark & Einsatz"],
            en: ["Model component", "Architecture / Method", "Benchmark result & field role"],
          },
          rows: {
            de: [
              [
                "J.A.R. Transkriptionsmodell",
                "Feingetuntes CrisperWhisper & NVIDIA Parakeet-TDT 0.6B v3 (24 FastConformer-Schichten)",
                "Senkung der Wortfehlerrate (WER) auf 16,76 % gesamt und 6,04 % bei Medikamenten (2.020 MANV-Audioclips)",
              ],
              [
                "Wort-Alignment",
                "wav2vec2 Phonem-Alignment",
                "Millisekundengenaue Start- und Endzeitstempel für jedes einzelne Wort",
              ],
              [
                "J.A.R. Diarisierungsmodell",
                "pyannote speaker-diarization + WeSpeaker Satz-Voiceprints",
                "Trennt Sanitäter, Patient und Teampartner auch bei schnellen Wortwechseln satzgenau",
              ],
            ],
            en: [
              [
                "J.A.R. transcription model",
                "Fine-tuned CrisperWhisper & NVIDIA Parakeet-TDT 0.6B v3 (24 FastConformer layers)",
                "Word Error Rate (WER) reduced to 16.76 % overall and 6.04 % on medications (2,020 MCI audio clips)",
              ],
              [
                "Word alignment",
                "wav2vec2 phoneme alignment",
                "Millisecond-accurate start and end timestamps for every single word",
              ],
              [
                "J.A.R. diarization model",
                "pyannote speaker-diarization + WeSpeaker sentence voiceprints",
                "Cleanly separates paramedic, patient and partner even during rapid back-and-forth turns",
              ],
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "Wie gelangt die im Browser aufgenommene 16-kHz-Sprachaufnahme von der statischen Website sicher zum J.A.R.-Modell-PC?",
            en: "How does the 16 kHz voice recording captured in the browser travel securely from the static website to the J.A.R. model PC?",
          },
          options: [
            {
              de: "Über einen verschlüsselten HTTPS-Cloudflare-Tunnel an die Job-API (`/api/jobs`) des Modell-Rechners",
              en: "Over an encrypted HTTPS Cloudflare Tunnel to the model computer's job API (`/api/jobs`)",
            },
            {
              de: "Unverschlüsselt per E-Mail-Anhang",
              en: "Unencrypted as an e-mail attachment",
            },
            {
              de: "Über eine analoge Telefonleitung",
              en: "Over an analogue telephone line",
            },
          ],
          answer: 0,
          explain: {
            de: "Der Cloudflare-Tunnel stellt eine HTTPS-Verbindung zum lokalen Modell-PC her, ohne dass Ports im lokalen Netzwerk geöffnet werden müssen.",
            en: "The Cloudflare Tunnel provides an HTTPS endpoint to the local model PC without opening inbound firewall ports.",
          },
        },
        {
          q: {
            de: "Wie werden in unserer Pipeline mehrere sprechende Personen (z. B. Sanitäter und Patient) im aufgenommenen Audio getrennt?",
            en: "How does our pipeline separate multiple speakers (e.g. paramedic and patient) in the recorded audio?",
          },
          options: [
            {
              de: "Durch die Kombination aus wav2vec2-Wort-Alignment, pyannote-Diarisierung und satzweisem WeSpeaker-Stimmabdruck-Clustering",
              en: "By combining wav2vec2 word alignment, pyannote diarization and per-sentence WeSpeaker voiceprint clustering",
            },
            {
              de: "Nur anhand der Lautstärke des ersten Wortes",
              en: "Solely from the volume of the first word",
            },
            {
              de: "Jeder Sprecher muss ein eigenes Passwort vor jedem Satz nennen",
              en: "Each speaker has to say a password before every sentence",
            },
          ],
          answer: 0,
          explain: {
            de: "Erst das Zusammenspiel aus exakten Wort-Zeitstempeln (wav2vec2), Turn-Erkennung (pyannote) und Satz-Stimmabdrücken (WeSpeaker) trennt schnelle Dialoge zuverlässig.",
            en: "Combining exact word timestamps (wav2vec2), turn segmentation (pyannote) and sentence voiceprints (WeSpeaker) reliably separates rapid dialogue.",
          },
        },
      ],
    },
  ],
};
