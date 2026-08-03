// The patient HUD panel, built procedurally (no prefab / Editor wiring needed).
//
// A world-space uGUI card: a triage-coloured bar plus one rich-text block with
// category, vitals, flags, injuries/treatments, meta and protocol — the same
// information architecture as js/hud.js, laid out for a head-worn display.
// Uses legacy UnityEngine.UI.Text (built-in font) so there is no TextMeshPro
// import step. Glyphs are kept to the built-in font's coverage (e.g. "SpO2").

using System.Collections.Generic;
using System.Text;
using UnityEngine;
using UnityEngine.UI;

namespace JAR
{
    public class PatientPanel : MonoBehaviour
    {
        Image _bar;
        Text _content;
        static Font _font;

        public static PatientPanel Build(Transform parent)
        {
            _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");

            var go = new GameObject("PatientPanel", typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(820, 560);
            rt.anchoredPosition = Vector2.zero;
            var panel = go.GetComponent<Image>();
            panel.color = new Color(0.06f, 0.08f, 0.10f, 0.86f);

            var self = go.AddComponent<PatientPanel>();

            // triage colour bar on the left edge
            var barGo = new GameObject("Bar", typeof(RectTransform), typeof(Image));
            barGo.transform.SetParent(go.transform, false);
            var brt = (RectTransform)barGo.transform;
            brt.anchorMin = new Vector2(0, 0); brt.anchorMax = new Vector2(0, 1);
            brt.pivot = new Vector2(0, 0.5f);
            brt.sizeDelta = new Vector2(14, 0);
            brt.anchoredPosition = Vector2.zero;
            self._bar = barGo.GetComponent<Image>();

            // content text
            var txtGo = new GameObject("Content", typeof(RectTransform), typeof(Text));
            txtGo.transform.SetParent(go.transform, false);
            var trt = (RectTransform)txtGo.transform;
            trt.anchorMin = Vector2.zero; trt.anchorMax = Vector2.one;
            trt.offsetMin = new Vector2(34, 24); trt.offsetMax = new Vector2(-24, -20);
            var txt = txtGo.GetComponent<Text>();
            txt.font = _font;
            txt.fontSize = 26;
            txt.color = new Color(0.91f, 0.93f, 0.95f);
            txt.alignment = TextAnchor.UpperLeft;
            txt.horizontalOverflow = HorizontalWrapMode.Wrap;
            txt.verticalOverflow = VerticalWrapMode.Overflow;
            txt.supportRichText = true;
            self._content = txt;

            return self;
        }

        public void RenderScanning(string hint)
        {
            _bar.color = TriageMeta.Color(Triage.UNSIGHTED);
            _content.text =
                "<size=40><b>Bereit</b></size>\n\n" +
                "Patient identifizieren:\n" + hint;
        }

        public void RenderUnknown(int markerId)
        {
            _bar.color = TriageMeta.Color(Triage.UNSIGHTED);
            _content.text =
                $"<size=40><b>UNBEKANNT</b></size>   <size=24>Marker #{markerId}</size>\n\n" +
                "Kein Patient zu diesem Marker im aktuellen Einsatz.";
        }

        public void Render(Patient p)
        {
            _bar.color = TriageMeta.Color(p.category);
            _content.text = BuildText(p);
        }

        static string Hex(Color c) => "#" + ColorUtility.ToHtmlStringRGB(c);

        static string BuildText(Patient p)
        {
            var col = Hex(TriageMeta.Color(p.category));
            var sb = new StringBuilder();

            sb.Append($"<size=44><color={col}><b>{TriageMeta.Short(p.category)}</b></color></size>");
            sb.Append($"   <size=26><color=#93a1ad>Patient #{p.markerId}</color></size>\n\n");

            sb.Append($"<b>Ansprechbar</b> {Tri(p.conscious)}    <b>Atemweg frei</b> {Tri(p.airwayClear)}\n\n");

            var v = p.vitals;
            var vit = new List<string>();
            if (v.breathingRate != null) vit.Add($"AF <b>{v.breathingRate}</b>");
            if (v.pulse != null) vit.Add($"Puls <b>{v.pulse}</b>");
            if (v.spo2 != null) vit.Add($"SpO2 <b>{v.spo2}%</b>");
            if (v.bpSystolic != null) vit.Add($"RR <b>{v.bpSystolic}{(v.bpDiastolic != null ? "/" + v.bpDiastolic : "")}</b>");
            if (v.gcs != null) vit.Add($"GCS <b>{v.gcs}</b>");
            sb.Append("<size=30>" + (vit.Count > 0 ? string.Join("    ", vit) : "<color=#93a1ad>keine Vitalwerte</color>") + "</size>\n\n");

            if (p.injuries.Count > 0)
                sb.Append($"<color=#f0d9a6>Befunde:</color> {string.Join(", ", p.injuries)}\n");
            if (p.treatments.Count > 0)
                sb.Append($"<color=#7bd696>Massnahmen:</color> {string.Join(", ", p.treatments)}\n");
            if (p.injuries.Count > 0 || p.treatments.Count > 0) sb.Append("\n");

            sb.Append("<size=22><color=#93a1ad>" + Meta(p) + "</color></size>\n\n");

            int n = p.protocol.Count;
            sb.Append($"<size=20><color=#93a1ad>PROTOKOLL ({n})</color></size>\n");
            int shown = 0;
            for (int i = p.protocol.Count - 1; i >= 0 && shown < 3; i--, shown++)
            {
                var e = p.protocol[i];
                sb.Append($"<size=22><color=#93a1ad>{e.timestamp:HH:mm} · {e.author}:</color> {e.transcript}</size>\n");
            }
            return sb.ToString();
        }

        static string Meta(Patient p)
        {
            var bits = new List<string>();
            if (p.sex == "m") bits.Add("männlich"); else if (p.sex == "w") bits.Add("weiblich");
            if (p.ageEstimate != null) bits.Add($"~{p.ageEstimate} J.");
            if (p.ambulatory == true) bits.Add("gehfähig"); else if (p.ambulatory == false) bits.Add("nicht gehfähig");
            if (!string.IsNullOrEmpty(p.location)) bits.Add("Ablage " + p.location);
            if (!string.IsNullOrEmpty(p.lastSeenBy)) bits.Add("gesehen von " + p.lastSeenBy);
            return string.Join(" · ", bits);
        }

        static string Tri(bool? v) => v == true ? "<b>ja</b>" : v == false ? "<color=#e5484d><b>nein</b></color>" : "—";
    }
}
