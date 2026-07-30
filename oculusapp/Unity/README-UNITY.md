# J.A.R. AR-Client — native Quest 2 app (Unity 6 + Meta XR SDK)

This builds the AR-Client as a **native Android app (`.apk`)** you install on the
Quest 2. Passthrough (see-through), the patient HUD and voice output all run
natively; patients are chosen by controller or voice (the Quest 2 camera can't be
used for QR — see the note at the end).

> **What I could and couldn't do for you:** I wrote the whole project (the C# in
> `Assets/JAR/Scripts/`) and verified the pure logic — the voice-command parser is
> compiled and unit-tested with .NET and behaves identically to the web client.
> I **cannot run the Unity Editor or build an APK in my environment**, so the
> steps below are the build you run once, on your Mac. It's mostly clicking
> "Fix All" in Meta's setup tool and pressing Build.
>
> Your machine already has **Unity 6000.5.5f1** and **Unity Hub** — this guide
> targets exactly that.

---

## 0. One-time prerequisites (~20 min, mostly downloads)

### a) Add Android Build Support to the editor
Unity Hub → **Installs** → the `⋯` on **6000.5.5f1** → **Add modules** → tick:
- **Android Build Support**
  - **OpenJDK**
  - **Android SDK & NDK Tools**

This also gives you `adb` for sideloading, at:
```
/Applications/Unity/Hub/Editor/6000.5.5f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb
```
(Tip: `alias adb="/Applications/Unity/Hub/Editor/6000.5.5f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb"`)

### b) Put the Quest 2 into Developer Mode
1. Create a developer org (free): <https://developer.meta.com> → *Get started* → verify.
2. **Meta Horizon** phone app → **Menu ▸ Devices** → select your Quest 2 →
   **Headset settings ▸ Developer Mode ▸ On**.
3. Plug the Quest into the Mac by USB-C. In the headset, accept **Allow USB
   debugging** (and *Always allow from this computer*).
4. Verify from Terminal: `adb devices` → your headset serial should be listed.

---

## 1. Create the Unity project

Unity Hub → **New project** → editor **6000.5.5f1** →
**3D (Built-In Render Pipeline)** template → name it `JAR AR-Client` → **Create**.

> Use the **Built-In** template, not URP — transparent passthrough is simplest
> there and needs no render-pipeline tweaks.

---

## 2. Install the Meta XR SDK

1. Open the **Meta XR All-in-One SDK** (free) on the Asset Store in a browser and
   **Add to My Assets**: <https://assetstore.unity.com/packages/tools/integration/meta-xr-all-in-one-sdk-269657>
2. In Unity: **Window ▸ Package Manager ▸ My Assets** → find **Meta XR All-in-One
   SDK** → **Download** → **Import**.
3. When prompted by the **Project Setup Tool** / restart prompts, accept
   (it may ask to enable the new input backend and restart — allow it).

---

## 3. Configure the project for Quest (the "Fix All" step)

1. **Meta ▸ Tools ▸ Project Setup Tool**.
2. Select the **Android** tab. Click **Fix All**, then **Apply All**.
   This sets: Android platform, IL2CPP + ARM64, correct min/target API, XR
   Plug-in Management → **Oculus** enabled, colour space, and the manifest.
3. Confirm XR provider: **Edit ▸ Project Settings ▸ XR Plug-in Management ▸
   Android tab** → **Oculus** is ticked.
4. **Player** settings (Edit ▸ Project Settings ▸ Player ▸ Android):
   - **Product Name:** `J.A.R. AR-Client`
   - **Other Settings ▸ Package Name:** `com.jar.arclient`
   - Minimum API Level ≥ **Android 10 (API 29)** (the setup tool usually sets 32).

---

## 4. Add the app scripts and scene

1. **Copy this folder's `Assets/JAR/`** into your project's `Assets/` (drag the
   `JAR` folder into the Project window, or copy on disk). It contains:
   `PatientModel.cs`, `PatientPanel.cs`, `VoiceCommands.cs`, `TriageTts.cs`,
   `JARApp.cs`, and the optional `MarkerScannerQuest3.cs`.
