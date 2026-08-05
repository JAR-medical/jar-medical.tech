// J.A.R. AR-Client — PICO 4 Enterprise. Workflow orchestration.
//
// The field workflow, end to end, hands-free (hand tracking only, no controllers):
//
//   Lage ausrichten ─▶ Lagekarte ─▶ zum Patienten gehen ─▶ „Sichtung starten“
//        ─▶ mSTaRT-Schema (6 Fragen) ─▶ Sichtungskategorie
//        ─▶ Patientenumhängekarte scannen ─▶ nächster Patient
//
// Responsibilities are split so each piece stays testable on its own:
//   ScenarioLayout  where the patients are (grid → metres, room alignment)
//   MStart          the triage algorithm, pure logic
//   HandRay/HudUi   input and the world-space widgets
//   Minimap         the Lagekarte
//   SichtungPanel   the screens
//   JARApp (here)   the state machine, proximity, TTS, and every write to the
//                   patient record
//
// PICO counterpart of ../Assets/JAR/Scripts/JARApp.cs (Meta Quest), which still
// has the controller-driven flow. Both declare JAR.JARApp — never put both in
// one project.

using System.Collections.Generic;
using UnityEngine;
using Unity.XR.PXR;

namespace JAR
{
    public sealed class JARApp : MonoBehaviour
    {
        [Tooltip("Turn on PICO video seethrough (passthrough) at startup.")]
        public bool enableSeeThrough = true;

        [Tooltip("Metres from the medic at which a patient counts as 'reached'.")]
        public float approachRadius = 2.5f;

        [Tooltip("Metres at which an auto-selected patient is released again (hysteresis).")]
        public float releaseRadius = 4f;

        [Tooltip("Metres between two cells of the Ablage grid in the real room.")]
        public float cellSize = 3f;

        [Tooltip("Metres from the alignment pose to the centre of the field.")]
        public float fieldDistance = 6f;

        [Tooltip("Speak questions and results aloud.")]
        public bool speak = true;

        enum State { Align, Lage, Approach, Sichtung, Ergebnis, Scan, Bestaetigt }

        readonly PatientStore _store = new PatientStore();
        readonly ScenarioLayout _layout = new ScenarioLayout();
        readonly MStartSession _session = new MStartSession();
        readonly HashSet<int> _done = new HashSet<int>();

        TriageTts _tts;
        Transform _head;
        HandRay _hands;
        HudPointer _pointer;
        HudFollow _follow;
        Minimap _minimap;
        SichtungPanel _panel;

        State _state = State.Align;
        int _target = -1;
        int _suppressed = -1;          // just left this patient — don't grab them again
        bool _targetPickedByHand;      // chosen on the map, so distance must not drop it
        MStartResult _result;
        string _notice = "";

#if JAR_ZXING
        PicoMarkerScanner _scanner;
#endif

        // --- start-up ---------------------------------------------------------

        void Start()
        {
            _tts = new TriageTts();
            _head = SetupPassthrough();

            _layout.CellSize = cellSize;
            _layout.FieldDistance = fieldDistance;
            _layout.Build(Patients());

            BuildRig();
            BuildUi();

            if (!_layout.HasCells)
            {
                // No grid references in the roster — skip alignment, work off the
                // map selection alone.
                Debug.LogWarning("[JAR] Kein Ablage-Raster im Datensatz — Anlaufen per Karte.");
                GoToLage();
            }
            else EnterAlign();
        }

        Transform SetupPassthrough()
        {
            var cam = Camera.main;
            if (cam == null) cam = FindFirstObjectByType<Camera>();
            if (cam == null)
            {
                Debug.LogError("[JAR] Keine Kamera gefunden — XR Origin fehlt in der Szene?");
                return transform;
            }

            // Solid colour with alpha 0, otherwise the seethrough background
            // stays hidden behind the skybox.
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0, 0, 0, 0);

            if (enableSeeThrough)
            {
                // PXR_Manager re-applies this on resume, so no OnApplicationPause
                // handling is needed here.
                try { PXR_Manager.EnableVideoSeeThrough = true; }
                catch (System.Exception e)
                {
                    Debug.LogWarning($"[JAR] Seethrough konnte nicht aktiviert werden: {e.Message}");
                }
            }
            return cam.transform;
        }

        void BuildRig()
        {
            _hands = gameObject.AddComponent<HandRay>();
            _pointer = gameObject.AddComponent<HudPointer>();
            _pointer.hands = _hands;

#if JAR_ZXING
            _scanner = GetComponent<PicoMarkerScanner>();
            if (_scanner != null)
            {
                _scanner.OnMarker += OnCardScanned;
                _scanner.Armed = false;          // only scans during the card step
            }
#endif
        }

