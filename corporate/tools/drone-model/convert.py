"""Converts the Object Capture output into compact web assets.

Usage: python convert.py <outDir> <framesDir> <convention> <assetDir>
       [--frame-t0 127] [--fps 3] [--clip-start 158] [--clip-len 26]

Writes into assetDir:
  scene.json   cameras for the web clip (OpenCV axes as quaternion + centre),
               intrinsics, up vector, orbit target, stats, buffer layout
  mesh.bin     textured model: uint16 positions, uint16 uvs, uint32 indices
  wire.bin     lighter mesh as line list: uint16 positions, uint8 reveal, uint32 lines
  points.bin   point cloud: uint16 positions, uint8 rgb, uint8 reveal
  texture.jpg  model texture, max 4096 px
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("frames")
ap.add_argument("convention")
ap.add_argument("assets")
ap.add_argument("--frame-t0", type=float, default=127.0)
ap.add_argument("--fps", type=float, default=3.0)
ap.add_argument("--clip-start", type=float, default=158.0)
ap.add_argument("--clip-len", type=float, default=26.0)
ap.add_argument("--texture", type=int, default=4096)
ap.add_argument("--points", type=int, default=150000)
args = ap.parse_args()
out, assets = Path(args.out), Path(args.assets)
assets.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def quat_to_R(q):
    x, y, z, w = q
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])


def R_to_quat(M):
    m00, m01, m02, m10, m11, m12, m20, m21, m22 = M.ravel()
    tr = m00 + m11 + m22
    if tr > 0:
        s = np.sqrt(tr + 1) * 2; w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s
    elif m00 > m11 and m00 > m22:
        s = np.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s
    elif m11 > m22:
        s = np.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s
    else:
        s = np.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4
    q = np.array([x, y, z, w])
    return q / np.linalg.norm(q)


D = np.diag([1.0, -1.0, -1.0])


def camera(p, conv):
    """World→OpenCV-camera rotation M (rows = camera axes) and centre c."""
    R, t = quat_to_R(p["q"]), np.array(p["t"], float)
    if conv == "c2w-rk": return D @ R.T, t
    if conv == "c2w-cv": return R.T, t
    if conv == "w2c-rk": return D @ R, -R.T @ t
    if conv == "w2c-cv": return R, -R.T @ t
    raise SystemExit("unknown convention " + conv)


# ---------------------------------------------------------------- cameras
poses = json.loads((out / "poses.json").read_text())["poses"]
cams = []
for p in poses:
    m = re.search(r"(\d+)", p["file"])
    if not m or "K" not in p:
        continue
    k = int(m.group(1))
    M, c = camera(p, args.convention)
    cams.append({"k": k, "time": args.frame_t0 + k / args.fps, "M": M, "c": c, "K": np.array(p["K"]).T})
cams.sort(key=lambda x: x["k"])
fx = float(np.median([c["K"][0, 0] for c in cams])); fy = float(np.median([c["K"][1, 1] for c in cams]))
cx = float(np.median([c["K"][0, 2] for c in cams])); cy = float(np.median([c["K"][1, 2] for c in cams]))
centres = np.array([c["c"] for c in cams]); fwd = np.array([c["M"][2] for c in cams])

# Orbit target: least-squares point closest to all optical axes.
A = np.zeros((3, 3)); b = np.zeros(3)
for c, d in zip(centres, fwd):
    P = np.eye(3) - np.outer(d, d)
    A += P; b += P @ c
target = np.linalg.solve(A, b)


# ---------------------------------------------------------------- geometry
def parse_obj(folder):
    objs = sorted(folder.glob("*.obj"))
    if not objs:
        raise SystemExit(f"no OBJ in {folder}")
    V, VT, F = [], [], []
    mtl = None
    for line in objs[0].read_text().splitlines():
        if line.startswith("v "):
            V.append([float(x) for x in line.split()[1:4]])
        elif line.startswith("vt "):
            VT.append([float(x) for x in line.split()[1:3]])
        elif line.startswith("f "):
            corners = [c.split("/") for c in line.split()[1:]]
            idx = [(int(c[0]) - 1, int(c[1]) - 1 if len(c) > 1 and c[1] else -1) for c in corners]
            for i in range(1, len(idx) - 1):  # fan-triangulate polygons
                F.append((idx[0], idx[i], idx[i + 1]))
        elif line.startswith("mtllib"):
            mtl = folder / line.split(maxsplit=1)[1].strip()
    tex = None
    if mtl and mtl.exists():
        for line in mtl.read_text().splitlines():
            if line.strip().startswith("map_Kd"):
                tex = folder / line.split(maxsplit=1)[1].strip()
                break
    return np.array(V, float), np.array(VT, float) if VT else None, F, tex, objs[0].name


V, VT, F, texfile, objname = parse_obj(out / "model")
print(f"model {objname}: {len(V)} vertices, {len(F)} triangles, texture {texfile.name if texfile else None}")
key_index = {}
pos, uv, idx = [], [], []
for tri in F:
    for (vi, ti) in tri:
        j = key_index.get((vi, ti))
        if j is None:
            j = key_index[(vi, ti)] = len(pos)
            pos.append(V[vi])
            uv.append(VT[ti] if ti >= 0 else (0.0, 0.0))
        idx.append(j)
pos = np.array(pos); uv = np.array(uv); idx = np.array(idx, np.uint32)

LV, _, LF, _, litename = parse_obj(out / "model-lite")
edges = set()
for tri in LF:
    a, b2, c = tri[0][0], tri[1][0], tri[2][0]
    for u, v in ((a, b2), (b2, c), (c, a)):
        edges.add((u, v) if u < v else (v, u))
edges = np.array(sorted(edges), np.uint32)
print(f"lite {litename}: {len(LV)} vertices, {len(LF)} triangles, {len(edges)} edges")

data = (out / "points.ply").read_bytes()
end = data.index(b"end_header\n") + len(b"end_header\n")
n = int([l for l in data[:end].decode().splitlines() if l.startswith("element vertex")][0].split()[-1])
rec = np.frombuffer(data[end:end + n * 15], dtype=np.dtype([("x", "<f4"), ("y", "<f4"), ("z", "<f4"), ("r", "u1"), ("g", "u1"), ("b", "u1")]))
P = np.stack([rec["x"], rec["y"], rec["z"]], 1).astype(float)
C = np.stack([rec["r"], rec["g"], rec["b"]], 1)
lo, hi = pos.min(0), pos.max(0)
pad = (hi - lo) * 0.02
inside = np.all((P >= lo - pad) & (P <= hi + pad), axis=1)
P, C = P[inside], C[inside]
if len(P) > args.points:
    sel = rng.choice(len(P), args.points, replace=False)
    P, C = P[sel], C[sel]
print(f"points: {n} total, {inside.sum()} inside the model box, {len(P)} kept")


# Up vector: dominant plane of the model surface (RANSAC), oriented towards the cameras.
def ransac_plane(X, thresh, iters=500):
    best, best_n = None, -1
    for _ in range(iters):
        s = X[rng.choice(len(X), 3, replace=False)]
        nrm = np.cross(s[1] - s[0], s[2] - s[0])
        l = np.linalg.norm(nrm)
        if l < 1e-12:
            continue
        nrm /= l
        cnt = int((np.abs((X - s[0]) @ nrm) < thresh).sum())
        if cnt > best_n:
            best_n, best = cnt, (nrm, s[0])
    nrm, p0 = best
    inl = X[np.abs((X - p0) @ nrm) < thresh]
    cen = inl.mean(0)
    return np.linalg.svd(inl - cen)[2][2], cen, len(inl) / len(X)


extent = float(np.linalg.norm(hi - lo))
sample = pos[rng.choice(len(pos), min(60000, len(pos)), replace=False)]
up, ground_pt, frac = ransac_plane(sample, extent * 0.006)
if np.mean((centres - ground_pt) @ up) < 0:
    up = -up
cam_plane = np.linalg.svd(centres - centres.mean(0))[2][2]
if cam_plane @ up < 0:
    cam_plane = -cam_plane
print(f"ground plane: {frac*100:.0f}% of surface samples; camera-path plane differs by {np.degrees(np.arccos(np.clip(cam_plane @ up, -1, 1))):.1f}°")
target = target - ((target - ground_pt) @ up) * up


def reveal_for(X, spread):
    d = X - target
    d = d - np.outer(d @ up, up)
    r = np.linalg.norm(d, axis=1)
    r = r / (np.percentile(r, 98) or 1)
    v = np.clip(r * (1 - spread) + rng.random(len(X)) * spread, 0, 1)
    return (v * 255).astype(np.uint8)


qlo = np.minimum(lo, np.minimum(LV.min(0), P.min(0) if len(P) else lo))
qhi = np.maximum(hi, np.maximum(LV.max(0), P.max(0) if len(P) else hi))
qscale = qhi - qlo


def quant(X):
    return np.round((X - qlo) / qscale * 65535).clip(0, 65535).astype(np.uint16)


def pad4(b):
    return b + b"\0" * ((-len(b)) % 4)


uv_gl = np.stack([uv[:, 0], 1 - uv[:, 1]], 1)
mesh_parts = [pad4(quant(pos).tobytes()), pad4(np.round(uv_gl.clip(0, 1) * 65535).astype(np.uint16).tobytes()), idx.tobytes()]
offs = np.cumsum([0] + [len(x) for x in mesh_parts])
(assets / "mesh.bin").write_bytes(b"".join(mesh_parts))
wire_parts = [pad4(quant(LV).tobytes()), pad4(reveal_for(LV, 0.25).tobytes()), edges.ravel().tobytes()]
woffs = np.cumsum([0] + [len(x) for x in wire_parts])
(assets / "wire.bin").write_bytes(b"".join(wire_parts))
pt_parts = [pad4(quant(P).tobytes()), pad4(C.astype(np.uint8).tobytes()), pad4(reveal_for(P, 0.35).tobytes())]
poffs = np.cumsum([0] + [len(x) for x in pt_parts])
(assets / "points.bin").write_bytes(b"".join(pt_parts))

if texfile is None or not texfile.exists():
    raise SystemExit("texture missing")
img = Image.open(texfile).convert("RGB")
tex_src = img.size
if max(img.size) > args.texture:
    s = args.texture / max(img.size)
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
img.save(assets / "texture.jpg", quality=86, optimize=True, progressive=True)

clip = []
prev_q = None
for c in cams:
    tc = c["time"] - args.clip_start
    if tc < -1.0 or tc > args.clip_len + 1.0:
        continue
    q = R_to_quat(c["M"])
    if prev_q is not None and q @ prev_q < 0:
        q = -q
    prev_q = q
    clip.append([round(tc, 4), *[round(float(v), 7) for v in q], *[round(float(v), 6) for v in c["c"]]])
dists = np.linalg.norm(centres - target, axis=1)
scene = {
    "version": 1,
    "video": {"width": 1920, "height": 1080, "clipStart": args.clip_start},
    "intrinsics": {"fx": fx, "fy": fy, "cx": cx, "cy": cy},
    "convention": args.convention,
    "poses": clip,
    "up": [float(v) for v in up],
    "target": [float(v) for v in target],
    "orbitDistance": float(np.median(dists)),
    "near": float(np.median(dists) * 0.02),
    "far": float(np.median(dists) * 8 + extent * 2),
    "quant": {"min": [float(v) for v in qlo], "max": [float(v) for v in qhi]},
    "mesh": {"file": "mesh.bin", "vertices": int(len(pos)), "indices": int(len(idx)), "offsets": [int(o) for o in offs[:3]]},
    "wire": {"file": "wire.bin", "vertices": int(len(LV)), "lines": int(len(edges)), "offsets": [int(o) for o in woffs[:3]]},
    "points": {"file": "points.bin", "count": int(len(P)), "offsets": [int(o) for o in poffs[:3]]},
    "texture": {"file": "texture.jpg", "width": img.width, "height": img.height},
    "stats": {
        "frames": len(list(Path(args.frames).glob("*.jpg"))),
        "registered": len(cams),
        "points": int(n),
        "triangles": int(len(idx) // 3),
        "liteTriangles": int(len(LF)),
        "textureSource": list(tex_src),
    },
}
scene["sizes"] = {"total": sum((assets / f).stat().st_size for f in ("mesh.bin", "wire.bin", "points.bin", "texture.jpg"))}
(assets / "scene.json").write_text(json.dumps(scene, separators=(",", ":")))
print(f"clip cameras: {len(clip)}  intrinsics fx={fx:.1f} fy={fy:.1f} cx={cx:.1f} cy={cy:.1f}")
for f in sorted(assets.iterdir()):
    print(f"  {f.name}: {f.stat().st_size/1e6:.2f} MB")
