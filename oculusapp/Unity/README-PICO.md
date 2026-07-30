# J.A.R. AR-Client — native PICO app (Unity 6 + PICO Unity Integration SDK)

This builds the AR-Client as a **native Android app (`.apk`)** for the
**PICO 4 Enterprise** (also works on PICO 4). Passthrough ("Video Seethrough"),
the patient HUD and voice output run natively; patients are chosen by controller
or voice.

It is the Pico counterpart of `README-UNITY.md` (Quest). The **only** file that
differs from the Quest build is the bootstrap component:

| Quest        | Pico              |
|--------------|-------------------|
| `JARApp.cs`  | `JARAppPico.cs`   |

Everything else — `PatientModel.cs`, `PatientPanel.cs`, `VoiceCommands.cs`,
`TriageTts.cs`, `MarkerScannerQuest3.cs` — is engine-neutral and shared as-is.
`JARAppPico.cs` uses Unity's **vendor-neutral XR Input** and enables **PICO Video
Seethrough**, with **no Meta/OVR dependency**.

> **What I could and couldn't do:** I wrote `JARAppPico.cs` and verified it against
> the shared classes it calls. I **cannot run the Unity Editor or build an APK**,
> and I can't test on a Pico, so the steps below are the build you run once on your
> Mac. Where a PICO SDK menu name depends on the SDK version, I flag it — adjust to
> what your installed SDK shows.

---

## 0. One-time prerequisites (~20 min, mostly downloads)

### a) Add Android Build Support to Unity 6000.5.5f1
Unity Hub → **Installs** → `⋯` on **6000.5.5f1** → **Add modules** → tick:
- **Android Build Support** → **OpenJDK** + **Android SDK & NDK Tools**

This also gives you `adb` for sideloading:
```
/Applications/Unity/Hub/Editor/6000.5.5f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb
```
Tip: `alias adb="/Applications/Unity/Hub/Editor/6000.5.5f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb"`

### b) Put the PICO 4 Enterprise into Developer Mode
1. On the headset: **Settings → General** (on some builds **System → About**) →
   find the **Software/Build version** and **tap it ~7×** until "Developer mode
   enabled" appears. On managed/enterprise devices this may instead live under the
   PICO Business Suite / device policy — enable it there.
2. **Settings → Developer → USB Debugging = On**.
3. Plug the Pico into the Mac by USB-C; in the headset accept **Allow USB debugging**
   (and *Always allow from this computer*).
4. Verify: `adb devices` → your headset serial should be listed.

### c) Download the PICO Unity Integration SDK
Get it from the PICO developer site (free, requires a PICO developer account):
<https://developer.picoxr.com> → **Resources / SDK → PICO Unity Integration SDK**.
Download the `.unitypackage` (or the tarball for Package Manager). Target the
**latest SDK that supports your headset's PICO OS**.

---

## 1. Create the Unity project
Unity Hub → **New project** → editor **6000.5.5f1** →
**3D (Built-In Render Pipeline)** template → name it `JAR AR-Client Pico` → **Create**.

> Use the **Built-In** template (not URP) — transparent seethrough is simplest there
> and needs no render-pipeline tweaks, exactly like the Quest build.

---

## 2. Install the PICO Unity Integration SDK
- **From the `.unitypackage`:** **Assets ▸ Import Package ▸ Custom Package…** → select
  the downloaded file → **Import** (import everything).
- **Or via Package Manager:** **Window ▸ Package Manager ▸ + ▸ Add package from tarball…**

If the **PICO Project Validation / Setup** window appears, click **Fix All** for the
Android issues it lists.

---

## 3. Configure the project for PICO (Android)
1. **File ▸ Build Profiles** (or Build Settings) → switch platform to **Android**
   (Switch Platform).
2. **Edit ▸ Project Settings ▸ XR Plug-in Management** → **Android** tab →
   tick **PICO** (the PICO XR provider). Leave Oculus/OpenXR unticked.
   - *If your SDK ships as an OpenXR feature instead of a standalone provider, tick
     **OpenXR** and enable the **PICO** feature group in the OpenXR settings.*
3. **Player** settings (**Edit ▸ Project Settings ▸ Player ▸ Android**):
   - **Product Name:** `J.A.R. AR-Client`
   - **Other Settings ▸ Package Name:** `com.jar.arclient`
   - **Scripting Backend:** IL2CPP · **Target Architectures:** **ARM64** only
   - **Minimum API Level:** ≥ **Android 10 (API 29)**
   - **Color Space:** Linear (the validator usually sets this)

---

## 4. Build the scene
1. **Copy this folder's `Assets/JAR/`** into your project's `Assets/` (drag the `JAR`
   folder into the Project window). It contains `PatientModel.cs`, `PatientPanel.cs`,
   `VoiceCommands.cs`, `TriageTts.cs`, `JARApp.cs`, `JARAppPico.cs`, and the optional
   `MarkerScannerQuest3.cs`.
   > `JARApp.cs` (the Quest bootstrap) references the Meta SDK and **won't compile
   > without it**. For a Pico-only project, **delete `JARApp.cs`** and keep
   > `JARAppPico.cs`. (You do not need `MarkerScannerQuest3.cs` either unless you
   > wire up camera scanning — see the last section.)
