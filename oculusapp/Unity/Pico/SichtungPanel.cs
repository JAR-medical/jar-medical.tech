// The panel the medic actually works with: one screen per step of the workflow.
//
//   Ausrichten  → Anlaufen → Sichtung (mSTaRT) → Ergebnis → Karte scannen
//
// It only renders and reports back through callbacks; every decision, every
// write to the patient record happens in JARApp. Screens are rebuilt rather than
// toggled — a handful of GameObjects per state change is cheaper than keeping
// five layouts in sync, and it guarantees no stale button is left pointing at an
// old patient.

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace JAR
{
    public sealed class SichtungPanel : MonoBehaviour
    {
        const float W = 820f, H = 540f;
        const float HeaderH = 62f;
        const float ButtonRowY = -H * 0.5f + 66f;

        Text _title, _badge, _headline, _hint, _progress, _body, _status;
        RectTransform _buttons, _pips, _band;
        Image _bandImage;

        public static SichtungPanel Build(Transform parent, float scale)
        {
            var canvas = HudUi.Canvas(parent, "JAR Sichtung", new Vector2(W, H));
            canvas.transform.localScale = Vector3.one * scale;

            var panel = canvas.gameObject.AddComponent<SichtungPanel>();
            panel.BuildChrome(canvas.transform);
            return panel;
        }

        void BuildChrome(Transform root)
        {
            HudUi.Rect(root, "Backdrop", new Vector2(W, H), Vector2.zero, HudTheme.Panel);
            HudUi.Rect(root, "HeaderBar", new Vector2(W, HeaderH), new Vector2(0, H * 0.5f - HeaderH * 0.5f), HudTheme.PanelHeader);
            HudUi.Rect(root, "HeaderLine", new Vector2(W, 1.5f), new Vector2(0, H * 0.5f - HeaderH), HudTheme.Line);

            _title = HudUi.Label(root, "Title", new Vector2(W - 300, 34), new Vector2(-140, H * 0.5f - 31),
                                 26, TextAnchor.MiddleLeft, HudTheme.Text, "J.A.R.");
            _badge = HudUi.Label(root, "Badge", new Vector2(260, 34), new Vector2(W * 0.5f - 145, H * 0.5f - 31),
                                 22, TextAnchor.MiddleRight, HudTheme.TextMuted);

            // Colour band — blank most of the time, the Sichtungsfarbe on the result screen.
            _band = HudUi.Group(root, "Band", new Vector2(W, 10), new Vector2(0, H * 0.5f - HeaderH - 5));
            _bandImage = HudUi.Rect(_band, "BandFill", new Vector2(W, 10), Vector2.zero, new Color(0, 0, 0, 0));

            _headline = HudUi.Label(root, "Headline", new Vector2(W - 90, 120), new Vector2(0, 96),
                                    42, TextAnchor.MiddleCenter, HudTheme.Text);
            _hint = HudUi.Label(root, "Hint", new Vector2(W - 120, 60), new Vector2(0, 22),
                                22, TextAnchor.UpperCenter, HudTheme.TextMuted);
            _body = HudUi.Label(root, "Body", new Vector2(W - 90, 150), new Vector2(0, -46),
                                22, TextAnchor.UpperLeft, HudTheme.Text);
            _progress = HudUi.Label(root, "Progress", new Vector2(300, 26), new Vector2(-W * 0.5f + 160, H * 0.5f - 96),
                                    19, TextAnchor.MiddleLeft, HudTheme.TextMuted);
            _status = HudUi.Label(root, "Status", new Vector2(W - 90, 26), new Vector2(0, -H * 0.5f + 26),
                                  19, TextAnchor.MiddleCenter, HudTheme.TextMuted, MStart.Disclaimer);

            _pips = HudUi.Group(root, "Pips", new Vector2(300, 20), new Vector2(W * 0.5f - 180, H * 0.5f - 96));
            _buttons = HudUi.Group(root, "Buttons", new Vector2(W - 60, 96), new Vector2(0, ButtonRowY));
        }

        // --- screens ----------------------------------------------------------

        public void ShowAlign(Action onAlign)
        {
            Reset("LAGE AUSRICHTEN", "");
            _headline.text = "Am Feldrand aufstellen";
            _hint.text = "Mit Blick über die Schadensstelle stehen bleiben — die Lagekarte wird an diese Position und Blickrichtung geheftet.";
            _body.text = "";
            SetButtons(new[] { new Btn("Lage ausrichten", onAlign, HudTheme.Accent) });
        }

        public void ShowIdle(string headline, string hint)
        {
            Reset("LAGE", "");
            _headline.text = headline;
            _hint.text = hint;
            _body.text = "";
            SetButtons(Array.Empty<Btn>());
        }

        public void ShowApproach(Patient p, string cell, float distance, bool alreadySighted,
                                 Action onStart, Action onCancel)
        {
            Reset($"PATIENT #{p.markerId}", cell);
            _headline.text = $"Patient #{p.markerId}";
            _hint.text = distance < 50f ? $"{distance:0.0} m entfernt · Feld {cell}" : $"Feld {cell}";

            var lines = new List<string>();
            if (alreadySighted) lines.Add($"<color=#f5b301>Bereits gesichtet:</color> {TriageMeta.Label(p.category)}");
            if (p.sex == "m" || p.sex == "w")
                lines.Add((p.sex == "m" ? "männlich" : "weiblich") + (p.ageEstimate != null ? $", ca. {p.ageEstimate} Jahre" : ""));
            lines.Add("Sichtung nach mSTaRT — sechs Fragen, Antwort per Pinch.");
            _body.text = string.Join("\n", lines);

            SetButtons(new[]
            {
                new Btn("Sichtung starten", onStart, HudTheme.Accent),
                new Btn("Zurück zur Lage", onCancel, null),
            });
        }

        public void ShowQuestion(MStartSession session, int markerId, string cell,
                                 Action<bool> onAnswer, Action onBack, Action onCancel)
        {
            var node = session.Node;
            Reset($"SICHTUNG · PATIENT #{markerId}", cell);

            _headline.text = node.Question;
            _hint.text = node.Hint;
            _progress.text = $"Schritt {session.StepNumber} von {MStart.MaxSteps}";
            BuildPips(session.StepNumber);

            _body.text = Trail(session);

            var buttons = new List<Btn>
            {
                new Btn("JA", () => onAnswer(true), new Color(0.16f, 0.40f, 0.26f, 0.96f)),
                new Btn("NEIN", () => onAnswer(false), new Color(0.42f, 0.17f, 0.18f, 0.96f)),
            };
            if (session.Answers.Count > 0) buttons.Add(new Btn("Schritt zurück", onBack, null));
            else buttons.Add(new Btn("Abbrechen", onCancel, null));
            SetButtons(buttons.ToArray());
        }

        public void ShowResult(int markerId, string cell, MStartResult result,
                               Action onScan, Action onRepeat, Action onLna)
        {
            Reset($"ERGEBNIS · PATIENT #{markerId}", cell);

            var colour = TriageMeta.Color(result.Category);
            _bandImage.color = colour;
            _headline.text = $"<color=#{ColorUtility.ToHtmlStringRGB(colour)}>{TriageMeta.Label(result.Category)}</color>";
            _hint.text = result.Rationale;

            var sb = new List<string>();
            if (result.Measures.Count > 0)
                sb.Add("<color=#7bd696>Sofortmaßnahmen:</color> " + string.Join(", ", result.Measures));
            sb.Add("<color=#93a1ad>" + string.Join("  ·  ", result.Trail) + "</color>");
            _body.text = string.Join("\n\n", sb);

            SetButtons(new[]
            {
                new Btn("Karte scannen", onScan, HudTheme.Accent),
                new Btn("Wiederholen", onRepeat, null),
                new Btn("SK IV (LNA)", onLna, new Color(0.15f, 0.27f, 0.47f, 0.96f)),
            });
        }

        public void ShowScan(int markerId, string cell, Triage category, bool cameraLive,
                             Action onManual, Action onBack)
        {
            Reset($"KARTE · PATIENT #{markerId}", cell);

            var colour = TriageMeta.Color(category);
            _bandImage.color = colour;
            _headline.text = "Patientenumhängekarte scannen";
            _hint.text = cameraLive
                ? "QR-Code der Karte ins Blickfeld halten — die Sichtungskategorie wird auf die Karte gebucht."
                : "Kamera nicht verfügbar — Zuordnung manuell bestätigen.";
            _body.text = $"Zu buchen: <color=#{ColorUtility.ToHtmlStringRGB(colour)}>{TriageMeta.Label(category)}</color>";

            var buttons = new List<Btn>();
            if (!cameraLive) buttons.Add(new Btn("Manuell bestätigen", onManual, HudTheme.Accent));
            buttons.Add(new Btn("Zurück", onBack, null));
            SetButtons(buttons.ToArray());
        }

        /// A card was scanned that belongs to a different patient number. The
        /// card is the physical record, so the medic decides — nothing is booked
        /// until they do.
        public void ShowScanMismatch(int expected, int scanned, string cell, Action onAccept, Action onBack)
        {
            Reset($"KARTE · PATIENT #{expected}", cell);
            _bandImage.color = new Color(0.96f, 0.70f, 0.00f, 1f);
            _headline.text = $"Karte #{scanned} ≠ Patient #{expected}";
            _hint.text = "Die gescannte Umhängekarte gehört zu einer anderen Nummer.";
            _body.text = "Entweder die richtige Karte scannen oder die gescannte Karte übernehmen — dann wird das Ergebnis auf Patient #" + scanned + " gebucht.";
            SetButtons(new[]
            {
                new Btn($"Karte #{scanned} übernehmen", onAccept, HudTheme.Accent),
                new Btn("Nochmal scannen", onBack, null),
            });
        }

        public void ShowConfirmed(int markerId, string cell, Triage category, string cardText, Action onNext)
        {
            Reset($"GEBUCHT · PATIENT #{markerId}", cell);
            var colour = TriageMeta.Color(category);
            _bandImage.color = colour;
            _headline.text = $"<color=#{ColorUtility.ToHtmlStringRGB(colour)}>{TriageMeta.Short(category)}</color> gebucht";
            _hint.text = cardText;
            _body.text = "";
            SetButtons(new[] { new Btn("Nächster Patient", onNext, HudTheme.Accent) });
        }

        public void SetStatus(string text) => _status.text = text ?? "";

        public void SetVisible(bool visible) => gameObject.SetActive(visible);

        // --- helpers ----------------------------------------------------------

        struct Btn
        {
            public readonly string Label;
            public readonly Action Action;
            public readonly Color? Tint;
            public Btn(string label, Action action, Color? tint) { Label = label; Action = action; Tint = tint; }
        }

        void Reset(string title, string badge)
        {
            _title.text = title;
            _badge.text = badge;
            _bandImage.color = new Color(0, 0, 0, 0);
            _progress.text = "";
            _status.text = MStart.Disclaimer;
            ClearChildren(_pips);
        }

        static string Trail(MStartSession session)
        {
            if (session.Answers.Count == 0) return "";
            var lines = new List<string>();
            int from = Mathf.Max(0, session.Answers.Count - 3);
            for (int i = from; i < session.Answers.Count; i++)
                lines.Add("<color=#93a1ad>· " + session.Answers[i].Line + "</color>");
            return string.Join("\n", lines);
        }

        void BuildPips(int stepNumber)
        {
            ClearChildren(_pips);
            for (int i = 0; i < MStart.MaxSteps; i++)
            {
                bool filled = i < stepNumber;
                HudUi.Dot(_pips, $"Pip{i}", filled ? 12 : 9, new Vector2(i * 22 - MStart.MaxSteps * 11f, 0),
                          filled ? HudTheme.Accent : HudTheme.Line);
            }
        }

        void SetButtons(Btn[] buttons)
        {
            ClearChildren(_buttons);
            if (buttons.Length == 0) return;

            const float gap = 18f;
            float total = W - 90f;
            float width = (total - gap * (buttons.Length - 1)) / buttons.Length;
            float start = -total * 0.5f + width * 0.5f;

            for (int i = 0; i < buttons.Length; i++)
            {
                var b = buttons[i];
                HudButton.Create(_buttons, b.Label, new Vector2(width, 84),
                                 new Vector2(start + i * (width + gap), 0), b.Action, b.Tint,
                                 buttons.Length > 2 ? 26 : 32);
            }
        }

        static void ClearChildren(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--)
            {
                var child = t.GetChild(i).gameObject;
                // Deactivate first: Destroy is deferred to the end of the frame,
                // and a HudButton only leaves the hit-test list in OnDisable.
                child.SetActive(false);
                Destroy(child);
            }
        }
    }
}