        void BuildUi()
        {
            // Main panel: body-locked in front of the medic, so it can be pointed
            // at without chasing every head movement.
            var panelHost = new GameObject("JAR Panel Host");
            _follow = panelHost.AddComponent<HudFollow>();
            _follow.head = _head;
            _panel = SichtungPanel.Build(panelHost.transform, 0.0012f);
            _follow.Recenter();

            // Minimap: head-locked in the lower left, angled towards the eye.
            // Big enough that its dots are pickable with a hand ray (~3°), small
            // enough to stay a glance rather than a wall.
            _minimap = Minimap.Build(_head, _store, _layout, 0.0011f);
            var mt = _minimap.transform;
            mt.localPosition = new Vector3(-0.46f, -0.26f, 1.05f);
            mt.localRotation = Quaternion.LookRotation(mt.localPosition.normalized, Vector3.up);
            _minimap.OnPatientSelected += OnMapSelect;
        }

        IEnumerable<Patient> Patients()
        {
            foreach (int id in _store.MarkerIds)
            {
                var p = _store.Resolve(id);
                if (p != null) yield return p;
            }
        }

        // --- per frame --------------------------------------------------------

        void Update()
        {
            if (_head == null) return;

            if (_state == State.Lage || _state == State.Approach) UpdateProximity();

            _minimap.Refresh(_head.position, _head.forward, _target, _done);
            UpdateStatusLine();
        }

        void UpdateProximity()
        {
            if (!_layout.Aligned) return;
            // A patient chosen on the map stays chosen — walking past someone
            // else must not silently switch the record being worked on.
            if (_targetPickedByHand && _state == State.Approach) return;

            // The patient we deliberately stepped away from becomes selectable
            // again once we have actually left them.
            if (_suppressed >= 0 && _layout.Distance(_suppressed, _head.position) > releaseRadius)
                _suppressed = -1;

            // Prefer patients that still need sighting; fall back to sighted ones
            // so a correction is still possible by walking up to someone.
            if (!_layout.TryNearest(_head.position, Candidates(true), approachRadius, out int id, out _) &&
                !_layout.TryNearest(_head.position, Candidates(false), approachRadius, out id, out _))
                id = -1;

            if (id >= 0 && id != _target)
            {
                _target = id;
                _targetPickedByHand = false;
                EnterApproach();
                return;
            }

            // Walked away from an auto-selected patient → back to the overview.
            if (_state == State.Approach && _target >= 0 && !_targetPickedByHand &&
                _layout.Distance(_target, _head.position) > releaseRadius)
            {
                _target = -1;
                GoToLage();
            }
        }

        IEnumerable<int> Open()
        {
            foreach (int id in _store.MarkerIds)
                if (!_done.Contains(id)) yield return id;
        }

        /// Patients the proximity check may pick right now.
        IEnumerable<int> Candidates(bool openOnly)
        {
            foreach (int id in _store.MarkerIds)
            {
                if (id == _suppressed) continue;
                if (openOnly && _done.Contains(id)) continue;
                yield return id;
            }
        }

        /// The status line belongs to the app, not to the screens: one place
        /// decides what the bottom row says, so nothing can leave a stale hint
        /// behind when the state changes.
        void UpdateStatusLine()
        {
            string status;
            if (_hands != null && _hands.DisabledInSettings)
                status = "Handtracking ist in den Systemeinstellungen aus";
            else if (_hands != null && !_hands.Available)
                status = "Hände ins Blickfeld halten";
            else if (!string.IsNullOrEmpty(_notice))
                status = _notice;
            else if (_state == State.Scan)
                status = ScannerLive() ? "Scanner aktiv — Karte ins Blickfeld" : "Scanner aus";
            else
                status = MStart.Disclaimer;

            _panel.SetStatus(status);
        }

        // --- states -----------------------------------------------------------

        /// Single place where the state changes, so the map's pickability can
        /// never drift out of sync with the screen being shown.
        void Enter(State state)
        {
            _state = state;
            if (_minimap != null)
                _minimap.SetInteractive(state == State.Lage || state == State.Approach);
        }

        void EnterAlign()
        {
            Enter(State.Align);
            _follow.Recenter();
            _panel.ShowAlign(() =>
            {
                _layout.Align(_head.position, _head.forward);
                Say("Lage ausgerichtet.");
                _target = -1;
                GoToLage();
            });
        }

        void GoToLage()
        {
            // Stepping back to the overview while standing next to someone must
            // not bounce straight back into their approach screen.
            if (_target >= 0) _suppressed = _target;

            Enter(State.Lage);
            _target = -1;
            _targetPickedByHand = false;
            _session.Reset();
            _result = null;
            ArmScanner(false);

            int open = 0;
            foreach (var _ in Open()) open++;
            _panel.ShowIdle(open > 0 ? $"{open} Patienten offen" : "Alle Patienten gesichtet",
                            _layout.Aligned
                                ? "Zum nächsten Patienten gehen oder einen Punkt auf der Lagekarte antippen."
                                : "Lage ist nicht ausgerichtet — Punkt auf der Lagekarte antippen.");
        }

