# Drohnen-Modell (Demo „Vom Drohnenflug zum 3D-Mesh“)

Das 3D-Modell in `corporate/assets/drone/model/` ist eine echte Photogrammetrie
aus dem Drohnenvideo, kein im Browser geschätztes Netz. Es wird offline auf
einem Mac mit Apple silicon und macOS 26 oder neuer erzeugt (RealityKit Object
Capture: Structure from Motion und Multi-View-Stereo). Der Browser zeigt nur das
fertige Ergebnis und projiziert es mit der berechneten Kamera jedes Bildes.

Quelle: 王品翰 (Wang Pin-han), Einsturz des Weiguan-Jinlong-Gebäudes nach dem
Erdbeben in Tainan (6. Februar 2016), CC BY 3.0, Wikimedia Commons
(siehe `assets/drone/CREDITS.json`).

## Neu erzeugen

```sh
W=../_drone-model-work            # Arbeitsordner außerhalb des Repos (~300 MB)
# 1 · Originalvideo (1920×1080) von Wikimedia Commons nach $W/tainan.webm laden
# 2 · Durchgehender Orbit ohne Schnitt (127–268 s), 3 Bilder pro Sekunde
ffmpeg -ss 127 -to 268 -i $W/tainan.webm -vf fps=3 -q:v 2 -start_number 0 $W/frames/f_%04d.jpg
# 3 · Rekonstruktion (≈ 12 min auf einem M4)
swiftc -O -swift-version 5 recon.swift -o $W/recon-tool
$W/recon-tool $W/frames $W/out 400000
# 4 · Prüfen: Punktwolke in die Originalbilder projizieren (Overlays in $W/report)
python validate.py $W/out $W/frames $W/report
# 5 · Web-Dateien schreiben (Konvention aus Schritt 4)
python convert.py $W/out $W/frames c2w-rk ../../assets/drone/model
# 6 · Web-Clip (158–184 s) passend zu --clip-start/--clip-len
ffmpeg -ss 158 -t 26 -i $W/tainan.webm -an -c:v libx264 -preset veryslow -crf 25 \
  -pix_fmt yuv420p -movflags +faststart ../../assets/drone/drone-flight.mp4
```

`convert.py` ordnet jedem Einzelbild seine Zeit im Originalvideo zu
(`127 s + Bildnummer / 3`) und schreibt die Kameras des Web-Clips nach
`scene.json`. Wer Clip oder Bildrate ändert, muss die Parameter
`--frame-t0`, `--fps`, `--clip-start` und `--clip-len` anpassen.
