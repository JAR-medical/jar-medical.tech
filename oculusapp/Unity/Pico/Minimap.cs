// The Lagekarte, shrunk to a corner of the visor.
//
// Same idea as the map in the Einsatzleitung demo (Website/demo): the Ablage
// grid, one dot per patient in its Sichtungsfarbe, colour used only where it
// carries meaning. What the glasses add is the medic's own position and heading,
// so "walk to the next open patient" is a glance rather than a radio call.
//
// Patient cells come from the roster's `location` field via ScenarioLayout, so
// the map and the command board show the same field without a second data set.
// Dots are pressable: pointing at one and pinching selects that patient, which
// keeps the demo working when the field is not physically laid out.

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace JAR
{
    public sealed class Minimap : MonoBehaviour
    {
        const float PanelW = 470f, PanelH = 500f;
        const float FieldPad = 34f;      // room for the A–G / 1–7 labels
        const float DotSize = 30f;

        /// Raised when the medic pinches a patient dot.
        public Action<int> OnPatientSelected;

        PatientStore _store;
        ScenarioLayout _layout;

        RectTransform _field;
        Text _title, _counts, _footer, _hint;
        Image _medic, _medicNose;
        readonly Dictionary<int, Image> _dots = new Dictionary<int, Image>();
        readonly Dictionary<int, Image> _rings = new Dictionary<int, Image>();
        readonly Dictionary<int, Text> _labels = new Dictionary<int, Text>();
        readonly List<HudButton> _picks = new List<HudButton>();

        float _fieldW, _fieldH;
        float _textRefreshAt;

        public static Minimap Build(Transform parent, PatientStore store, ScenarioLayout layout, float scale)
        {
            var canvas = HudUi.Canvas(parent, "JAR Minimap", new Vector2(PanelW, PanelH));
            canvas.transform.localScale = Vector3.one * scale;

            var map = canvas.gameObject.AddComponent<Minimap>();
            map._store = store;
            map._layout = layout;
            map.BuildChrome(canvas.transform);
            return map;
        }

        void BuildChrome(Transform root)
        {
            HudUi.Rect(root, "Backdrop", new Vector2(PanelW, PanelH), Vector2.zero, HudTheme.Panel);
            HudUi.Rect(root, "HeaderBar", new Vector2(PanelW, 54), new Vector2(0, PanelH * 0.5f - 27), HudTheme.PanelHeader);

            _title = HudUi.Label(root, "Title", new Vector2(PanelW - 28, 30), new Vector2(0, PanelH * 0.5f - 24),
                                 24, TextAnchor.MiddleLeft, HudTheme.Text, "LAGE");
            _counts = HudUi.Label(root, "Counts", new Vector2(PanelW - 28, 26), new Vector2(0, PanelH * 0.5f - 66),
                                  20, TextAnchor.MiddleLeft, HudTheme.TextMuted);

            _fieldW = PanelW - 2 * FieldPad;
            _fieldH = PanelH - 2 * FieldPad - 110;
            _field = HudUi.Group(root, "Field", new Vector2(_fieldW, _fieldH), new Vector2(FieldPad * 0.5f, -18));

            HudUi.Rect(_field, "FieldBg", new Vector2(_fieldW, _fieldH), Vector2.zero, new Color(1f, 1f, 1f, 0.035f));
            BuildGrid();
            BuildPatients();
            BuildMedic();

            _footer = HudUi.Label(root, "Footer", new Vector2(PanelW - 28, 26), new Vector2(0, -PanelH * 0.5f + 44),
                                  21, TextAnchor.MiddleLeft, HudTheme.Text);
            _hint = HudUi.Label(root, "Hint", new Vector2(PanelW - 28, 24), new Vector2(0, -PanelH * 0.5f + 20),
                                18, TextAnchor.MiddleLeft, HudTheme.TextMuted);
        }

        void BuildGrid()
        {
            int cols = Mathf.Max(1, _layout.Columns);
            int rows = Mathf.Max(1, _layout.Rows);

            for (int c = 0; c <= cols; c++)
            {
                float x = -_fieldW * 0.5f + _fieldW * c / cols;
                HudUi.Rect(_field, $"V{c}", new Vector2(1.5f, _fieldH), new Vector2(x, 0), HudTheme.Line);
            }
            for (int r = 0; r <= rows; r++)
            {
                float y = -_fieldH * 0.5f + _fieldH * r / rows;
                HudUi.Rect(_field, $"H{r}", new Vector2(_fieldW, 1.5f), new Vector2(0, y), HudTheme.Line);
            }

            // Column letters under the field, row numbers to its left.
            for (int c = 0; c < cols; c++)
            {
                float x = -_fieldW * 0.5f + _fieldW * (c + 0.5f) / cols;
                HudUi.Label(_field, $"ColLabel{c}", new Vector2(30, 22), new Vector2(x, -_fieldH * 0.5f - 16),
                            17, TextAnchor.MiddleCenter, HudTheme.TextMuted,
                            ScenarioLayout.ColumnLabel(_layout.MinCol + c));
            }
            for (int r = 0; r < rows; r++)
            {
                float y = -_fieldH * 0.5f + _fieldH * (r + 0.5f) / rows;
                HudUi.Label(_field, $"RowLabel{r}", new Vector2(30, 22), new Vector2(-_fieldW * 0.5f - 18, y),
                            17, TextAnchor.MiddleCenter, HudTheme.TextMuted,
                            (_layout.MinRow + r).ToString());
            }
        }

        void BuildPatients()
        {
            foreach (int id in _store.MarkerIds)
            {
                if (!_layout.TryNormalized(id, out var uv)) continue;
                var pos = ToField(uv);

                // Bare hit area first so the visuals sit on top of it. It is
                // generously larger than the dot — a hand ray at arm's length
                // cannot reliably hit a 3 cm target.
                int captured = id;
                var hit = HudButton.CreateBare(_field, $"Pick{id}", new Vector2(DotSize + 26, DotSize + 26), pos,
                                               () => OnPatientSelected?.Invoke(captured));
                _picks.Add(hit);

                var ring = HudUi.Dot(hit.transform, "Ring", DotSize + 12, Vector2.zero, new Color(1f, 1f, 1f, 0f));
                var dot = HudUi.Dot(hit.transform, "Dot", DotSize, Vector2.zero, HudTheme.TextMuted);
                var label = HudUi.Label(hit.transform, "Nr", new Vector2(DotSize, DotSize), Vector2.zero,
                                        16, TextAnchor.MiddleCenter, Color.white, id.ToString());

                _rings[id] = ring;
                _dots[id] = dot;
                _labels[id] = label;
            }
        }

        void BuildMedic()
        {
            _medicNose = HudUi.Rect(_field, "MedicNose", new Vector2(4, 20), Vector2.zero, HudTheme.Accent);
            _medic = HudUi.Dot(_field, "Medic", 22, Vector2.zero, HudTheme.Accent);
            _medic.gameObject.SetActive(false);
            _medicNose.gameObject.SetActive(false);
        }

        Vector2 ToField(Vector2 uv) => new Vector2((uv.x - 0.5f) * _fieldW, (uv.y - 0.5f) * _fieldH);

        /// Dots are only pickable while choosing a patient — during the Sichtung
        /// a stray pinch at the map must not swallow the answer.
        public void SetInteractive(bool on)
        {
            for (int i = 0; i < _picks.Count; i++)
                if (_picks[i] != null) _picks[i].SetInteractable(on);
        }

        // --- per-frame update -------------------------------------------------

        /// `done` = patients already sichted in this session, `target` = the one
        /// the medic is standing at (or has selected), -1 for none.
        public void Refresh(Vector3 headPosition, Vector3 headForward, int target, ICollection<int> done)
        {
            int rot = 0, gelb = 0, gruen = 0, blau = 0, tot = 0, offen = 0;

            foreach (int id in _store.MarkerIds)
            {
                var p = _store.Resolve(id);
                if (p == null) continue;

                bool sighted = done != null && done.Contains(id);
                switch (p.category)
                {
                    case Triage.SK1: rot++; break;
                    case Triage.SK2: gelb++; break;
                    case Triage.SK3: gruen++; break;
                    case Triage.SK4: blau++; break;
                    case Triage.DECEASED: tot++; break;
                }
                if (!sighted) offen++;

                if (!_dots.TryGetValue(id, out var dot)) continue;

                // Not yet sighted in this session → drawn muted, so the map reads
                // as "what is still to do" rather than "what the roster says".
                dot.color = sighted ? TriageMeta.Color(p.category)
                                    : new Color(0.42f, 0.47f, 0.53f, 0.9f);
                if (_labels.TryGetValue(id, out var lab))
                    lab.color = sighted ? Color.white : new Color(1f, 1f, 1f, 0.75f);

                if (_rings.TryGetValue(id, out var ring))
                {
                    if (id == target)
                    {
                        float pulse = 0.55f + 0.45f * Mathf.Abs(Mathf.Sin(Time.unscaledTime * 3f));
                        ring.color = new Color(HudTheme.Accent.r, HudTheme.Accent.g, HudTheme.Accent.b, pulse);
                    }
                    else ring.color = new Color(1f, 1f, 1f, 0f);
                }
            }

            // Dots and the medic marker move every frame; the text only needs to
            // be right, not instantaneous — rebuilding these strings 72×/s would
            // be pure garbage collection.
            UpdateMedic(headPosition, headForward);
            if (Time.unscaledTime < _textRefreshAt) return;
            _textRefreshAt = Time.unscaledTime + 0.2f;

            _title.text = $"LAGE · {offen} offen";
            _counts.text =
                $"<color=#e5484d>■</color> {rot}   <color=#f5b301>■</color> {gelb}   " +
                $"<color=#46a758>■</color> {gruen}   <color=#3e7bfa>■</color> {blau}   " +
                $"<color=#9aa4ae>■</color> {tot}";
            UpdateFooter(headPosition, target);
        }

        void UpdateMedic(Vector3 headPosition, Vector3 headForward)
        {
            bool show = _layout.Aligned;
            _medic.gameObject.SetActive(show);
            _medicNose.gameObject.SetActive(show);
            if (!show) return;

            var uv = _layout.NormalizedFromWorld(headPosition);
            var pos = ToField(new Vector2(Mathf.Clamp(uv.x, -0.15f, 1.15f), Mathf.Clamp(uv.y, -0.15f, 1.15f)));
            ((RectTransform)_medic.transform).anchoredPosition = pos;

            // A short bar in front of the dot shows which way the medic faces.
            float heading = _layout.HeadingDegrees(headForward);
            var noseRt = (RectTransform)_medicNose.transform;
            noseRt.anchoredPosition = pos + new Vector2(Mathf.Sin(heading * Mathf.Deg2Rad),
                                                        Mathf.Cos(heading * Mathf.Deg2Rad)) * 18f;
            noseRt.localRotation = Quaternion.Euler(0, 0, -heading);
        }

        void UpdateFooter(Vector3 headPosition, int target)
        {
            if (!_layout.Aligned)
            {
                _footer.text = "Lage nicht ausgerichtet";
                _hint.text = "„Lage ausrichten“ am Feldrand bestätigen";
                return;
            }

            if (target >= 0)
            {
                float d = _layout.Distance(target, headPosition);
                var p = _store.Resolve(target);
                string cat = p != null ? TriageMeta.Short(p.category) : "—";
                _footer.text = $"Patient #{target} · {_layout.CellLabel(target)} · {d:0.0} m";
                _hint.text = d <= 2.5f ? "in Reichweite — Sichtung starten" : $"zuletzt: {cat}";
            }
            else
            {
                _footer.text = "kein Patient in Reichweite";
                _hint.text = "Punkt auf der Karte antippen oder hingehen";
            }
        }
    }
}
