// Hand tracking — the only input this client has.
//
// No controllers: a medic in gloves at a MANV has both hands full, and the
// glasses have to work with whatever is free. PICO's hand tracking gives us an
// aim ray per hand plus a pinch flag, which is exactly the two things a
// point-and-press UI needs.
//
// PXR_HandTracking.GetAimState() reports the ray pose in TRACKING space (the
// same space PICO's own PXR_Hand puts it in, as a localPosition/localRotation),
// so it is converted to world space through `trackingSpace` — the Camera Offset
// object of the XR Origin. Set it explicitly if your rig differs.
//
// Hand tracking must be switched on for the app (PICO project settings) and by
// the wearer (system settings). `Available` is false otherwise, and JARApp shows
// a hint instead of silently doing nothing.

using UnityEngine;
using Unity.XR.PXR;

namespace JAR
{
    public struct HandRayState
    {
        public bool Valid;
        public Vector3 Origin;
        public Vector3 Direction;
        public bool PinchHeld;
        public bool PinchDown;      // edge: pinch started this frame
        public bool PinchUp;        // edge: pinch released this frame
    }

    public sealed class HandRay : MonoBehaviour
    {
        [Tooltip("Space the PICO hand poses are expressed in — normally the XR Origin's Camera Offset. Auto-detected from the main camera's parent when left empty.")]
        public Transform trackingSpace;

        public HandRayState Left;
        public HandRayState Right;

        /// The hand currently driving the pointer — the one that pinched last,
        /// falling back to whichever is tracked.
        public HandRayState Active { get; private set; }

        /// Hand tracking is switched on and at least one hand is tracked.
        public bool Available { get; private set; }

        /// Hand tracking is disabled in the system settings (a different problem
        /// from "hands not currently visible", and worth telling the user about).
        public bool DisabledInSettings { get; private set; }

        HandAimState _aim;
        bool _prevLeftPinch, _prevRightPinch;
        bool _preferRight = true;
        float _settingsCheckAt;

        void Awake()
        {
            if (trackingSpace == null)
            {
                var cam = Camera.main;
                if (cam != null) trackingSpace = cam.transform.parent != null ? cam.transform.parent : cam.transform;
            }
            if (trackingSpace == null)
                Debug.LogWarning("[JAR] Kein trackingSpace für Handtracking gefunden — XR Origin fehlt?");
        }

        void Update()
        {
            // GetSettingState() talks to the system; once a second is plenty.
            if (Time.unscaledTime >= _settingsCheckAt)
            {
                _settingsCheckAt = Time.unscaledTime + 1f;
                try { DisabledInSettings = !PXR_HandTracking.GetSettingState(); }
                catch (System.Exception e)
                {
                    DisabledInSettings = true;
                    Debug.LogWarning($"[JAR] Handtracking-Status nicht lesbar: {e.Message}");
                }
            }

            Left = Poll(HandType.HandLeft, ref _prevLeftPinch);
            Right = Poll(HandType.HandRight, ref _prevRightPinch);

            if (Right.PinchDown) _preferRight = true;
            else if (Left.PinchDown) _preferRight = false;

            if (_preferRight && Right.Valid) Active = Right;
            else if (!_preferRight && Left.Valid) Active = Left;
            else if (Right.Valid) Active = Right;
            else if (Left.Valid) Active = Left;
            else Active = default;

            Available = Left.Valid || Right.Valid;
        }

        HandRayState Poll(HandType hand, ref bool prevPinch)
        {
            var state = new HandRayState();

            bool ok;
            try { ok = PXR_HandTracking.GetAimState(hand, ref _aim); }
            catch (System.Exception) { ok = false; }

            if (!ok || (_aim.aimStatus & HandAimStatus.AimComputed) == 0)
            {
                prevPinch = false;
                return state;
            }

            bool pinch = (_aim.aimStatus & HandAimStatus.AimIndexPinching) != 0;
            state.PinchHeld = pinch;
            state.PinchDown = pinch && !prevPinch;
            state.PinchUp = !pinch && prevPinch;
            prevPinch = pinch;

            if ((_aim.aimStatus & HandAimStatus.AimRayValid) == 0 || trackingSpace == null)
                return state;   // pinch is still usable, the ray is not

            // ToVector3()/ToQuat() do the right-handed → Unity conversion.
            var localPos = _aim.aimRayPose.Position.ToVector3();
            var localRot = _aim.aimRayPose.Orientation.ToQuat();

            state.Valid = true;
            state.Origin = trackingSpace.TransformPoint(localPos);
            state.Direction = (trackingSpace.rotation * localRot) * Vector3.forward;
            return state;
        }
    }
}
