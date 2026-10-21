// Demo course B1: record your own triage dialogue and see how the J.A.R.
// transcription server returns it, split by speaker.
// Seeded in supabase/schema.sql as 'demo-transkription' / 'aufnahme-diarisierung'.

export default {
  id: "demo-transkription",
  version: 1,
  section: "test",
  icon: "voice",
  title: {
    de: "Demo: Transkription mit Sprecher-Diarisierung",
    en: "Demo: transcription with speaker diarization",
  },
  subtitle: {
    de: "Sichtungsdialog aufnehmen, Sprecher getrennt sehen",
    en: "Record a triage dialogue, see speakers separated",
  },
  summary: {
    de: "Nehmen Sie im Browser einen kurzen mSTART-Sichtungsdialog auf. Die Demo zeigt, wie WhisperX und pyannote daraus ein Transkript mit Zeitstempeln und Sprecherspuren machen – damit nur Befunde der Einsatzkraft in die Patientenakte gelangen.",
    en: "Record a short mSTART triage dialogue in your browser. The demo shows how WhisperX and pyannote turn it into a transcript with timestamps and speaker tracks – so that only the responder's findings reach the patient record.",
  },
  audience: {
    de: "Ärztliche Leitungen Rettungsdienst, Einsatzleitungen, Forschungspartner",
    en: "EMS medical directors, incident commanders, research partners",
  },
  minutes: 6,
  lessons: [
    {
      id: "aufnahme-diarisierung",
      title: {
        de: "Aufnahme und Diarisierung ausprobieren",
        en: "Try recording and diarization",
      },
      minutes: 6,
      blocks: [
        { type: "recorder-demo" },
      ],
    },
  ],
};
