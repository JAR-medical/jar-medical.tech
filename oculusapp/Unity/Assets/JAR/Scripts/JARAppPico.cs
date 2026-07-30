// J.A.R. AR-Client — Unity/PICO bootstrap & orchestration (Pico 4 / 4 Enterprise).
//
// Pico counterpart to JARApp.cs: identical workflow and HUD, but with NO Meta/OVR
// dependency.
//   • Passthrough — PICO "Video Seethrough" is enabled by ticking it on the
//     PXR_Manager component in the scene (see README-PICO.md). This script also
//     tries to switch it on at runtime by reflection, so it needs no compile-time
//     reference to the PICO SDK. The eye camera is cleared transparent so the
//     seethrough underlay shows through.
//   • Input — Unity's vendor-neutral XR Input (UnityEngine.XR.InputDevices), so
//     the same code drives Pico controllers (and Quest, if you ever reuse it).
//   • HUD, patient data, TTS and the voice parser are the shared, engine-neutral
//     classes (PatientPanel / PatientStore / TriageTts / VoiceCommands) — reused
//     exactly as by JARApp.
//
// Put this on ONE empty GameObject in a scene that also has an XR Origin with a
// Main Camera and a PXR_Manager. Use exactly one of JARApp (Quest) or JARAppPico
// (Pico) per scene — never both.
//
// Right controller:
//   Thumbstick ◀ ▶ : previous / next patient      Trigger : load + read aloud
//   A (primary)    : re-triage (cycle SK1→SK4→schwarz)
//   B (secondary)  : read summary again            Grip : back to selection
//
// Voice: call OnTranscript(string) from your STT; VoiceCommands.Parse maps it to
// the same actions as the controller.

using System;
using System.Collections.Generic;
using System.Reflection;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.XR;

namespace JAR
{
    public class JARAppPico : MonoBehaviour
    {
        [Tooltip("Distance of the head-locked HUD in metres.")]
        public float hudDistance = 1.2f;

        readonly PatientStore _store = new PatientStore();
        TriageTts _tts;
        PatientPanel _panel;
        Text _hint;

        int _selIndex;          // index into _store.MarkerIds
        int _currentId = -1;    // loaded patient, or -1 while selecting
        bool _stickLatch;

        // edge-detection state for the XR buttons (GetDown equivalent)
        bool _prevTrigger, _prevA, _prevB, _prevGrip;

        static readonly Triage[] Cycle = { Triage.SK1, Triage.SK2, Triage.SK3, Triage.SK4, Triage.DECEASED };

        void Start()
        {
            _tts = new TriageTts();
            var anchor = SetupPassthrough();
            BuildHud(anchor);
            Rescan();
        }

        // --- passthrough + camera -------------------------------------------

        Transform SetupPassthrough()
        {
            var cam = Camera.main;
            if (cam == null) cam = UnityEngine.Object.FindFirstObjectByType<Camera>();
            if (cam != null)
            {
                // transparent clear so the PICO video-seethrough underlay shows through
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color(0, 0, 0, 0);
            }

            TryEnablePicoSeethrough();

            return cam != null ? cam.transform : transform;
        }

