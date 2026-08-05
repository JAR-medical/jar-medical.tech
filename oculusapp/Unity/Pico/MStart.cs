// mSTaRT — the pre-triage (Vorsichtung) decision tree, as data.
//
// mSTaRT = modifiziertes "Simple Triage and Rapid Treatment", the algorithm the
// Munich fire brigade / LMU published in 2006 (Kanz et al., Notfall+Rettungsmedizin)
// and the one the scenario in this project references ("Sichtung nach mSTaRT").
// It classifies a casualty within seconds using six yes/no checks.
//
// ⚠️ ÜBUNGSZWECK — this is a training/demo aid for a student project, not a
// medically released device. The category it produces is a suggestion; the
// Sichtung stays the responsibility of the person wearing the glasses.
//
// Order implemented here:
//   1. kritische Blutung?   ja → Blutstillung, SK I
//   2. gehfähig?            ja → SK III
//   3. Atmung vorhanden?    nein → Atemwege freimachen → 3a
//      3a. Atmung jetzt?    ja → SK I | nein → tot (SK V)
//   4. AF < 10 oder > 30?   ja → SK I
//   5. Radialispuls / Rekap ≤ 2 s?  nein → SK I
//   6. befolgt Aufforderungen?      nein → SK I | ja → SK II
//
// Note on step 1: published versions differ on whether the critical-bleeding
// check sits before or after the walking test. It is first here because
// "Blutstillung hat Vorrang" — a walking casualty with a spurting bleed is a
// vital threat, and checking it first cannot under-triage anyone. The whole
// tree lives in Nodes() below, so reordering is a one-place edit.
//
// SK IV (blau, abwartende Behandlung) is deliberately NOT produced: it is a
// physician's (LNA) decision, not part of pre-triage. JARApp offers it as an
// explicit, separately labelled override on the result screen.

using System.Collections.Generic;

namespace JAR
{
    public enum MStartStep
    {
        Blutung,
        Gehfaehig,
        Atmung,
        AtmungNachFreimachen,
        Atemfrequenz,
        Kreislauf,
        Bewusstsein,
    }

    /// What answering yes/no at a step leads to: either the next step, or a
    /// final category. `measure` is a Sofortmaßnahme to document.
    public readonly struct MStartOutcome
    {
        public readonly MStartStep? Next;
        public readonly Triage? Category;
        public readonly string Measure;
        public readonly string Rationale;

        MStartOutcome(MStartStep? next, Triage? category, string measure, string rationale)
        {
            Next = next; Category = category; Measure = measure; Rationale = rationale;
        }

        public static MStartOutcome Goto(MStartStep next, string rationale, string measure = null)
            => new MStartOutcome(next, null, measure, rationale);

        public static MStartOutcome Result(Triage category, string rationale, string measure = null)
            => new MStartOutcome(null, category, measure, rationale);
    }

    public sealed class MStartNode
    {
        public MStartStep Step;
        public string Question;
        public string Hint;
        public MStartOutcome Yes;
        public MStartOutcome No;
    }

    public sealed class MStartAnswer
    {
        public MStartStep Step;
        public bool Yes;
        public string Line;          // "Gehfähig: nein" — for the protocol trail
    }

    public sealed class MStartResult
    {
        public Triage Category;
        public string Rationale;
        public readonly List<string> Measures = new List<string>();
        public readonly List<string> Trail = new List<string>();
    }

    public static class MStart
    {
        /// Longest possible path through the tree — used for "Schritt n von m".
        public const int MaxSteps = 6;

        public const string Disclaimer =
            "mSTaRT-Vorsichtung · Übungszweck · Einschätzung bleibt beim Anwender";

        static readonly Dictionary<MStartStep, MStartNode> _nodes = Build();

        public static MStartNode Node(MStartStep step) => _nodes[step];

        public static MStartStep First => MStartStep.Blutung;

