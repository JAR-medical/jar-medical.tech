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
        { type: "recorder-architecture" },
        {
          type: "p",
          text: {
            de: "An einer Patientenablage sprechen Einsatzkraft, Patient und Teamleitung durcheinander. Die **Diarisierung** ordnet jedes Segment einer Sprecherspur mit Start- und Endzeit zu. Nur Aussagen aus der Spur der Einsatzkraft dürfen Vitalwerte oder die Sichtungskategorie (SK I–IV) setzen.",
            en: "At a casualty collection point, responder, patient and team lead talk over each other. **Diarization** assigns every segment to a speaker track with start and end time. Only statements from the responder's track may set vitals or the triage category (T1–T4).",
          },
        },
        { type: "recorder-demo" },
        {
          type: "list",
          items: {
            de: [
              "Lesen Sie den Dialog zu zweit vor, damit zwei Stimmen entstehen.",
              "Maximal 60 Sekunden; die Aufnahme können Sie vor dem Senden anhören.",
              "Ohne verbundenen Server wird nichts gesendet; die Beispielausgabe zeigt das Format.",
            ],
            en: [
              "Read the dialogue with two people so that there are two voices.",
              "60 seconds at most; you can listen to the take before sending it.",
              "Without a connected server nothing is sent; the example output shows the format.",
            ],
          },
        },
      ],
      quiz: [
        {
          q: {
            de: "In der Beispielausgabe sagt Sprecher 2 „Mein linkes Bein tut weh“. Was darf daraus in die Patientenakte?",
            en: "In the example output, Speaker 2 says “My left leg hurts”. What may enter the patient record from this?",
          },
          options: [
            { de: "Kein Befund – Befunde kommen nur aus der Spur der Einsatzkraft (Sprecher 1).", en: "No finding – findings only come from the responder's track (Speaker 1)." },
            { de: "Eine Beinfraktur als gesicherter Befund.", en: "A leg fracture as a confirmed finding." },
            { de: "Die Sichtungskategorie SK I, weil der Patient Schmerzen äußert.", en: "Triage category T1, because the patient reports pain." },
          ],
          answer: 0,
          explain: {
            de: "Diarisierung trennt die Spuren. Aussagen von Patienten oder Umstehenden sind Kontext; Vitalwerte und Kategorie übernimmt das System nur aus der Spur der Einsatzkraft.",
            en: "Diarization separates the tracks. Statements by patients or bystanders are context; the system only takes vitals and category from the responder's track.",
          },
        },
        {
          q: {
            de: "Im Diagramm: Wann verlässt Ihre Aufnahme den Browser?",
            en: "In the diagram: when does your recording leave the browser?",
          },
          options: [
            { de: "Sofort beim Aufnehmen, als Live-Stream.", en: "Immediately while recording, as a live stream." },
            { de: "Nur wenn Sie „Transkribieren“ tippen und ein Server verbunden ist – dann als ein POST /transcribe durch den Cloudflare Tunnel.", en: "Only when you tap “Transcribe” and a server is connected – then as one POST /transcribe through the Cloudflare Tunnel." },
            { de: "Beim Abspielen der Aufnahme.", en: "When you play the take back." },
          ],
          answer: 1,
          explain: {
            de: "Die Aufnahme bleibt lokal. Erst „Transkribieren“ sendet sie als multipart/form-data (audio, language); zurück kommt JSON mit start, end, speaker und text je Segment.",
            en: "The take stays local. Only “Transcribe” sends it as multipart/form-data (audio, language); JSON with start, end, speaker and text per segment comes back.",
          },
        },
      ],
    },
  ],
};
