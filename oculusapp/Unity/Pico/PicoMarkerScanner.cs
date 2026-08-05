// Real QR scanning on the PICO 4 Enterprise — the thing the Quest 2 cannot do.
//
// PICO exposes the RGB (VST) camera through the enterprise API, so the printed
// JAR-P<n> markers can be decoded in-headset and the patient loads by itself:
//
//     Marker erkennen ──▶ Patientendaten als HUD im Passthrough
//
// Compiled ONLY when BOTH are true:
//   1. the ZXing.Net library is in the project, and
//   2. the scripting define symbol  JAR_ZXING  is set
//      (Project Settings ▸ Player ▸ Other Settings ▸ Scripting Define Symbols).
// Same gate as the Quest file ../Assets/JAR/Scripts/MarkerScannerQuest3.cs.
//
// ⚠ Camera access is enterprise-gated: PICO binds the authorization to your
// package name AND the headset's serial number. Without it the service binds
// but no frames arrive — the scanner then disables itself and says so on the
// HUD; controller/voice selection keeps working. See README-PICO.md § 11.
//
// Device note: OpenVSTCamera / AcquireVSTCameraFrameAntiDistortion are
// documented by PICO as "Only supported by PICO 4 Enterprise". The PICO 4 ULTRA
// Enterprise uses a different, callback-based camera API (…for4U) — see
// README-PICO.md § 11 for the swap.

#if JAR_ZXING
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Unity.XR.PICO.TOBSupport;
using UnityEngine;
using ZXing;

namespace JAR
{
    [RequireComponent(typeof(JARApp))]
    public class PicoMarkerScanner : MonoBehaviour
    {
        [Tooltip("Requested frame width (max 2328). Lower = faster, less range.")]
        public int frameWidth = 800;
        [Tooltip("Requested frame height (max 1748).")]
        public int frameHeight = 600;
        [Tooltip("Seconds between scan attempts.")]
        public float scanIntervalSeconds = 0.5f;
        [Tooltip("Ignore the same marker again for this long.")]
        public float duplicateCooldownSeconds = 2.5f;

        const int MaxWidth = 2328, MaxHeight = 1748;
        const int BytesPerPixel = 3;              // the VST frame is RGB24
        const int MaxAcquireFailures = 20;        // ~10 s at the default interval

        /// Raised on the main thread with the decoded patient number. JARApp
        /// routes it by workflow state — the scanner never writes records.
        public event System.Action<int> OnMarker;

        /// Only decodes while armed: scanning is a deliberate step in the
        /// workflow (the Patientenumhängekarte), not something running all day.
        public bool Armed { get; set; }

        /// The camera is open and delivering frames.
        public bool Live => _cameraOpen && !_stopped;

        JARApp _app;

        // Enterprise service binding happens on a Java callback thread — the
        // callback only flips this flag, everything else runs on the main thread.
        volatile int _bindState;                  // 0 = pending, 1 = bound, -1 = failed
        bool _serviceInitialised, _cameraOpen, _stopped;
        int _acquireFailures;

        // Frame buffers (main thread writes, worker reads while _decoding is true).
        byte[] _raw;
        Color32[] _pixels;
        volatile bool _decoding;
        volatile int _decodedId = -1;             // worker → main thread
        volatile bool _preferFlipped;             // learned row order (see BuildPixels)
        volatile bool _rowOrderKnown;

        float _nextScanAt;
        int _lastId = -1;
        float _lastIdAt;

        readonly BarcodeReader _reader = new BarcodeReader
        {
            AutoRotate = false,                   // printed markers are upright
            Options =
            {
                TryHarder = true,
                PossibleFormats = new List<BarcodeFormat> { BarcodeFormat.QR_CODE },
            },
        };

        // Same payload grammar as the web client (js/qr.js) and the Quest scanner.
        static readonly Regex Payload =
            new Regex(@"(?:^JAR[-_ ]?P?[:#-]?\s*|/patient/|^)(\d{1,4})$", RegexOptions.IgnoreCase);

        // --- lifecycle --------------------------------------------------------

        void Start()
        {
            _app = GetComponent<JARApp>();

            frameWidth = Mathf.Clamp(frameWidth, 160, MaxWidth);
            frameHeight = Mathf.Clamp(frameHeight, 120, MaxHeight);

            // isCamera: true is what unlocks the VST camera path.
            _serviceInitialised = PXR_Enterprise.InitEnterpriseService(true);
            if (!_serviceInitialised)
            {
                Fail("Enterprise-Dienst nicht verfügbar — Kamera-Scan aus.");
                return;
            }

            PXR_Enterprise.BindEnterpriseService(ok => _bindState = ok ? 1 : -1);
        }

        void Update()
        {
            if (_stopped) return;

            if (_bindState == -1) { Fail("Enterprise-Dienst nicht gebunden — Kamera-Scan aus."); return; }
            if (_bindState == 0) return;                       // still binding
            if (!_cameraOpen && !OpenCamera()) return;

            // Hand a result from the worker back to the app on the main thread.
            int found = _decodedId;
            if (found >= 0) { _decodedId = -1; if (Armed) Deliver(found); }

            if (!Armed || _decoding || Time.time < _nextScanAt) return;
            _nextScanAt = Time.time + Mathf.Max(0.1f, scanIntervalSeconds);
            CaptureFrame();
        }

