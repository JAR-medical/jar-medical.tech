// OPTIONAL — real QR scanning for Quest 3 / 3S (NOT Quest 2).
//
// Quest 2 exposes no camera to apps, so this file does nothing there and is
// disabled by default. It is compiled ONLY when BOTH are true:
//   1. you add the ZXing.Net library to the project, and
//   2. you add the scripting define symbol  JAR_ZXING
//      (Project Settings ▸ Player ▸ Other Settings ▸ Scripting Define Symbols).
//
// It decodes the same JAR-P<n> markers as the web client (js/qr.js) and calls
// JARApp.LoadPatient(). The camera SOURCE differs by SDK: on Quest 3 use Meta's
// Passthrough Camera API to obtain a texture, then hand its Color32[] frame to
// Decode(). A WebCamTexture path is provided as the common starting point.

#if JAR_ZXING
using System.Text.RegularExpressions;
using UnityEngine;
using ZXing;

namespace JAR
{
    [RequireComponent(typeof(JARApp))]
    public class MarkerScannerQuest3 : MonoBehaviour
    {
        public float scanIntervalSeconds = 0.4f;

        JARApp _app;
        WebCamTexture _cam;
        readonly BarcodeReader _reader = new BarcodeReader { AutoRotate = true, Options = { TryHarder = true } };
        float _next;
        int _lastId = -1;
        float _lastAt;

        static readonly Regex Payload = new Regex(@"(?:^JAR[-_ ]?P?[:#-]?\s*|/patient/|^)(\d{1,4})$", RegexOptions.IgnoreCase);

        void Start()
        {
            _app = GetComponent<JARApp>();
            if (WebCamTexture.devices.Length == 0)
            {
                Debug.LogWarning("[JAR] No camera device — QR scanning unavailable (expected on Quest 2).");
                enabled = false;
                return;
            }
            _cam = new WebCamTexture(1280, 960, 30);
            _cam.Play();
        }

        void Update()
        {
            if (_cam == null || !_cam.didUpdateThisFrame || Time.time < _next) return;
            _next = Time.time + scanIntervalSeconds;
            Decode(_cam.GetPixels32(), _cam.width, _cam.height);
        }

        /// Decode one frame. Public so a Quest 3 Passthrough-Camera source can call it.
        public void Decode(Color32[] pixels, int width, int height)
        {
            var res = _reader.Decode(pixels, width, height);
            if (res == null || string.IsNullOrEmpty(res.Text)) return;
            int id = ParseMarker(res.Text);
            if (id < 0) return;
            // debounce repeats of the same marker
            if (id == _lastId && Time.time - _lastAt < 2.5f) return;
            _lastId = id; _lastAt = Time.time;
            _app.LoadPatient(id);
        }

        static int ParseMarker(string raw)
        {
            if (string.IsNullOrEmpty(raw)) return -1;
            var m = Payload.Match(raw.Trim());
            return m.Success && int.TryParse(m.Groups[1].Value, out var n) ? n : -1;
        }

        void OnDisable() { if (_cam != null && _cam.isPlaying) _cam.Stop(); }
    }
}
#endif