        void EnterApproach()
        {
            var p = _store.Resolve(_target);
            if (p == null) { GoToLage(); return; }

            Enter(State.Approach);
            _follow.Recenter();
            float d = _layout.Aligned ? _layout.Distance(_target, _head.position) : 99f;
            Say($"Patient {_target}.");
            _panel.ShowApproach(p, _layout.CellLabel(_target), d, _done.Contains(_target),
                                StartSichtung, GoToLage);
        }

        void StartSichtung()
        {
            _session.Reset();
            Enter(State.Sichtung);
            _follow.Recenter();
            ShowQuestion(true);
        }

        void ShowQuestion(bool speakIt)
        {
            _panel.ShowQuestion(_session, _target, _layout.CellLabel(_target),
                                Answer, StepBack, GoToLage);
            if (speakIt) Say(_session.Node.Question);
        }

        void Answer(bool yes)
        {
            _session.Answer(yes);
            if (_session.Done) EnterErgebnis();
            else ShowQuestion(true);
        }

        void StepBack()
        {
            if (_session.Back()) ShowQuestion(false);
            else GoToLage();
        }

        void EnterErgebnis()
        {
            _result = _session.Result;
            Enter(State.Ergebnis);
            Say($"Ergebnis: {TriageMeta.Spoken(_result.Category)}.");
            ShowErgebnis();
        }

        void ShowErgebnis()
        {
            _panel.ShowResult(_target, _layout.CellLabel(_target), _result,
                              EnterScan,
                              () => { _session.Reset(); StartSichtung(); },
                              OverrideLna);
        }

        /// SK IV is not part of mSTaRT — it is a physician's call, so it is an
        /// explicit override and is logged as one.
        void OverrideLna()
        {
            if (_result == null) return;
            _result.Category = Triage.SK4;
            _result.Rationale = "SK IV — ärztliche Entscheidung (LNA), abwartende Behandlung";
            Say("Kategorie vier, ärztliche Entscheidung.");
            ShowErgebnis();
        }

        void EnterScan()
        {
            Enter(State.Scan);
            ArmScanner(true);
            _panel.ShowScan(_target, _layout.CellLabel(_target), _result.Category, ScannerLive(),
                            () => Commit(_target, "manuell bestätigt"),
                            () => { ArmScanner(false); Enter(State.Ergebnis); ShowErgebnis(); });
        }

        /// Called by PicoMarkerScanner when a JAR-P<n> card is decoded.
        public void OnCardScanned(int markerId)
        {
            if (_state != State.Scan) return;

            if (markerId != _target)
            {
                // The card is the physical source of truth, so never book silently
                // onto the wrong record — ask.
                _panel.SetStatus($"Karte #{markerId} passt nicht zu Patient #{_target}");
                _panel.ShowScanMismatch(_target, markerId, _layout.CellLabel(_target),
                                        () => Commit(markerId, $"Karte #{markerId} übernommen"),
                                        EnterScan);
                Say("Karte passt nicht.");
                return;
            }
            Commit(markerId, $"Karte #{markerId} gescannt");
        }

        void Commit(int markerId, string how)
        {
            if (_result == null) { GoToLage(); return; }

            ArmScanner(false);

            _store.SetCategory(markerId, _result.Category);
            _store.MarkSeen(markerId);
            foreach (var m in _result.Measures) _store.AddTreatment(markerId, m);
            _store.AddNote(markerId, "mSTaRT: " + string.Join(" · ", _result.Trail));
            _store.AddNote(markerId, _result.Rationale + " — " + how);
            _done.Add(markerId);
            _target = markerId;          // the card is what we actually worked on

            Enter(State.Bestaetigt);
            Say($"Patient {markerId} auf {TriageMeta.Spoken(_result.Category)} gebucht.");
            _panel.ShowConfirmed(markerId, _layout.CellLabel(markerId), _result.Category, how, GoToLage);
        }

        void OnMapSelect(int markerId)
        {
            // Only from screens where switching patients is safe.
            if (_state != State.Lage && _state != State.Approach) return;
            _target = markerId;
            _targetPickedByHand = true;
            if (_suppressed == markerId) _suppressed = -1;   // explicit choice wins
            EnterApproach();
        }

        // --- scanner + speech -------------------------------------------------

        void ArmScanner(bool on)
        {
#if JAR_ZXING
            if (_scanner != null) _scanner.Armed = on;
#endif
        }

        bool ScannerLive()
        {
#if JAR_ZXING
            return _scanner != null && _scanner.Live;
#else
            return false;
#endif
        }

        /// Status line from the scanner (authorization problems, "Scanner aktiv", …).
        public void ShowNotice(string message)
        {
            _notice = message ?? "";
            if (_panel != null && !string.IsNullOrEmpty(_notice)) _panel.SetStatus(_notice);
        }

        void Say(string text)
        {
            if (speak && _tts != null) _tts.Speak(text);
        }
    }
}
