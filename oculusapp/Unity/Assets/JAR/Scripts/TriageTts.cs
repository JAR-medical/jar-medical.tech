// "The glasses talk back" — text-to-speech via Android's native TextToSpeech.
//
// On the Quest (an Android device) this speaks German through the headset
// speakers, offline, with no API key — PROVIDED a TTS engine is installed on the
// device. Stock Quest OS may not ship one; if speech is silent, install a TTS
// engine or rely on the on-screen HUD, which is always the guaranteed channel.
// In the Editor it just logs, so you can develop without a device.
//
// Spoken-summary text mirrors js/hud.js spokenSummary()/spokenVitals().

using System.Text;
using UnityEngine;

namespace JAR
{
    public class TriageTts
    {
#if UNITY_ANDROID && !UNITY_EDITOR
        AndroidJavaObject _tts;
        bool _ready;

        public TriageTts()
        {
            try
            {
                using var player = new AndroidJavaClass("com.unity3d.player.UnityPlayer");
                var activity = player.GetStatic<AndroidJavaObject>("currentActivity");
                _tts = new AndroidJavaObject("android.speech.tts.TextToSpeech", activity, new InitListener(this));
            }
            catch (System.Exception e) { Debug.LogWarning("[JAR] TTS init failed: " + e.Message); }
        }

        class InitListener : AndroidJavaProxy
        {
            readonly TriageTts _o;
            public InitListener(TriageTts o) : base("android.speech.tts.TextToSpeech$OnInitListener") { _o = o; }
            // SUCCESS == 0
            void onInit(int status)
            {
                if (status != 0) { Debug.LogWarning("[JAR] No TTS engine (status " + status + ")."); return; }
                _o._ready = true;
                try
                {
                    using var locale = new AndroidJavaObject("java.util.Locale", "de", "DE");
                    _o._tts.Call<int>("setLanguage", locale);
                }
                catch (System.Exception e) { Debug.LogWarning("[JAR] setLanguage: " + e.Message); }
            }
        }

        public void Speak(string text)
        {
            if (_tts == null || !_ready || string.IsNullOrEmpty(text)) return;
            // speak(CharSequence, QUEUE_FLUSH=0, Bundle=null, utteranceId)
            _tts.Call<int>("speak", text, 0, null, "jar");
        }

        public void Stop() { try { _tts?.Call<int>("stop"); } catch { } }
#else
        public TriageTts() { }
        public void Speak(string text) { Debug.Log("[JAR TTS] " + text); }
        public void Stop() { }
#endif

        // ---- spoken-text builders (mirror js/hud.js) ----

        public static string Summary(Patient p)
        {
            var sb = new StringBuilder();
            sb.Append($"Patient {p.markerId}, Sichtungskategorie {TriageMeta.Spoken(p.category)}. ");
            string person = Person(p);
            if (person.Length > 0) sb.Append(person + ". ");
            if (p.conscious == false) sb.Append("Nicht ansprechbar. ");
            else if (p.conscious == true) sb.Append("Ansprechbar. ");
            var v = p.vitals;
            if (v.Any)
            {
                var parts = new System.Collections.Generic.List<string>();
                if (v.pulse != null) parts.Add($"Puls {v.pulse}");
                if (v.spo2 != null) parts.Add($"Sauerstoffsättigung {v.spo2} Prozent");
                if (v.breathingRate != null) parts.Add($"Atemfrequenz {v.breathingRate}");
                if (v.gcs != null) parts.Add($"G C S {v.gcs}");
                if (parts.Count > 0) sb.Append(string.Join(", ", parts) + ". ");
            }
            if (p.injuries.Count > 0) sb.Append("Befunde: " + string.Join(", ", p.injuries) + ". ");
            if (p.treatments.Count > 0) sb.Append("Maßnahmen: " + string.Join(", ", p.treatments) + ". ");
            return sb.ToString().Trim();
        }

        public static string VitalsText(Patient p)
        {
            var v = p.vitals;
            if (!v.Any) return $"Für Patient {p.markerId} sind keine Vitalwerte hinterlegt.";
            var parts = new System.Collections.Generic.List<string>();
            if (v.breathingRate != null) parts.Add($"Atemfrequenz {v.breathingRate}");
            if (v.pulse != null) parts.Add($"Puls {v.pulse}");
            if (v.spo2 != null) parts.Add($"Sauerstoffsättigung {v.spo2} Prozent");
            if (v.bpSystolic != null) parts.Add($"Blutdruck {v.bpSystolic}{(v.bpDiastolic != null ? " zu " + v.bpDiastolic : "")}");
            if (v.gcs != null) parts.Add($"G C S {v.gcs}");
            return $"Patient {p.markerId}. " + string.Join(", ", parts) + ".";
        }

        static string Person(Patient p)
        {
            var bits = new System.Collections.Generic.List<string>();
            if (p.sex == "m") bits.Add("männlich"); else if (p.sex == "w") bits.Add("weiblich");
            if (p.ageEstimate != null) bits.Add($"etwa {p.ageEstimate} Jahre");
            return string.Join(", ", bits);
        }
    }
}