2. **New scene:** **File ▸ New Scene ▸ Basic (Built-in)** → save as `Assets/JAR.unity`.
3. Delete the default **Main Camera** (the XR rig brings its own).
4. Add the PICO camera rig:
   - **GameObject ▸ XR ▸ XR Origin (VR)**. Ensure its child camera is **tagged
     `MainCamera`** (Unity's XR Origin does this by default).
   - Add a **PXR_Manager** component so seethrough is available: select the
     **XR Origin** → **Add Component ▸ PXR Manager** (type "PXR" in the search).
     *Some SDK versions add PXR_Manager automatically or provide a "PICO XR Origin"
     prefab — either is fine, as long as a PXR_Manager exists in the scene.*
5. **Enable seethrough:** on the **PXR_Manager** component tick **Video Seethrough**
   (a.k.a. "Enable Video Seethrough" / "Passthrough"). `JARAppPico` also tries to
   switch it on at runtime, but ticking it here is the reliable, documented way.
6. Create an empty GameObject (**GameObject ▸ Create Empty**), name it **JAR**, and
   **Add Component ▸ JARAppPico**.
7. Save the scene. In **Build Profiles / Build Settings**, make sure `JAR.unity` is
   the only scene / at the top of the list.

That's the whole scene: an XR Origin (+ PXR_Manager) and one GameObject.
`JARAppPico` builds the HUD and makes the camera transparent at runtime.

---

## 5. Build & install
**Fastest (build straight onto the headset):**
1. Connect the Pico by USB (step 0b).
2. **File ▸ Build Profiles ▸ Android ▸ Build And Run** (pick your headset as the Run
   Device). The first IL2CPP build takes a few minutes.

**Or build an APK and sideload it:**
1. **Build** to e.g. `JAR-Pico.apk`.
2. `adb install -r JAR-Pico.apk` — or drag the APK onto **SideQuest**
   (<https://sidequestvr.com>), which supports Pico.

**Run it:** in the headset, open the app from the library (it may appear under
**Unknown Sources** / a "非商店应用" / sideloaded-apps section). You'll see seethrough
with the patient HUD floating ahead.

---

## Using it
Right controller:

| Input | Action |
|-------|--------|
| Thumbstick ◀ ▶ | previous / next patient (#1–#12) |
| Trigger | load the selected patient + read it aloud |
| **A** (primary) | re-triage (cycle rot → gelb → grün → blau → schwarz) |
| **B** (secondary) | read the summary again |
| Grip | back to selection |

Print the markers from `../assets/markers/markers.html` — each names its patient
number, which you dial in with the thumbstick.

---

## Voice
- **Talking back (TTS):** `TriageTts.cs` speaks German via Android's TextToSpeech.
  It works **if a TTS engine with a German voice is installed** on the headset;
  otherwise speech is silent but the HUD text always shows. (In the Editor it logs
  to the Console.)
- **Talking to it (STT):** offline recognition isn't available out of the box. Wire
  any STT engine and call the already-provided hook:
  ```csharp
  GetComponent<JARAppPico>().OnTranscript(recognizedText);
  ```
  `VoiceCommands.Parse` then turns "Maßnahme Tourniquet", "gelb", "Vitalwerte",
  "nächster", etc. into the same actions as the controller.

---

## QR scanning on the PICO 4 Enterprise (optional, advanced)
Like the Quest, patient ID here is by controller/voice; the printed `JAR-P<n>`
marker just names the number. Live in-headset QR scanning needs access to the
passthrough camera, which is **not** part of this build.

The **PICO 4 Enterprise** does expose a camera stream to apps via PICO's
enterprise **Sensor/VST camera API** (unlike the consumer Pico 4). To add real
scanning later:
1. Enable camera access via the PICO Enterprise SDK / MDM entitlement.
2. Add **ZXing.Net** to the project and the scripting define **`JAR_ZXING`**.
3. Feed camera frames into a decoder and call `JARAppPico.LoadPatient(id)` when a
   `JAR-P<n>` marker is decoded (the same seam `MarkerScannerQuest3.cs` uses on
   Quest 3).

This is a genuine extra integration, not a checkbox — treat it as a follow-up.

---

## Where this meets the real product
`PatientModel.cs` bundles the same 12-patient A9 scenario as the web client and the
Einsatzleitung dashboard, with the same record shape. `PatientStore`'s
`SetCategory / AddTreatment / AddInjury / AddNote` are the seams where the real
`PATCH /api/patients/{id}` + WebSocket sync to the hub would attach, so a scan on
the glasses would update the shared Lagebild the command room sees.
