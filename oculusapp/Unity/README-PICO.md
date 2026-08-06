# J.A.R. AR-Client — native PICO 4 Enterprise app (Unity 6 + PICO Integration SDK)

Step-by-step build of the AR-Client as a native Android app (`.apk`) for the
**PICO 4 Enterprise**: passthrough, a Lagekarte in the corner of the visor, and
the whole Sichtung workflow driven by **hand tracking only** — no controllers.

```
Lage ausrichten ─▶ Lagekarte ─▶ zum Patienten gehen ─▶ „Sichtung starten“
     ─▶ mSTaRT-Schema (6 Fragen, JA/NEIN per Pinch) ─▶ Sichtungskategorie
     ─▶ Patientenumhängekarte scannen ─▶ nächster Patient
```

> **What is verified and what isn't:** the PICO scripts in `Pico/` compile
> cleanly against the shared `Assets/JAR/Scripts/` code and against API stubs
> whose signatures were copied from the PICO Unity Integration SDK 3.4.0 source,
> and the pure logic — the mSTaRT decision tree, the grid/room maths, the record
> writes — is exercised by **67 assertions that all pass** (`dotnet run` over the
> same sources). I cannot run the Unity Editor, build an APK or drive a headset
> here, so the build, the hand tracking and the on-device feel are yours to run.
>
> Your machine has **Unity 6000.5.5f1** and Unity Hub — this guide targets that.

⚠️ **Übungszweck.** The Sichtung this app produces is a training aid, not a
medically released device — see § 10.

The Meta Quest variant lives in [README-UNITY.md](README-UNITY.md); it still has
the older controller-driven flow.

---

## 0. Which PICO do you have?

| Device | This guide | QR scanning (§ 11) |
|---|---|---|
| **PICO 4 Enterprise** | ✅ as written | ✅ `OpenVSTCamera` path, as written |
| **PICO 4 Ultra Enterprise** | ✅ identical | ⚠️ different camera API — see § 11.4 |

Everything except § 11 is the same on both. Check under
**Settings ▸ General ▸ About** if you are unsure.

---

## 1. Note: the web client already does this workflow

The WebXR client one level up (`../index.html`) runs the **same workflow** —
Lagekarte, mSTaRT, Kartenschritt — in the PICO Browser, with hand tracking, no
build required. That is what is deployed on the project website, and for most
demos it is the right thing to reach for.

Build the native app when you want the one thing the browser cannot have: a
**real scan of the Patientenumhängekarte through the headset camera** (§ 11).
The browser has no camera access on any headset, so there the card step is a
manual confirmation.

Both clients read the same roster and produce the same records.

---

## 2. One-time prerequisites (~20 min, mostly downloads)

### a) Add Android Build Support to the editor
Unity Hub → **Installs** → the `⋯` on **6000.5.5f1** → **Add modules** → tick:
- **Android Build Support**
  - **OpenJDK**
  - **Android SDK & NDK Tools**

This also gives you `adb`:
```
/Applications/Unity/Hub/Editor/6000.5.5f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb
```
(Tip: `alias adb="/Applications/Unity/Hub/Editor/6000.5.5f1/PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb"`)

### b) Developer mode + USB debugging on the headset
1. In the headset: **Settings ▸ General ▸ About** → tap the **software version**
   entry repeatedly (8–12×) until a **Developer** section appears in the menu.
2. **Developer** → enable **USB debugging**.
3. Plug the headset into the Mac by USB-C and accept the debugging prompt
   in-headset (tick *always allow from this computer*).
4. Verify: `adb devices` → your headset serial is listed as `device`.

---

## 3. Create the Unity project

Unity Hub → **New project** → editor **6000.5.5f1** →
**3D (Built-In Render Pipeline)** → name it `JAR AR-Client PICO` → **Create**.

> Use **Built-In**, not URP — transparent passthrough is simplest there and
> needs no render-pipeline tweaks.

---

## 4. Install the PICO Unity Integration SDK

