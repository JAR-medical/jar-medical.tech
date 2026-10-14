// Course "JAR Transcription Demo" — minimal voice capture & speaker diarization demo (DE + EN).
export default {
  id: "jar-transcription-demo",
  version: 1,
  section: "test",
  icon: "voice",
  title: {
    de: "JAR Transcription Demo",
    en: "JAR Transcription Demo",
  },
  subtitle: {
    de: "Sprachaufnahme und Sprecher-Diarisierung",
    en: "Voice capture and speaker diarization",
  },
  summary: {
    de: "Nehmen Sie ein Gespräch direkt über das Mikrofon auf, wählen Sie die Anzahl der Sprechenden und erhalten Sie das nach Sprechern getrennte Transkript.",
    en: "Record a conversation directly via microphone, select the number of speakers, and receive the speaker-diarized transcript.",
  },
  audience: {
    de: "Für Partnerorganisationen und Einsatzkräfte, die die Sprechertrennung von J.A.R. live testen möchten.",
    en: "For partner organisations and responders who want to test J.A.R.'s speaker separation live.",
  },
  minutes: 5,
  lessons: [
    {
      id: "live-transkription-diarisierung",
      title: {
        de: "Sprachaufnahme & Diarisierung",
        en: "Voice capture & diarization",
      },
      minutes: 5,
      blocks: [
        {
          type: "p",
          text: {
            de: "Wählen Sie die Anzahl der sprechenden Personen, starten Sie die Aufnahme und sprechen Sie in das Mikrofon. Transkription und Sprecher-Diarisierung laufen automatisch im Hintergrund.",
            en: "Select the number of people speaking, start the recording, and speak into the microphone. Transcription and speaker diarization run automatically in the background.",
          },
        },
        {
          type: "transcription-demo",
        },
      ],
    },
  ],
};