2. **New scene:** File ▸ New Scene ▸ *Basic (Built-in)* → save as `Assets/JAR.unity`.
3. Delete the default **Main Camera** (the OVR rig brings its own).
4. In the Project window, search **`OVRCameraRig`**, drag the **prefab** into the
   scene (leave it at position 0,0,0).
5. Select **OVRCameraRig** → in the Inspector on **OVR Manager**:
   - **Quest Features ▸ General ▸ Passthrough Support** = **Required**
   - **Insight Passthrough ▸ Enable Passthrough** = **checked**
6. Create an empty GameObject (**GameObject ▸ Create Empty**), name it **JAR**,
   and **Add Component ▸ JARApp**.
7. Save the scene. In **File ▸ Build Profiles** (or Build Settings) make sure
   `JAR.unity` is the only scene in the list / at the top.

That's the entire scene: an OVR rig + one GameObject. `JARApp` builds the HUD and
turns on passthrough at runtime.

---

## 5. Build & install

**Fastest (build straight onto the headset):**
1. Connect the Quest by USB (from step 0b).
2. **File ▸ Build Profiles ▸ Android ▸ Build And Run** (choose your headset as the
   Run Device if asked). First IL2CPP build takes a few minutes.

**Or build an APK and sideload it:**
1. **Build** to e.g. `JAR.apk`.
2. `adb install -r JAR.apk`
   (or drag the APK onto **SideQuest** if you prefer a GUI — <https://sidequestvr.com>).

**Run it:** in the headset, **Apps ▸** dropdown **▸ Unknown Sources ▸
J.A.R. AR-Client**. You'll see passthrough with the patient HUD floating ahead.

---

## Using it

Right Touch controller:

| Input | Action |
|-------|--------|
| Thumbstick ◀ ▶ | previous / next patient (#1–#12) |
| Index trigger | load the selected patient + read it aloud |
| **A** | re-triage (cycle rot → gelb → grün → blau → schwarz) |
| **B** | read the summary again |
| Grip | back to selection |

Print the markers from `../assets/markers/markers.html` — each names its patient
number, which you dial in with the thumbstick.

---

## Voice

- **Talking back (TTS):** `TriageTts.cs` speaks German via Android's TextToSpeech.
  It works **if a TTS engine is installed on the headset** — stock Quest OS may not
  ship one, in which case speech is silent but the HUD text always shows. (In the
  Editor it logs to the Console so you can develop without a device.)
- **Talking to it (STT):** offline speech recognition isn't available on Quest out
  of the box. To enable real dictation, add **Meta Voice SDK** (Wit.ai; part of the
  All-in-One SDK) with an app token, and call the already-wired hook:
  ```csharp
  GetComponent<JARApp>().OnTranscript(recognizedText);
  ```
  `VoiceCommands.Parse` then turns "Maßnahme Tourniquet", "gelb", "Vitalwerte",
  "nächster", etc. into the same actions as the controller. That command grammar is
  compiled and unit-tested.

---

## ⚠️ QR scanning and the Quest 2

Going native does **not** unlock QR on the Quest 2: Meta exposes the passthrough
cameras to apps only on **Quest 3 / 3S** (Passthrough Camera API). So on the Quest 2
you identify the patient by controller/voice — the printed `JAR-P<n>` marker just
tells you the number.

**On a Quest 3/3S** you can enable real scanning of the same markers:
1. Add **ZXing.Net** to the project (e.g. the `zxing.unity` package / DLL).
2. Add the scripting define **`JAR_ZXING`**
   (Project Settings ▸ Player ▸ Other Settings ▸ Scripting Define Symbols).
3. Add the **MarkerScannerQuest3** component next to `JARApp`, and feed it camera
   frames from the Passthrough Camera API (a `WebCamTexture` starting point is
   included). It decodes `JAR-P<n>` and calls `JARApp.LoadPatient()` automatically.

---

## Where this meets the real product

`PatientModel.cs` bundles the same 12-patient A9 scenario as the web client and the
Einsatzleitung dashboard, with the same record shape. `PatientStore`'s
`SetCategory / AddTreatment / AddInjury / AddNote` are the seams where the real
`PATCH /api/patients/{id}` + WebSocket sync to the hub would attach, so a scan on
the glasses would update the shared Lagebild the command room sees.
