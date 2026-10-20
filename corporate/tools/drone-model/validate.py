"""Checks the reconstruction against the original frames.

Projects the reconstructed point cloud into frames with each frame's camera
(pose + intrinsics from Object Capture) and compares point colours with the
pixel colours underneath. Tries the plausible axis conventions and reports the
best, against a wrong-camera baseline. Writes overlay images for a visual check.

Usage: python validate.py <outDir> <framesDir> <reportDir>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

out, frames_dir, report = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3])
report.mkdir(parents=True, exist_ok=True)


def read_ply(path):
    data = path.read_bytes()
    end = data.index(b"end_header\n") + len(b"end_header\n")
    n = int([l for l in data[:end].decode().splitlines() if l.startswith("element vertex")][0].split()[-1])
    rec = np.frombuffer(data[end:end + n * 15], dtype=np.dtype([("x", "<f4"), ("y", "<f4"), ("z", "<f4"), ("r", "u1"), ("g", "u1"), ("b", "u1")]))
    return np.stack([rec["x"], rec["y"], rec["z"]], 1).astype(np.float64), np.stack([rec["r"], rec["g"], rec["b"]], 1).astype(np.float64)


def quat_to_R(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


poses = json.loads((out / "poses.json").read_text())["poses"]
pts, cols = read_ply(out / "points.ply")
print(f"poses: {len(poses)}  points: {len(pts)}")
Ks = [np.array(p["K"]).T for p in poses if "K" in p]
if Ks:
    print("intrinsics (median): fx={:.1f} fy={:.1f} cx={:.1f} cy={:.1f}".format(
        np.median([k[0, 0] for k in Ks]), np.median([k[1, 1] for k in Ks]), np.median([k[0, 2] for k in Ks]), np.median([k[1, 2] for k in Ks])))
dist = [p for p in poses if "distortion" in p]
if dist:
    lut = np.array(dist[0]["distortion"]["lut"])
    print(f"distortion lut[{len(lut)}] min={lut.min():.4f} max={lut.max():.4f}")


def project(pose, conv, P):
    R, t = quat_to_R(pose["q"]), np.array(pose["t"])
    K = np.array(pose["K"]).T
    Xc = (P - t) @ R if conv.startswith("c2w") else P @ R.T + t
    if conv.endswith("rk"):
        Xc = Xc * np.array([1, -1, -1])  # RealityKit camera (y up, z back) → OpenCV
    z = Xc[:, 2]
    with np.errstate(divide="ignore", invalid="ignore"):
        return K[0, 0] * Xc[:, 0] / z + K[0, 2], K[1, 1] * Xc[:, 1] / z + K[1, 2], z


def score(pose, conv):
    img = np.asarray(Image.open(frames_dir / pose["file"]).convert("RGB"), dtype=np.float64)
    h, w = img.shape[:2]
    u, v, z = project(pose, conv, pts)
    ok = (z > 0) & (u >= 0) & (v >= 0) & (u < w - 1) & (v < h - 1)
    if ok.sum() < 200:
        return None, img, u, v, ok
    return float(np.abs(img[v[ok].astype(int), u[ok].astype(int)] - cols[ok]).mean()), img, u, v, ok


check = [poses[i] for i in np.linspace(0, len(poses) - 1, 8).astype(int)]
results = {}
for conv in ["c2w-rk", "c2w-cv", "w2c-rk", "w2c-cv"]:
    errs = [e for e in (score(p, conv)[0] for p in check) if e is not None]
    results[conv] = np.mean(errs) if errs else 1e9
    print(f"convention {conv}: colour error {results[conv]:.1f} ({len(errs)}/{len(check)} frames)")
best = min(results, key=results.get)
base = []
for i, p in enumerate(check):
    wrong = dict(p, q=check[(i + 4) % len(check)]["q"], t=check[(i + 4) % len(check)]["t"])
    pose_err = score(wrong, best)[0]
    if pose_err is not None:
        base.append(pose_err)
print(f"BEST {best}: colour error {results[best]:.1f} vs wrong-camera baseline {np.mean(base) if base else float('nan'):.1f}")
for p in check[:4]:
    e, img, u, v, ok = score(p, best)
    im = Image.fromarray(img.astype(np.uint8))
    d = ImageDraw.Draw(im)
    for x, y in zip(u[ok][::3], v[ok][::3]):
        d.rectangle([x - 1, y - 1, x + 1, y + 1], outline=(0, 255, 160))
    im.resize((960, 540)).save(report / f"overlay_{p['sample']:04d}.jpg", quality=85)
(report / "convention.txt").write_text(best)