**Window ▸ Package Manager ▸ + ▸ Add package from git URL…**

```
https://github.com/Pico-Developer/PICO-Unity-Integration-SDK.git
```

(v3.4.0 at time of writing; needs Unity ≥ 2021.3 and pulls in XR Plug-in
Management and the XR Interaction Toolkit as dependencies.) The
`.unitypackage`/`.tgz` from <https://developer.picoxr.com/> works too.

> ⚠️ Install the **PICO Unity Integration SDK**, *not* the separate PICO OpenXR
> SDK. The code here calls `PXR_Manager` / `PXR_Enterprise`. Having both in one
> project produces "Multiple plugins with the same name" errors.

---

## 5. Configure the project

1. **File ▸ Build Profiles ▸ Android ▸ Switch Platform**.
2. **Edit ▸ Project Settings ▸ XR Plug-in Management ▸ Android tab** → tick
   **PICO**.
3. **XR Plug-in Management ▸ Project Validation** → **Fix All**.
4. **Player ▸ Android**:
   - **Product Name:** `J.A.R. AR-Client`
   - **Other Settings ▸ Package Name:** `com.jar.arclient`
     — ⚠️ if you get camera authorization (§ 11) this **must** be the exact
     package name PICO authorized.
   - **Minimum API Level:** ≥ Android 10 (API 29)
   - **Scripting Backend:** IL2CPP, **Target Architectures:** ARM64
   - **Color Space:** Linear

---

## 6. Build the scene

1. **File ▸ New Scene ▸ Basic (Built-in)** → save as `Assets/JAR.unity`.
2. Delete the default **Main Camera** (the XR Origin brings its own).
3. **GameObject ▸ XR ▸ XR Origin (VR)**.
4. Select the **XR Origin** GameObject → **Add Component ▸ PXR Manager**.
   Do this by hand: the SDK auto-adds it only to an object named exactly
   `XR Rig`, which is not what Unity 6 creates.
5. On that **PXR Manager** component, tick **Hand Tracking** (and leave *Hand
   Tracking Support* on a setting that includes hands). Without this the app
   starts but nothing is pressable — it will say so on the status line.
6. **GameObject ▸ Create Empty** → name it **JAR** → **Add Component ▸ JARApp**.
7. Save. In **File ▸ Build Profiles**, `JAR.unity` must be the only scene in the
   list / at the top.

That is the whole scene: an XR Origin + one GameObject. `JARApp` turns on
seethrough, clears the eye camera to transparent, and builds the Lagekarte, the
panel, the hand rays and the cursor at runtime — nothing to wire in the Inspector.

The wearer also has to allow hand tracking once in the headset's own settings.

---

## 7. Add the app scripts

Copy `Unity/Assets/JAR/` from this repo into your project's `Assets/`, then make
it PICO-flavoured:

| Action | File |
|---|---|
| **keep** (shared, unchanged) | `Assets/JAR/Scripts/PatientModel.cs`, `PatientPanel.cs`, `TriageTts.cs`, `VoiceCommands.cs` |
| **delete** (Quest-only) | `Assets/JAR/Scripts/JARApp.cs`, `Assets/JAR/Scripts/MarkerScannerQuest3.cs` |
| **copy in** (the PICO app) | everything from `Unity/Pico/` except `PicoMarkerScanner.cs` |
| **copy in** only for § 11 | `Unity/Pico/PicoMarkerScanner.cs` |

So `Assets/JAR/Scripts/` ends up with: `PatientModel.cs`, `PatientPanel.cs`,
`TriageTts.cs`, `VoiceCommands.cs`, `JARApp.cs` (the PICO one), `MStart.cs`,
`ScenarioLayout.cs`, `HandRay.cs`, `HudUi.cs`, `Minimap.cs`, `SichtungPanel.cs`.

Both `JARApp.cs` files declare `JAR.JARApp` — never have both in one project.
`PatientPanel.cs` and `VoiceCommands.cs` are only used by the Quest build; they
compile harmlessly here and are kept so the two stay one code base.

