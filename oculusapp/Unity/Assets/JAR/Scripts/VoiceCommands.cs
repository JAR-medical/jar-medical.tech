// Voice command parsing — C# port of parseCommand() in js/voice.js.
//
// Engine-agnostic on purpose: it turns any German utterance (or typed string)
// into a structured command. Feed it from Meta Voice SDK dictation, a native
// SpeechRecognizer, or a debug text field — JARApp.OnTranscript() calls Parse().
//
// Grammar (case-insensitive, substring-tolerant):
//   "zusammenfassung"|"status"|"patient"|"vorlesen"        -> Summary
//   "vitalwerte"|"vitals"|"werte"                          -> Vitals
//   "rot"|"gelb"|"grün"|"blau"|"schwarz"|"verstorben"      -> Category(value)
//   "maßnahme <x>"|"behandlung <x>"                        -> Treatment(value)
//   "befund <x>"|"verletzung <x>"|"diagnose <x>"           -> Injury(value)
//   "notiz <x>"|"protokoll <x>"|"vermerk <x>"              -> Note(value)
//   "nächster"|"weiter"|"scannen"                          -> Rescan
//   "schließen"|"zurück"|"beenden"                         -> Close
//   "hilfe"|"kommandos"                                    -> Help

using System.Text.RegularExpressions;

namespace JAR
{
    public enum CommandType { None, Summary, Vitals, Category, Treatment, Injury, Note, Rescan, Close, Help }

    public struct VoiceCommand
    {
        public CommandType type;
        public string value;      // free text for Treatment/Injury/Note
        public Triage category;   // for Category
        public static VoiceCommand Of(CommandType t) => new VoiceCommand { type = t };
    }

    public static class VoiceCommands
    {
        static readonly (Regex re, Triage cat)[] Colours =
        {
            // deceased checked before colours so "schwarz" wins over any colour word
            (new Regex(@"\b(schwarz|verstorben|tot|exitus)\b"), Triage.DECEASED),
            (new Regex(@"\b(rot|rote|roter)\b"), Triage.SK1),
            (new Regex(@"\b(gelb|gelbe|gelber)\b"), Triage.SK2),
            (new Regex(@"\b(gr[üu]n|gr[üu]ne|gr[üu]ner)\b"), Triage.SK3),
            (new Regex(@"\b(blau|blaue|blauer)\b"), Triage.SK4),
        };

        static readonly string[] TreatmentKw = { "maßnahme", "massnahme", "behandlung", "therapie", "gegeben", "durchgeführt", "durchgefuehrt" };
        static readonly string[] InjuryKw = { "befund", "verletzung", "diagnose", "trauma" };
        static readonly string[] NoteKw = { "notiz", "protokoll", "vermerk", "anmerkung" };

        public static VoiceCommand Parse(string raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return VoiceCommand.Of(CommandType.None);
            string t = Regex.Replace(raw.ToLowerInvariant().Trim(), @"\s+", " ");

            if (Regex.IsMatch(t, @"\b(hilfe|kommandos|befehle)\b")) return VoiceCommand.Of(CommandType.Help);
            if (Regex.IsMatch(t, @"\b(n[äa]chster|weiter|scannen|scan|neuer marker|neu scannen)\b")) return VoiceCommand.Of(CommandType.Rescan);
            if (Regex.IsMatch(t, @"\b(schlie[ßs]en|zur[üu]ck|beenden|abbrechen|fertig)\b")) return VoiceCommand.Of(CommandType.Close);

            // Argument-taking commands BEFORE the generic "patient" summary trigger,
            // because a dictated value may itself contain "Patient".
            var tr = Tail(t, TreatmentKw); if (tr != null) return Val(CommandType.Treatment, tr);
            var inj = Tail(t, InjuryKw); if (inj != null) return Val(CommandType.Injury, inj);
            var note = Tail(t, NoteKw); if (note != null) return Val(CommandType.Note, note);

            if (Regex.IsMatch(t, @"\b(vitalwerte|vitals|werte|vitalzeichen)\b")) return VoiceCommand.Of(CommandType.Vitals);
            if (Regex.IsMatch(t, @"\b(zusammenfassung|vorlesen|status|patient|übersicht|uebersicht)\b")) return VoiceCommand.Of(CommandType.Summary);

            foreach (var (re, cat) in Colours)
                if (re.IsMatch(t)) return new VoiceCommand { type = CommandType.Category, category = cat };

            return VoiceCommand.Of(CommandType.None);
        }

        static string Tail(string t, string[] keywords)
        {
            foreach (var kw in keywords)
            {
                int i = t.IndexOf(kw, System.StringComparison.Ordinal);
                if (i >= 0)
                {
                    string tail = t.Substring(i + kw.Length).Trim();
                    if (tail.Length > 0) return Cap(tail);
                }
            }
            return null;
        }

        static VoiceCommand Val(CommandType type, string value) => new VoiceCommand { type = type, value = value };
        static string Cap(string s) => s.Length == 0 ? s : char.ToUpperInvariant(s[0]) + s.Substring(1);
    }
}
