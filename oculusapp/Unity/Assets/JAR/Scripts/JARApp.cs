// J.A.R. AR-Client — Unity/Meta Quest bootstrap & orchestration.
//
// Put this component on one empty GameObject in a scene that also contains an
// OVRCameraRig (Meta XR SDK). At runtime it:
//   • turns on Insight Passthrough and makes the eye camera transparent, so the
//     real world shows through the Quest cameras (see-through);
//   • builds a head-locked world-space HUD (PatientPanel) with no prefab wiring;
//   • drives the workflow with the Touch controller and/or voice.
//
// Quest 2 has no camera access for QR, so a patient is identified here by
// controller or voice; the printed JAR-P<n> markers name the number. On Quest 3
// you can feed real scans into LoadPatient() from MarkerScannerQuest3.
//
// Controller (right hand):
//   Thumbstick ◀ ▶ : previous / next patient        Index Trigger : load + read aloud
//   A : re-triage (cycle SK1→SK4→schwarz)            B : read summary again
//   Grip : back to selection ("rescan")
//
// Voice: call OnTranscript(string) from your STT (Meta Voice SDK / dictation);
// VoiceCommands.Parse turns it into the same actions.

using UnityEngine;
using UnityEngine.UI;

namespace JAR
{
    public class JARApp : MonoBehaviour
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
            var rig = FindFirstObjectByType<OVRCameraRig>();
            Transform anchor = rig != null ? rig.centerEyeAnchor : null;

            var cam = anchor != null ? anchor.GetComponent<Camera>() : Camera.main;
            if (cam != null)
            {
                // transparent clear so the passthrough underlay shows through
                cam.clearFlags = CameraClearFlags.SolidColor;
                cam.backgroundColor = new Color(0, 0, 0, 0);
                if (anchor == null) anchor = cam.transform;
            }

            var host = rig != null ? rig.gameObject : gameObject;
            var pass = host.GetComponent<OVRPassthroughLayer>();
            if (pass == null) pass = host.AddComponent<OVRPassthroughLayer>();
            pass.overlayType = OVROverlay.OverlayType.Underlay;

            if (OVRManager.instance != null)
                OVRManager.instance.isInsightPassthroughEnabled = true;

            return anchor != null ? anchor : transform;
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
            var go = new GameObject("Hint", typeof(RectTransform), typeof(UnityEngine.UI.Text));
            go.transform.SetParent(parent, false);
            var rt = (RectTransform)go.transform;
            rt.sizeDelta = new Vector2(820, 120);
            rt.anchoredPosition = new Vector2(0, -320);
            var t = go.GetComponent<UnityEngine.UI.Text>();
            t.font = font; t.fontSize = 22; t.alignment = TextAnchor.UpperCenter;
            t.color = new Color(0.8f, 0.86f, 0.9f);
            t.horizontalOverflow = HorizontalWrapMode.Wrap;
            return t;
        }

        // --- input -----------------------------------------------------------

        void Update()
        {
            float x = OVRInput.Get(OVRInput.Axis2D.PrimaryThumbstick).x;
            if (!_stickLatch)
            {
                if (x > 0.6f) { Move(1); _stickLatch = true; }
                else if (x < -0.6f) { Move(-1); _stickLatch = true; }
            }
            else if (Mathf.Abs(x) < 0.3f) _stickLatch = false;

            if (OVRInput.GetDown(OVRInput.Button.PrimaryIndexTrigger)) LoadSelected();
            if (OVRInput.GetDown(OVRInput.Button.One)) CycleTriage();     // A
            if (OVRInput.GetDown(OVRInput.Button.Two)) SpeakSummary();    // B
            if (OVRInput.GetDown(OVRInput.Button.PrimaryHandTrigger)) Rescan();
        }

        // --- actions ---------------------------------------------------------

        void Move(int dir)
        {
            int n = _store.MarkerIds.Count;
            _selIndex = ((_selIndex + dir) % n + n) % n;
            UpdateHint();
        }

        public void LoadSelected() => LoadPatient(_store.MarkerIds[_selIndex]);

        /// Public entry point — also called by a Quest 3 marker scanner.
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

        /// Feed a recognised utterance here (from Meta Voice SDK / any STT).
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