        // Enable PICO video seethrough without a compile-time dependency on the
        // PICO SDK. Ticking "Video Seethrough" on the PXR_Manager component is the
        // recommended, documented setup (README-PICO.md); this reflection path is a
        // safety net and also covers SDK versions that expose it as a property or a
        // field, static or instance.
        static void TryEnablePicoSeethrough()
        {
            try
            {
                var t = Type.GetType("Unity.XR.PXR.PXR_Manager, Unity.XR.PXR")
                        ?? Type.GetType("Unity.XR.PXR.PXR_Manager");
                if (t == null)
                {
                    Debug.Log("[JAR] PICO SDK type not found; relying on the PXR_Manager " +
                              "'Video Seethrough' checkbox for passthrough.");
                    return;
                }

                const string member = "EnableVideoSeeThrough";
                const BindingFlags pub = BindingFlags.Public;

                var sProp = t.GetProperty(member, pub | BindingFlags.Static);
                if (sProp != null && sProp.CanWrite) { sProp.SetValue(null, true); return; }
                var sField = t.GetField(member, pub | BindingFlags.Static);
                if (sField != null) { sField.SetValue(null, true); return; }

                var inst = UnityEngine.Object.FindFirstObjectByType(t);
                if (inst == null) return;
                var iProp = t.GetProperty(member, pub | BindingFlags.Instance);
                if (iProp != null && iProp.CanWrite) { iProp.SetValue(inst, true); return; }
                var iField = t.GetField(member, pub | BindingFlags.Instance);
                if (iField != null) iField.SetValue(inst, true);
            }
            catch (Exception e)
            {
                Debug.LogWarning("[JAR] Could not auto-enable PICO seethrough (" + e.Message +
                                 "). Tick 'Video Seethrough' on the PXR_Manager component instead.");
            }
        }

        // --- HUD -------------------------------------------------------------

        void BuildHud(Transform anchor)
        {
            var canvasGo = new GameObject("JAR HUD Canvas", typeof(RectTransform));
            canvasGo.transform.SetParent(anchor, false);
            canvasGo.transform.localPosition = new Vector3(0, 0, hudDistance);
            canvasGo.transform.localRotation = Quaternion.identity;
            // world-space canvas: ~1.3 m wide at the chosen distance
            canvasGo.transform.localScale = Vector3.one * 0.0016f;

            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            var crt = (RectTransform)canvasGo.transform;
            crt.sizeDelta = new Vector2(820, 700);

            _panel = PatientPanel.Build(canvasGo.transform);
            ((RectTransform)_panel.transform).anchoredPosition = new Vector2(0, 70);

            _hint = MakeHint(canvasGo.transform);
        }