        bool OpenCamera()
        {
            _cameraOpen = PXR_Enterprise.OpenVSTCamera();
            if (!_cameraOpen)
            {
                Fail("VST-Kamera nicht freigegeben (Autorisierung?) — Kamera-Scan aus.");
                return false;
            }
            _app.ShowNotice("Kamera-Scan aktiv — Marker ins Blickfeld halten.");
            return true;
        }

        void OnApplicationPause(bool paused)
        {
            if (_stopped) return;
            if (paused) CloseCamera();
            else if (_bindState == 1) OpenCamera();
        }

        void OnDisable() => CloseCamera();

        void OnApplicationQuit() => Shutdown();

        void OnDestroy() => Shutdown();

        // --- capture ----------------------------------------------------------

        void CaptureFrame()
        {
            Frame frame;
            int rc;
            try
            {
                rc = PXR_Enterprise.AcquireVSTCameraFrameAntiDistortion(frameWidth, frameHeight, out frame);
            }
            catch (Exception e)
            {
                Fail($"Kamera-Zugriff fehlgeschlagen: {e.Message}");
                return;
            }

            int w = (int)frame.width, h = (int)frame.height, size = (int)frame.datasize;
            if (rc != 0 || frame.data == IntPtr.Zero || w <= 0 || h <= 0 || size < w * h * BytesPerPixel)
            {
                if (++_acquireFailures >= MaxAcquireFailures)
                    Fail("Keine Kamerabilder — Paketname/Gerät autorisiert? Kamera-Scan aus.");
                return;
            }
            _acquireFailures = 0;

            int needed = w * h * BytesPerPixel;
            if (_raw == null || _raw.Length < needed) _raw = new byte[needed];
            Marshal.Copy(frame.data, _raw, 0, needed);

            var raw = _raw;
            _decoding = true;                                  // blocks the next capture
            Task.Run(() => DecodeWorker(raw, w, h));
        }

        // --- decode (worker thread) -------------------------------------------

        void DecodeWorker(byte[] raw, int w, int h)
        {
            try
            {
                // The row order the SDK hands us is not documented, and ZXing's
                // Unity source treats Color32[] as bottom-up. Try the current
                // guess; until one of the two ever hits, also try the other.
                Result res = Decode(raw, w, h, _preferFlipped);
                if (res != null) _rowOrderKnown = true;
                else if (!_rowOrderKnown)
                {
                    res = Decode(raw, w, h, !_preferFlipped);
                    if (res != null) { _preferFlipped = !_preferFlipped; _rowOrderKnown = true; }
                }

                if (res == null || string.IsNullOrEmpty(res.Text)) return;
                int id = ParseMarker(res.Text);
                if (id >= 0) _decodedId = id;
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[JAR] QR-Decode fehlgeschlagen: {e.Message}");
            }
            finally
            {
                _decoding = false;
            }
        }

        Result Decode(byte[] raw, int w, int h, bool flipRows)
        {
            BuildPixels(raw, w, h, flipRows);
            return _reader.Decode(_pixels, w, h);
        }

        void BuildPixels(byte[] raw, int w, int h, bool flipRows)
        {
            int count = w * h;
            if (_pixels == null || _pixels.Length != count) _pixels = new Color32[count];

            for (int y = 0; y < h; y++)
            {
                int srcRow = (flipRows ? (h - 1 - y) : y) * w * BytesPerPixel;
                int dstRow = y * w;
                for (int x = 0; x < w; x++)
                {
                    int s = srcRow + x * BytesPerPixel;
                    _pixels[dstRow + x] = new Color32(raw[s], raw[s + 1], raw[s + 2], 255);
                }
            }
        }

        static int ParseMarker(string rawText)
        {
            if (string.IsNullOrEmpty(rawText)) return -1;
            var m = Payload.Match(rawText.Trim());
            return m.Success && int.TryParse(m.Groups[1].Value, out var n) ? n : -1;
        }

        // --- delivery + teardown ----------------------------------------------

        void Deliver(int id)
        {
            if (id == _lastId && Time.time - _lastIdAt < duplicateCooldownSeconds) return;
            _lastId = id;
            _lastIdAt = Time.time;
            OnMarker?.Invoke(id);
        }

        void Fail(string message)
        {
            Debug.LogWarning($"[JAR] {message}");
            if (_app != null) _app.ShowNotice(message);
            _stopped = true;
            enabled = false;
            CloseCamera();
        }

        void CloseCamera()
        {
            if (!_cameraOpen) return;
            _cameraOpen = false;
            try { PXR_Enterprise.CloseVSTCamera(); }
            catch (Exception e) { Debug.LogWarning($"[JAR] CloseVSTCamera: {e.Message}"); }
        }

        void Shutdown()
        {
            CloseCamera();
            if (!_serviceInitialised) return;
            _serviceInitialised = false;
            try { PXR_Enterprise.UnBindEnterpriseService(); }
            catch (Exception e) { Debug.LogWarning($"[JAR] UnBindEnterpriseService: {e.Message}"); }
        }
    }
}
#endif