        static Dictionary<MStartStep, MStartNode> Build()
        {
            var nodes = new List<MStartNode>
            {
                new MStartNode
                {
                    Step = MStartStep.Blutung,
                    Question = "Kritische Blutung?",
                    Hint = "Spritzende oder stark sickernde Blutung — Blutstillung hat Vorrang.",
                    Yes = MStartOutcome.Result(Triage.SK1,
                        "Kritische Blutung — sofortige Blutstillung, SK I",
                        "Blutstillung: Tourniquet / Druckverband"),
                    No = MStartOutcome.Goto(MStartStep.Gehfaehig, "Keine kritische Blutung"),
                },
                new MStartNode
                {
                    Step = MStartStep.Gehfaehig,
                    Question = "Gehfähig?",
                    Hint = "Kann der Patient auf Aufforderung selbstständig gehen?",
                    Yes = MStartOutcome.Result(Triage.SK3,
                        "Gehfähig — SK III, Verweis zur Sammelstelle"),
                    No = MStartOutcome.Goto(MStartStep.Atmung, "Nicht gehfähig"),
                },
                new MStartNode
                {
                    Step = MStartStep.Atmung,
                    Question = "Atmung vorhanden?",
                    Hint = "Sehen, hören, fühlen — höchstens 10 Sekunden.",
                    Yes = MStartOutcome.Goto(MStartStep.Atemfrequenz, "Atmung vorhanden"),
                    No = MStartOutcome.Goto(MStartStep.AtmungNachFreimachen,
                        "Keine Atmung — Atemwege freimachen",
                        "Atemwege freimachen (Esmarch-Handgriff)"),
                },
                new MStartNode
                {
                    Step = MStartStep.AtmungNachFreimachen,
                    Question = "Atmung nach Freimachen?",
                    Hint = "Nach dem Freimachen der Atemwege erneut prüfen.",
                    Yes = MStartOutcome.Result(Triage.SK1,
                        "Atmung erst nach Freimachen — SK I",
                        "Atemwege offen halten / stabile Seitenlage"),
                    No = MStartOutcome.Result(Triage.DECEASED,
                        "Keine Atmung nach Freimachen — verstorben (SK V)"),
                },
                new MStartNode
                {
                    Step = MStartStep.Atemfrequenz,
                    Question = "Atemfrequenz < 10 oder > 30 /min?",
                    Hint = "Grob abschätzen — nicht auszählen.",
                    Yes = MStartOutcome.Result(Triage.SK1,
                        "Atemfrequenz außerhalb 10–30/min — SK I"),
                    No = MStartOutcome.Goto(MStartStep.Kreislauf, "Atemfrequenz 10–30/min"),
                },
                new MStartNode
                {
                    Step = MStartStep.Kreislauf,
                    Question = "Radialispuls tastbar?",
                    Hint = "Ersatzweise Rekapillarisierungszeit ≤ 2 Sekunden.",
                    Yes = MStartOutcome.Goto(MStartStep.Bewusstsein, "Radialispuls tastbar"),
                    No = MStartOutcome.Result(Triage.SK1,
                        "Radialispuls nicht tastbar — SK I"),
                },
                new MStartNode
                {
                    Step = MStartStep.Bewusstsein,
                    Question = "Befolgt einfache Aufforderungen?",
                    Hint = "„Drücken Sie meine Hand“ — reagiert der Patient sinnvoll?",
                    Yes = MStartOutcome.Result(Triage.SK2,
                        "Aufforderungen werden befolgt — SK II"),
                    No = MStartOutcome.Result(Triage.SK1,
                        "Aufforderungen werden nicht befolgt — SK I"),
                },
            };

            var map = new Dictionary<MStartStep, MStartNode>(nodes.Count);
            foreach (var n in nodes) map[n.Step] = n;
            return map;
        }
    }

    /// One run through the algorithm for one patient. Supports stepping back,
    /// so a mis-tap on the glasses is recoverable.
    public sealed class MStartSession
    {
        readonly List<MStartAnswer> _answers = new List<MStartAnswer>();
        readonly List<string> _measures = new List<string>();

        public MStartStep Current { get; private set; } = MStart.First;
        public MStartResult Result { get; private set; }
        public bool Done => Result != null;
        public IReadOnlyList<MStartAnswer> Answers => _answers;

        /// 1-based position of the question on screen.
        public int StepNumber => _answers.Count + 1;

        public MStartNode Node => MStart.Node(Current);

        public void Reset()
        {
            _answers.Clear();
            _measures.Clear();
            Current = MStart.First;
            Result = null;
        }

        /// Answer the current question. No-op once a result has been reached.
        public void Answer(bool yes)
        {
            if (Done) return;

            var node = MStart.Node(Current);
            var outcome = yes ? node.Yes : node.No;

            _answers.Add(new MStartAnswer
            {
                Step = node.Step,
                Yes = yes,
                Line = $"{node.Question} {(yes ? "ja" : "nein")}",
            });

            if (!string.IsNullOrEmpty(outcome.Measure) && !_measures.Contains(outcome.Measure))
                _measures.Add(outcome.Measure);

            if (outcome.Category.HasValue)
            {
                var r = new MStartResult
                {
                    Category = outcome.Category.Value,
                    Rationale = outcome.Rationale,
                };
                r.Measures.AddRange(_measures);
                foreach (var a in _answers) r.Trail.Add(a.Line);
                Result = r;
                return;
            }

            // Goto without a target would strand the session — treat as a bug.
            Current = outcome.Next ?? Current;
        }

        /// Undo the last answer. Returns false if there is nothing to undo.
        public bool Back()
        {
            if (_answers.Count == 0) return false;

            var last = _answers[_answers.Count - 1];
            _answers.RemoveAt(_answers.Count - 1);
            Result = null;
            Current = last.Step;

            // Rebuild the measure list from the remaining answers so a step back
            // also drops the Sofortmaßnahme that step had added.
            _measures.Clear();
            var step = MStart.First;
            foreach (var a in _answers)
            {
                var node = MStart.Node(step);
                var outcome = a.Yes ? node.Yes : node.No;
                if (!string.IsNullOrEmpty(outcome.Measure) && !_measures.Contains(outcome.Measure))
                    _measures.Add(outcome.Measure);
                if (!outcome.Next.HasValue) break;
                step = outcome.Next.Value;
            }
            return true;
        }
    }
}