        Text MakeHint(Transform parent)
        {
            var font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            var go = new GameObject("Hint", typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(820, 120);
            rt.anchoredPosition = new Vector2(0, -320);
            var t = go.GetComponent<Text>();
            t.font = font; t.fontSize = 22; t.alignment = TextAnchor.UpperCenter;
            t.color = new Color(0.8f, 0.86f, 0.9f);
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            return t;
        }

        // --- input (Unity XR Input, vendor-neutral) --------------------------

        void Update()
        {
            var rc = GetRightController();
            if (!rc.isValid) return;

            rc.TryGetFeatureValue(CommonUsages.primary2DAxis, out Vector2 axis);
            float x = axis.x;
            if (!_stickLatch)
            {
                if (x > 0.6f) { Move(1); _stickLatch = true; }
                else if (x < -0.6f) { Move(-1); _stickLatch = true; }
            }
            else if (Mathf.Abs(x) < 0.3f) _stickLatch = false;

            if (Pressed(rc, CommonUsages.triggerButton, ref _prevTrigger)) LoadSelected();
            if (Pressed(rc, CommonUsages.primaryButton, ref _prevA)) CycleTriage();     // A / X
            if (Pressed(rc, CommonUsages.secondaryButton, ref _prevB)) SpeakSummary();  // B / Y
            if (Pressed(rc, CommonUsages.gripButton, ref _prevGrip)) Rescan();
        }

        static readonly List<InputDevice> _devBuf = new List<InputDevice>();

        static InputDevice GetRightController()
        {
            InputDevices.GetDevicesWithCharacteristics(
                InputDeviceCharacteristics.Controller | InputDeviceCharacteristics.Right, _devBuf);
            return _devBuf.Count > 0 ? _devBuf[0] : default;
        }

        // Rising-edge detection: true only on the frame the button goes down.
        static bool Pressed(InputDevice dev, InputFeatureUsage<bool> btn, ref bool prev)
        {
            if (!dev.TryGetFeatureValue(btn, out bool now)) now = false;
            bool down = now && !prev;
            prev = now;
            return down;
        }

        // --- actions ---------------------------------------------------------

        void Move(int dir)
        {
            int n = _store.MarkerIds.Count;
            _selIndex = ((_selIndex + dir) % n + n) % n;
            UpdateHint();
        }

        public void LoadSelected() => LoadPatient(_store.MarkerIds[_selIndex]);

        /// Public entry point — also called by a passthrough-camera marker scanner.
        public void LoadPatient(int markerId)
        {
            if (!_store.IsKnown(markerId)) { _currentId = markerId; _panel.RenderUnknown(markerId); UpdateHint(); return; }
            _currentId = markerId;
            _selIndex = Mathf.Max(0, _store.MarkerIds.IndexOf(markerId));
            _store.MarkSeen(markerId);
            var p = _store.Resolve(markerId);
            _panel.Render(p);
            _tts.Speak(TriageTts.Summary(p));
            UpdateHint();
        }

        void SpeakSummary()
        {
            var p = Current();
            if (p != null) _tts.Speak(TriageTts.Summary(p));
        }

        void CycleTriage()
        {
            var p = Current();
            if (p == null) return;
            int i = System.Array.IndexOf(Cycle, p.category);
            var next = Cycle[(i + 1) % Cycle.Length];
            _store.SetCategory(p.markerId, next);
            _panel.Render(p);
            _tts.Speak($"Patient {p.markerId} auf {TriageMeta.Spoken(next)} gesetzt.");
            UpdateHint();
        }

        void Rescan()
        {
            _currentId = -1;
            _panel.RenderScanning("Thumbstick ◀ ▶ = wählen · Trigger = laden · Sprache: „Patient acht“");
            UpdateHint();
        }

        Patient Current() => _currentId >= 0 ? _store.Resolve(_currentId) : null;

        void UpdateHint()
        {
            int sel = _store.MarkerIds[_selIndex];
            string state = _currentId >= 0 ? $"Patient #{_currentId} geladen" : $"Auswahl: Patient #{sel}";
            _hint.text = state +
                "\nThumbstick ◀ ▶ wählen  ·  Trigger laden  ·  A re-triage  ·  B vorlesen  ·  Grip zurück";
        }

        // --- voice input -----------------------------------------------------

        /// Feed a recognised utterance here (from any STT engine).
        public void OnTranscript(string transcript)
        {
            var cmd = VoiceCommands.Parse(transcript);
            switch (cmd.type)
            {
                case CommandType.Help:
                    _tts.Speak("Sage: Zusammenfassung, Vitalwerte, rot, gelb, grün, blau, schwarz, Maßnahme, Befund, Notiz, nächster.");
                    break;
                case CommandType.Rescan: Rescan(); break;
                case CommandType.Summary: SpeakSummary(); break;
                case CommandType.Vitals: { var p = Current(); if (p != null) _tts.Speak(TriageTts.VitalsText(p)); break; }
                case CommandType.Category: { var p = Current(); if (p != null) { _store.SetCategory(p.markerId, cmd.category); _panel.Render(p); _tts.Speak($"Patient {p.markerId} auf {TriageMeta.Spoken(cmd.category)} gesetzt."); } break; }
                case CommandType.Treatment: { var p = Current(); if (p != null) { _store.AddTreatment(p.markerId, cmd.value); _panel.Render(p); _tts.Speak($"Maßnahme dokumentiert: {cmd.value}."); } break; }
                case CommandType.Injury: { var p = Current(); if (p != null) { _store.AddInjury(p.markerId, cmd.value); _panel.Render(p); _tts.Speak($"Befund dokumentiert: {cmd.value}."); } break; }
                case CommandType.Note: { var p = Current(); if (p != null) { _store.AddNote(p.markerId, cmd.value); _panel.Render(p); _tts.Speak("Notiz gespeichert."); } break; }
                case CommandType.Close: Rescan(); break;
            }
        }
    }
}