### What each new file does

| File | Role |
|---|---|
| `MStart.cs` | the mSTaRT decision tree as data + a session that can step back. Pure logic, unit-tested. |
| `ScenarioLayout.cs` | patient grid cells (`C2`, `B3` …) → metres, room alignment, nearest-patient search, minimap coordinates. Pure logic, unit-tested. |
| `HandRay.cs` | PICO hand tracking → an aim ray and pinch edges per hand, in world space. |
| `HudUi.cs` | the world-space widget kit: theme, canvases, buttons, the pointer with its cursor, and the lazy body-lock for panels. |
| `Minimap.cs` | the Lagekarte. |
| `SichtungPanel.cs` | one screen per workflow step. |
| `JARApp.cs` | the state machine, proximity, speech, and every write to the patient record. |

---

## 8. Build & install

**Fastest (straight onto the headset):**
1. Connect the headset by USB (§ 2b).
2. **File ▸ Build Profiles ▸ Android ▸ Build And Run**, choosing the headset as
   the Run Device. The first IL2CPP build takes a few minutes.

**Or build an APK and sideload:**
```sh
adb install -r JAR.apk
```

**Run it:** in the headset the app appears in the **Library** (unknown sources
are listed there on PICO OS). You should see the room through the cameras with
the patient HUD floating ahead.

---

## 9. Using it

**Input is one gesture:** point with a hand — a dot shows where the ray lands —
and **pinch index finger to thumb** to press. Either hand; the one that pinched
last keeps the pointer. There is no controller path at all.

**The workflow**

1. **Lage ausrichten.** Stand at the edge of the field looking across it and
   press *Lage ausrichten*. That pins the Ablage grid to the room, so the
   minimap and the "you have reached a patient" check know where everything is.
   Do this once per exercise.
2. **Lagekarte.** Bottom left: the grid, one dot per patient, your own position
   and heading. Dots are grey until you have sighted them, then they take their
   Sichtungsfarbe. The header counts what is still open.
3. **Walk up to a patient.** Within ~2.5 m the panel switches to that patient and
   offers **Sichtung starten**. No field laid out? Point at a dot on the map and
   pinch instead — same screen.
4. **Sichtung.** Six mSTaRT questions, one at a time, each spoken aloud, answered
   with the big **JA** / **NEIN** buttons. *Schritt zurück* undoes a mis-pinch,
   including any Sofortmaßnahme it had recorded.
5. **Ergebnis.** The Sichtungskategorie in its colour, why it came out that way,
   and the Sofortmaßnahmen the algorithm flagged. *Wiederholen* starts over;
   *SK IV (LNA)* is the separately labelled physician's override (§ 10).
6. **Karte scannen.** Hold the QR code of the Patientenumhängekarte in view; the
   category is booked onto that card. Scan a card with a different number and the
   app stops and asks — it never books silently onto the wrong record. Without
   camera authorization (§ 11) the step falls back to *Manuell bestätigen*.
7. **Nächster Patient** → back to the Lagekarte, patient now coloured and counted.

Print the markers/cards from `../assets/markers/markers.html`.

**Tuning** (Inspector, on the JAR GameObject): `cellSize` metres per grid cell
(3 m), `fieldDistance` how far ahead of the alignment pose the field centre sits
(6 m), `approachRadius` when a patient counts as reached (2.5 m), `releaseRadius`
hysteresis (4 m), `speak` TTS on/off.

---

## 10. The mSTaRT schema, and what the app does not decide

`MStart.cs` implements the adult mSTaRT pre-triage algorithm — the modified
"Simple Triage and Rapid Treatment" published by the Munich fire brigade and LMU
(Kanz et al., *Notfall + Rettungsmedizin*, 2006), which is also the schema the
scenario in this project references:

| # | Frage | ja | nein |
|---|---|---|---|
| 1 | Kritische Blutung? | Blutstillung → **SK I** | weiter |
| 2 | Gehfähig? | **SK III** | weiter |
| 3 | Atmung vorhanden? | weiter zu 4 | Atemwege freimachen → 3a |
| 3a | Atmung nach Freimachen? | **SK I** | **verstorben** |
| 4 | AF < 10 oder > 30/min? | **SK I** | weiter |
| 5 | Radialispuls tastbar? | weiter | **SK I** |
| 6 | Befolgt Aufforderungen? | **SK II** | **SK I** |

Two deliberate decisions, both documented in the file:

- **The bleeding check comes first.** Published versions differ on whether it sits
  before or after the walking test; putting it first means a walking casualty with
  a spurting bleed cannot come out green. The whole tree is one data structure, so
  reordering is a single edit.
- **SK IV (blau) is never produced by the algorithm.** It is a physician's (LNA)
  decision about a hopeless prognosis, not part of pre-triage — so it exists only
  as an explicitly labelled override button, and is logged as one.

⚠️ **Übungszweck.** This is a student project. The category is a suggestion and
the app says so on every screen; the Sichtung remains the responsibility of the
person wearing the glasses.

**Speech:** `TriageTts.cs` reads the questions and results aloud through Android's
`TextToSpeech` — **if a TTS engine is installed** on the headset. If it stays
silent, everything is on screen anyway. There is no speech *input*: PICO ships no
offline recognizer for apps, so the Quest build's `VoiceCommands` grammar is not
wired up here.

---

## 11. Scanning the Patientenumhängekarte

Meta exposes no camera to apps on the Quest 2, which is why the Quest build can
only identify patients by hand. **PICO does expose the RGB (VST) camera on
Enterprise devices**, so the last step of the workflow can be real:

```
Sichtungskategorie ──▶ Karte scannen ──▶ auf die Karte gebucht
```

Everything else works without it — the card step then falls back to a manual
confirmation, and the app says "Scanner aus" on the status line.

### 11.1 Get camera authorization (start this early — it gates everything else)
Camera access is enterprise-gated. PICO binds the authorization to **your package
name *and* the headset's serial number**; an unauthorized package or a different
headset gets no frames. Request it through your PICO distributor / business
support, then set the authorized package name in **Player ▸ Package Name**.

### 11.2 Add ZXing and the scanner
1. Add **ZXing.Net** to the project (the `zxing.unity` DLL / package — the same
   dependency the Quest scanner uses; `Decode(Color32[], w, h)` must exist).
2. **Project Settings ▸ Player ▸ Other Settings ▸ Scripting Define Symbols** →
   add `JAR_ZXING`.
3. Copy `Unity/Pico/PicoMarkerScanner.cs` into `Assets/JAR/Scripts/`.
4. Select the **JAR** GameObject → **Add Component ▸ Pico Marker Scanner**.

It decodes the same `JAR-P<n>` payloads as the web client (`js/qr.js`) and raises
them to `JARApp`, which routes them by workflow state — the scanner never writes
a record itself. It only runs while armed (the *Karte scannen* screen), so the
camera is not chewing battery all day. Decoding runs on a worker thread at 2 Hz
so the render loop keeps its framerate; frame size (default 800×600) and interval
are Inspector fields.

### 11.3 What it does when authorization is missing
The service binds, but no frames arrive. After ~10 s of empty frames the scanner
**disables itself and writes the reason on the status line**; the card step then
offers *Manuell bestätigen* and the rest of the workflow is unaffected. Check
`adb logcat | grep JAR` for the exact message.

### 11.4 PICO 4 **Ultra** Enterprise
The Ultra uses a different, callback-based camera API. Swap the acquisition half
of `PicoMarkerScanner` (`Start` / `OpenCamera` / `CaptureFrame` / `CloseCamera`):

