// A very small world-space UI kit for hand input.
//
// Everything the client shows is built in code (no prefabs, no Editor wiring) —
// same approach as PatientPanel, extended with things you can point at:
//
//   HudTheme    the palette, taken from the Einsatzleitung dashboard so the
//               glasses and the command board look like one product
//   HudUi       builders: canvases, rects, labels, buttons
//   HudButton   a pressable rect that registers itself for hit-testing
//   HudPointer  turns a HandRay into hover + click, with a cursor dot
//   HudFollow   lazy body-lock: panels stay in front of the medic but hold
//               still while being pointed at
//
// Hit-testing is done directly against each button's RectTransform plane, which
// avoids dragging in an EventSystem, a raycaster and an input module for what is
// ultimately one ray and a pinch.

using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace JAR
{
    public static class HudTheme
    {
        public static readonly Color Panel       = new Color(0.055f, 0.075f, 0.094f, 0.88f);
        public static readonly Color PanelHeader = new Color(0.086f, 0.11f, 0.13f, 0.95f);
        public static readonly Color Line        = new Color(1f, 1f, 1f, 0.10f);
        public static readonly Color Text        = new Color(0.91f, 0.93f, 0.95f);
        public static readonly Color TextMuted   = new Color(0.58f, 0.63f, 0.68f);
        public static readonly Color Button      = new Color(0.13f, 0.16f, 0.19f, 0.95f);
        public static readonly Color ButtonHover = new Color(0.21f, 0.27f, 0.32f, 0.98f);
        public static readonly Color ButtonPress = new Color(0.32f, 0.62f, 0.90f, 1f);
        public static readonly Color Accent      = new Color(0.32f, 0.62f, 0.90f);
        public static readonly Color Disabled    = new Color(0.10f, 0.12f, 0.14f, 0.55f);

        /// Panel units per metre: a 900-unit panel is 1.44 m wide.
        public const float Scale = 0.0016f;

        static Font _font;
        public static Font Font =>
            _font != null ? _font : (_font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"));

        static Sprite _circle;

        /// A soft-edged white disc, generated once. Unity's built-in UI has no
        /// round sprite, and the Lagekarte lives on round patient markers.
        public static Sprite Circle
        {
            get
            {
                if (_circle != null) return _circle;

                const int n = 64;
                const float r = n * 0.5f;
                var tex = new Texture2D(n, n, TextureFormat.RGBA32, false);
                var pixels = new Color32[n * n];
                for (int y = 0; y < n; y++)
                {
                    for (int x = 0; x < n; x++)
                    {
                        float dx = x + 0.5f - r, dy = y + 0.5f - r;
                        float d = Mathf.Sqrt(dx * dx + dy * dy);
                        // 1 px of feathering so the disc does not look jagged up close
                        float a = Mathf.Clamp01(r - d);
                        pixels[y * n + x] = new Color32(255, 255, 255, (byte)(a * 255f));
                    }
                }
                tex.SetPixels32(pixels);
                tex.Apply();
                tex.filterMode = FilterMode.Bilinear;
                _circle = Sprite.Create(tex, new Rect(0, 0, n, n), new Vector2(0.5f, 0.5f));
                return _circle;
            }
        }
    }

    public static class HudUi
    {
        public static Canvas Canvas(Transform parent, string name, Vector2 size)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Canvas));
            if (parent != null) go.transform.SetParent(parent, false);
            go.transform.localScale = Vector3.one * HudTheme.Scale;
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = size;
            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            return canvas;
        }

        public static RectTransform Group(Transform parent, string name, Vector2 size, Vector2 pos)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = size;
            rt.anchoredPosition = pos;
            return rt;
        }

        public static Image Rect(Transform parent, string name, Vector2 size, Vector2 pos, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = size;
            rt.anchoredPosition = pos;
            var img = go.GetComponent<Image>();
            img.color = color;
            return img;
        }

        /// A round dot — patient markers, the medic's own position, status LEDs.
        public static Image Dot(Transform parent, string name, float diameter, Vector2 pos, Color color)
        {
            var img = Rect(parent, name, new Vector2(diameter, diameter), pos, color);
            img.sprite = HudTheme.Circle;
            return img;
        }

        public static Text Label(Transform parent, string name, Vector2 size, Vector2 pos,
                                 int fontSize, TextAnchor anchor, Color color, string text = "")
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = size;
            rt.anchoredPosition = pos;
            var t = go.GetComponent<Text>();
            t.font = HudTheme.Font;
            t.fontSize = fontSize;
            t.alignment = anchor;
            t.color = color;
            t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            t.verticalOverflow = VerticalWrapMode.Overflow;
            t.text = text;
            return t;
        }
    }

    /// A rectangle you can point at and pinch.
    public sealed class HudButton : MonoBehaviour
    {
        /// Every enabled button, for the pointer to test against.
        public static readonly List<HudButton> All = new List<HudButton>();

        public Action OnClick;
        public bool Interactable = true;

        Image _bg;
        Image _edge;
        Text _label;
        Color _tint;
        bool _hover;
        bool _bare;
        float _flashUntil;

        public RectTransform Rect { get; private set; }
        public string Label
        {
            get => _label != null ? _label.text : "";
            set { if (_label != null) _label.text = value; }
        }

        public static HudButton Create(Transform parent, string text, Vector2 size, Vector2 pos,
                                       Action onClick, Color? tint = null, int fontSize = 30)
        {
            var go = new GameObject("Button " + text, typeof(RectTransform), typeof(Image), typeof(HudButton));
            go.transform.SetParent(parent, false);

            var b = go.GetComponent<HudButton>();
            b.Rect = (RectTransform)go.transform;
            b.Rect.sizeDelta = size;
            b.Rect.anchoredPosition = pos;
            b._bg = go.GetComponent<Image>();
            b._tint = tint ?? HudTheme.Button;
            b._bg.color = b._tint;
            b.OnClick = onClick;

            // A 4-unit accent stripe on the left edge — the dashboard's visual cue
            // for "this row means something".
            b._edge = HudUi.Rect(go.transform, "Edge", new Vector2(5, size.y - 12),
                                 new Vector2(-size.x * 0.5f + 8, 0), HudTheme.Accent);

            b._label = HudUi.Label(go.transform, "Label", new Vector2(size.x - 34, size.y),
                                   new Vector2(8, 0), fontSize, TextAnchor.MiddleCenter,
                                   HudTheme.Text, text);
            return b;
        }

        /// A hit rectangle with no chrome — for callers that draw their own
        /// visuals inside it (the minimap's patient dots).
        public static HudButton CreateBare(Transform parent, string name, Vector2 size, Vector2 pos, Action onClick)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(HudButton));
            go.transform.SetParent(parent, false);

            var b = go.GetComponent<HudButton>();
            b.Rect = (RectTransform)go.transform;
            b.Rect.sizeDelta = size;
            b.Rect.anchoredPosition = pos;
            b._bg = go.GetComponent<Image>();
            b._tint = new Color(1f, 1f, 1f, 0f);       // invisible, but still hit-testable
            b._bg.color = b._tint;
            b._bare = true;
            b.OnClick = onClick;
            return b;
        }

        void OnEnable() { if (!All.Contains(this)) All.Add(this); }
        void OnDisable() { All.Remove(this); Hover = false; }

        public bool Hover
        {
            get => _hover;
            set { if (_hover != value) { _hover = value; Repaint(); } }
        }

        public void SetInteractable(bool on)
        {
            if (Interactable == on) return;
            Interactable = on;
            if (!on) _hover = false;
            Repaint();
        }

        public void SetTint(Color tint)
        {
            _tint = tint;
            Repaint();
        }

        public void SetAccent(Color color) { if (_edge != null) _edge.color = color; }

        /// Invoked by the pointer. Flashes, then runs the callback.
        public void Fire()
        {
            if (!Interactable) return;
            _flashUntil = Time.unscaledTime + 0.12f;
            Repaint();
            OnClick?.Invoke();
        }

        void Update()
        {
            if (_flashUntil > 0f && Time.unscaledTime > _flashUntil)
            {
                _flashUntil = 0f;
                Repaint();
            }
        }

        void Repaint()
        {
            if (_bg == null) return;

            if (_bare)
            {
                // No chrome to recolour — just a faint wash so the medic can see
                // which dot the ray is on.
                _bg.color = _flashUntil > 0f ? new Color(1f, 1f, 1f, 0.28f)
                          : _hover ? new Color(1f, 1f, 1f, 0.14f)
                          : _tint;
                return;
            }

            if (!Interactable)
            {
                _bg.color = HudTheme.Disabled;
                if (_label != null) _label.color = HudTheme.TextMuted;
                return;
            }

            if (_label != null) _label.color = HudTheme.Text;
            _bg.color = _flashUntil > 0f ? HudTheme.ButtonPress
                      : _hover ? HudTheme.ButtonHover
                      : _tint;
        }
    }

    /// Turns the active hand ray into hover + click on HudButtons.
    public sealed class HudPointer : MonoBehaviour
    {
        [Tooltip("How far the hand ray reaches, in metres.")]
        public float maxDistance = 4f;

        [Tooltip("Minimum seconds between two clicks — guards against pinch jitter.")]
        public float clickCooldown = 0.35f;

        public HandRay hands;

        /// The button under the ray right now, if any.
        public HudButton Hovered { get; private set; }

        Transform _cursor;
        Image _cursorDot;
        float _nextClickAt;

        void Start()
        {
            var canvas = HudUi.Canvas(null, "JAR Hand Cursor", new Vector2(40, 40));
            _cursorDot = HudUi.Rect(canvas.transform, "Dot", new Vector2(20, 20), Vector2.zero, HudTheme.Accent);
            HudUi.Rect(canvas.transform, "Ring", new Vector2(34, 34), Vector2.zero, new Color(1f, 1f, 1f, 0.25f))
                 .transform.SetAsFirstSibling();
            _cursor = canvas.transform;
            _cursor.gameObject.SetActive(false);
        }

        void Update()
        {
            if (hands == null) return;

            var ray = hands.Active;
            HudButton hit = null;
            Vector3 hitPoint = Vector3.zero;
            Quaternion hitRotation = Quaternion.identity;

            if (ray.Valid)
                hit = Raycast(ray.Origin, ray.Direction, out hitPoint, out hitRotation);

            if (Hovered != hit)
            {
                if (Hovered != null) Hovered.Hover = false;
                Hovered = hit;
                if (Hovered != null) Hovered.Hover = true;
            }

            if (hit != null)
            {
                _cursor.gameObject.SetActive(true);
                _cursor.position = hitPoint - ray.Direction * 0.005f;
                _cursor.rotation = hitRotation;
                _cursorDot.color = ray.PinchHeld ? HudTheme.ButtonPress : HudTheme.Accent;
            }
            else _cursor.gameObject.SetActive(false);

            if (ray.PinchDown && hit != null && Time.unscaledTime >= _nextClickAt)
            {
                _nextClickAt = Time.unscaledTime + clickCooldown;
                hit.Fire();   // may destroy panels — nothing is touched after this
            }
        }

        HudButton Raycast(Vector3 origin, Vector3 direction, out Vector3 point, out Quaternion rotation)
        {
            point = Vector3.zero;
            rotation = Quaternion.identity;

            HudButton best = null;
            float bestDistance = float.PositiveInfinity;

            for (int i = 0; i < HudButton.All.Count; i++)
            {
                var b = HudButton.All[i];
                if (b == null || !b.Interactable) continue;

                var t = b.Rect;
                var normal = t.forward;
                float denom = Vector3.Dot(normal, direction);
                if (Mathf.Abs(denom) < 1e-5f) continue;          // ray parallel to the panel

                float distance = Vector3.Dot(normal, t.position - origin) / denom;
                if (distance < 0.02f || distance > maxDistance || distance >= bestDistance) continue;

                var world = origin + direction * distance;
                var local = t.InverseTransformPoint(world);
                if (!t.rect.Contains(new Vector2(local.x, local.y))) continue;

                best = b;
                bestDistance = distance;
                point = world;
                rotation = t.rotation;
            }
            return best;
        }
    }

    /// Keeps a panel in front of the medic without chasing every head movement:
    /// it re-targets only once they have turned or walked away far enough, then
    /// eases across. Pointing at something that jitters with your head is
    /// unusable; a panel that never follows is worse.
    public sealed class HudFollow : MonoBehaviour
    {
        public Transform head;
        public float distance = 1.5f;
        public float heightOffset = -0.15f;
        public float yawThresholdDegrees = 42f;
        public float moveThreshold = 1.0f;
        public float easeSeconds = 0.45f;

        Vector3 _targetPos;
        Quaternion _targetRot;
        bool _initialised;

        void LateUpdate()
        {
            if (head == null) return;

            var flat = new Vector3(head.forward.x, 0f, head.forward.z);
            if (flat.sqrMagnitude < 1e-4f) return;
            flat = flat.normalized;

            var wanted = head.position + flat * distance + Vector3.up * heightOffset;
            var wantedRot = Quaternion.LookRotation(flat, Vector3.up);

            if (!_initialised)
            {
                _targetPos = wanted;
                _targetRot = wantedRot;
                transform.position = wanted;
                transform.rotation = wantedRot;
                _initialised = true;
                return;
            }

            float yaw = Quaternion.Angle(_targetRot, wantedRot);
            float moved = Vector3.Distance(new Vector3(_targetPos.x, 0f, _targetPos.z),
                                           new Vector3(wanted.x, 0f, wanted.z));
            if (yaw > yawThresholdDegrees || moved > moveThreshold)
            {
                _targetPos = wanted;
                _targetRot = wantedRot;
            }

            float t = easeSeconds <= 0f ? 1f : Mathf.Clamp01(Time.deltaTime / easeSeconds);
            transform.position = Vector3.Lerp(transform.position, _targetPos, t);
            transform.rotation = Quaternion.Slerp(transform.rotation, _targetRot, t);
        }

        /// Snap to the medic's current view — used when a panel opens.
        public void Recenter()
        {
            _initialised = false;
            LateUpdate();
        }
    }
}