| PICO 4 Enterprise (implemented) | PICO 4 Ultra Enterprise |
|---|---|
| `PXR_Enterprise.OpenVSTCamera()` | `Configurefor4U(...)` + `OpenCameraAsyncfor4U(cb, params)` |
| `AcquireVSTCameraFrameAntiDistortion(w, h, out Frame)` | `SetCameraFrameBufferfor4U(w, h, ref data, onFrame)` + `StartGetImageDatafor4U(mode, w, h)` |
| `CloseVSTCamera()` | `CloseCamerafor4U()` |

The decode half (`BuildPixels` / `Decode` / `ParseMarker` / `Deliver`) is
unchanged — feed it the `Frame` you receive in the callback. PICO's own sample
for this path is `Enterprise/Sample/CameraRendering/PXR/EnterpriseAPI.cs` in the
SDK.

---

## 12. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Black background instead of the room | `PXR_Manager` missing on the XR Origin, or seethrough refused — check `adb logcat` for the `[JAR] Seethrough` warning |
| Panels there, but the head doesn't move them | XR Plug-in Management ▸ Android ▸ **PICO** not ticked, or no XR Origin in the scene |
| Status says *"Handtracking ist in den Systemeinstellungen aus"* | The wearer has not allowed hand tracking on the headset |
| Status says *"Hände ins Blickfeld halten"* and stays | **Hand Tracking** not ticked on the PXR Manager component (§ 6.5) |
| Cursor visible but pinching does nothing | Pinch index finger and thumb fully together; buttons have a 0.35 s cooldown, so a very fast double pinch counts once |
| Ray points somewhere else than the hand | `trackingSpace` guessed wrong — set it on the `HandRay` component to the XR Origin's **Camera Offset** |
| Patients never come "into reach" | Lage not aligned, or `cellSize` doesn't match the real spacing — both on the JAR GameObject (§ 9) |
| Minimap dots not pressable | They are disabled outside the Lage/Anlaufen screens by design |
| No speech, screens fine | No TTS engine installed on the headset (§ 10) |
| `adb devices` shows `unauthorized` | Accept the USB-debugging prompt in the headset |
| "Multiple plugins with the same name" | PICO OpenXR SDK *and* Integration SDK both installed — keep one (§ 4) |
| Scanner says "Keine Kamerabilder" | Package name / device not authorized (§ 11.1) |

---

## Files

```
Unity/
├─ README-UNITY.md          Meta Quest build guide
├─ README-PICO.md           this file
├─ Assets/JAR/Scripts/      shared:     PatientModel.cs, PatientPanel.cs,
│                                       TriageTts.cs, VoiceCommands.cs
│                           Quest-only: JARApp.cs, MarkerScannerQuest3.cs
└─ Pico/                    the PICO app
   ├─ JARApp.cs             state machine — replaces the Quest JARApp.cs
   ├─ MStart.cs             the mSTaRT decision tree (pure logic)
   ├─ ScenarioLayout.cs     grid → metres, room alignment (pure logic)
   ├─ HandRay.cs            PICO hand tracking → rays + pinch
   ├─ HudUi.cs              world-space widget kit, pointer, body-lock
   ├─ Minimap.cs            the Lagekarte
   ├─ SichtungPanel.cs      the workflow screens
   └─ PicoMarkerScanner.cs  card scanning via the enterprise camera API (§ 11)
```

## Where this meets the real product

`PatientModel.cs` bundles the same 12-patient A9 scenario as the web client and
the Einsatzleitung dashboard, with the same record shape — including the `location`
grid cells the Lagekarte is built from, so the glasses and the command board
describe the same field from one data set.

`PatientStore`'s `SetCategory / AddTreatment / AddInjury / AddNote` are the seams
where the real `PATCH /api/patients/{id}` + WebSocket sync to the hub would
attach. Every write the workflow makes goes through them and nowhere else:
finishing a Sichtung writes the category, the Sofortmaßnahmen as treatments, and
two protocol lines (the answer trail and the deciding rationale). Point those four
methods at the hub and the command room sees each card the moment it is booked.
