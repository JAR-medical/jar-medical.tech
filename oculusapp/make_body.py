#!/usr/bin/env python3
"""Erzeugt das Körpermodell für den AR-Client aus dem MakeHuman-Basisnetz.

    ../../.venv/bin/python make_body.py

Ergebnis (wird eingecheckt, wie der Kartenbogen aus make_cards.py):

    assets/body/body.bin    Positionen + Normalen + Indizes, roh
    assets/body/body.json   Abschnitte je Körperregion + Herkunft
    assets/body/HERKUNFT.md Lizenz und Quelle im Klartext

Warum ein Skript und kein mitgeliefertes Netz: die Quelle ist 1,7 MB groß und
wird hier auf das gebraucht — die Gruppe `body`, ohne Helfergeometrie, ohne
Gelenkwürfel, ohne Zähne. Was im Repo landet, ist das Ergebnis.

**Quelle und Lizenz.** Das Basisnetz von MakeHuman ("basemesh hm08") wurde im
September 2020 ausdrücklich unter CC0 gestellt; der Hinweis steht im Kopf der
Datei selbst. Rechteinhaber zum Zeitpunkt der Freigabe: Data Collection AB,
Joel Palmius, Jonas Hauquier. CC0 heißt: keine Namensnennung nötig — sie steht
trotzdem in HERKUNFT.md, weil man wissen soll, woher ein Mensch im Blickfeld
kommt.

Es ist ein geschlechtsneutrales Basisnetz: MakeHuman erzeugt daraus erst durch
Modifikatoren männliche oder weibliche Körper. Genau das ist hier gewollt — es
steht für „ein Mensch", nicht für eine bestimmte Person.

**Regionen.** Das Netz steht in A-Haltung, die Arme also schräg abgespreizt.
Feste Quader träfen das nicht. Stattdessen bekommt jeder Punkt die Region des
nächstgelegenen *Knochens* — der Strecke zwischen zwei Gelenkmittelpunkten, die
MakeHuman als eigene Gruppen (`joint-l-elbow` …) mitliefert. Das ist dieselbe
Zuordnung, die auch ein Skinning benutzt, und trifft Schulter und Hüfte richtig.

Aus den zugeordneten Punkten fallen zum Schluss die Trefferquader je Region
heraus; sie werden ausgegeben und gehören nach js/body.js. Damit ist der
Quader, auf den gezeigt wird, genau die Hülle dessen, was man sieht.
"""

import json
import struct
import sys
import urllib.request
from pathlib import Path

import numpy as np

SOURCE_URL = (
    "https://raw.githubusercontent.com/makehumancommunity/makehuman/"
    "master/makehuman/data/3dobjs/base.obj"
)
HERE = Path(__file__).parent
OUT_DIR = HERE / "assets" / "body"
CACHE = Path(__file__).parent / ".cache-base.obj"

# Knochen: Region → (Gelenk A, Gelenk B). Die Reihenfolge ist egal, es zählt
# nur der Abstand zur Strecke dazwischen.
#
# Achtung bei der Wirbelsäule: MakeHuman zählt `spine-1` **oben** (Brusthöhe,
# y ≈ 0,75) und `spine-4` unten am Becken (y ≈ 0,56) — genau andersherum, als
# man es beim Lesen des Namens vermutet.
BONES = [
    ("kopf",           "joint-head",         "joint-head-2"),
    ("hals",           "joint-neck",         "joint-head"),
    ("thorax",         "joint-spine-1",      "joint-neck"),
    ("abdomen",        "joint-spine-3",      "joint-spine-1"),
    ("becken",         "joint-pelvis",       "joint-spine-4"),
    ("arm-li-ober",    "joint-l-shoulder",   "joint-l-elbow"),
    ("arm-li-unter",   "joint-l-elbow",      "joint-l-hand"),
    ("arm-re-ober",    "joint-r-shoulder",   "joint-r-elbow"),
    ("arm-re-unter",   "joint-r-elbow",      "joint-r-hand"),
    ("bein-li-ober",   "joint-l-upper-leg",  "joint-l-knee"),
    ("bein-li-unter",  "joint-l-knee",       "joint-l-foot-1"),
    ("bein-re-ober",   "joint-r-upper-leg",  "joint-r-knee"),
    ("bein-re-unter",  "joint-r-knee",       "joint-r-foot-1"),
]

# Reihenfolge im Netz und in js/body.js — muss zusammenpassen.
REGION_ORDER = [b[0] for b in BONES]


def fetch_source() -> Path:
    if CACHE.exists() and CACHE.stat().st_size > 1_000_000:
        return CACHE
    print(f"lade {SOURCE_URL}")
    with urllib.request.urlopen(SOURCE_URL, timeout=120) as r:
        data = r.read()
    if b"CC0" not in data[:2048]:
        sys.exit("Abbruch: im Kopf der Quelldatei steht kein CC0-Hinweis mehr. "
                 "Lizenz von Hand prüfen, bevor das Netz ins Repo geht.")
    CACHE.write_bytes(data)
    return CACHE


def parse_obj(path: Path):
    """→ (alle Vertices, Flächen der Gruppe `body`, Mittelpunkt je Gelenk)."""
    verts = []
    body_faces = []
    joints = {}
    group = None
    for line in path.read_text(errors="replace").splitlines():
        if line.startswith("v "):
            _, x, y, z = line.split()[:4]
            verts.append((float(x), float(y), float(z)))
        elif line.startswith("g "):
            group = line.split()[1]
        elif line.startswith("f "):
            idx = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]
            if group == "body":
                body_faces.append(idx)
            elif group and group.startswith("joint-"):
                joints.setdefault(group, set()).update(idx)
    V = np.array(verts, dtype=np.float64)
    centres = {name: V[sorted(ix)].mean(axis=0) for name, ix in joints.items()}
    return V, body_faces, centres


def normalise(V, used, centres):
    """Füße auf y = 0, Scheitel auf y = 1, Brustmitte auf x = z = 0."""
    P = V[used]
    lo, hi = P[:, 1].min(), P[:, 1].max()
    height = hi - lo

    def to_model(a):
        a = (a - np.array([0.0, lo, 0.0])) / height
        return a

    P = to_model(V)                       # alle, damit Gelenke mitwandern
    torso = P[used][(P[used][:, 1] > 0.60) & (P[used][:, 1] < 0.85)]
    shift = np.array([P[used][:, 0].mean(), 0.0, torso[:, 2].mean()])
    P -= shift
    jc = {k: (to_model(v) - shift) for k, v in centres.items()}
    return P, jc


def segment(P, used, jc):
    """Jedem benutzten Punkt die Region des nächsten Knochens geben."""
    missing = [n for _, a, b in BONES for n in (a, b) if n not in jc]
    if missing:
        sys.exit("Gelenke fehlen in der Quelle: " + ", ".join(sorted(set(missing))))

    pts = P[used]
    best = np.full(len(pts), np.inf)
    who = np.zeros(len(pts), dtype=np.int32)

    for i, (_, a, b) in enumerate(BONES):
        A, B = jc[a], jc[b]
        AB = B - A
        L2 = float(AB @ AB) or 1e-9
        t = np.clip(((pts - A) @ AB) / L2, 0.0, 1.0)[:, None]
        d = np.linalg.norm(pts - (A + t * AB), axis=1)
        hit = d < best
        best[hit] = d[hit]
        who[hit] = i
    return who


def build():
    src = fetch_source()
    V, faces, centres = parse_obj(src)
    if not faces:
        sys.exit("Keine Gruppe `body` in der Quelle gefunden.")
    if any(len(f) != 4 for f in faces):
        sys.exit("Unerwartete Flächen: erwartet werden nur Vierecke.")

    used = np.unique(np.array(faces, dtype=np.int64))
    remap = np.full(V.shape[0], -1, dtype=np.int64)
    remap[used] = np.arange(len(used))

    P, jc = normalise(V, used, centres)
    region_of_vertex = segment(P, used, jc)
    pos = P[used].astype(np.float32)

    # Vierecke zu Dreiecken; jedes Dreieck bekommt die häufigste Region seiner
    # Ecken (bei Gleichstand die des ersten — die Naht liegt dann am Knochen).
    tris = []
    for a, b, c, d in faces:
        tris.append((remap[a], remap[b], remap[c]))
        tris.append((remap[a], remap[c], remap[d]))
    T = np.array(tris, dtype=np.int64)

    counts = np.zeros((len(T), len(BONES)), dtype=np.int16)
    for k in range(3):
        np.add.at(counts, (np.arange(len(T)), region_of_vertex[T[:, k]]), 1)
    tri_region = counts.argmax(axis=1)

    # Glatte Normalen: Flächennormalen an den Ecken aufsummieren.
    e1 = pos[T[:, 1]] - pos[T[:, 0]]
    e2 = pos[T[:, 2]] - pos[T[:, 0]]
    fn = np.cross(e1, e2)
    nrm = np.zeros_like(pos)
    for k in range(3):
        np.add.at(nrm, T[:, k], fn)
    ln = np.linalg.norm(nrm, axis=1, keepdims=True)
    nrm = (nrm / np.where(ln < 1e-12, 1.0, ln)).astype(np.float32)

    # Nach Region sortieren, damit jede ein zusammenhängender Abschnitt ist.
    order = np.argsort(tri_region, kind="stable")
    T = T[order]
    tri_region = tri_region[order]

    ranges, boxes = [], {}
    for i, name in enumerate(REGION_ORDER):
        sel = np.nonzero(tri_region == i)[0]
        if len(sel) == 0:
            sys.exit(f"Region {name} bekam keine Fläche — Knochenliste prüfen.")
        ranges.append({"id": name, "start": int(sel[0]) * 3, "count": len(sel) * 3})
        rp = pos[np.unique(T[sel])]
        lo, hi = rp.min(axis=0), rp.max(axis=0)
        boxes[name] = ((lo + hi) / 2, (hi - lo) / 2)

    # Die Rumpfregionen sitzen übereinander und ihre gefitteten Hüllen
    # überlappen kräftig (der Bauch reicht bis in den Brustkorb). Zum Zeigen ist
    # das schlecht: der Strahl träfe zuerst die Hülle, deren Vorderseite zufällig
    # näher liegt. Deshalb wird die Säule Kopf–Becken in y sauber geteilt, an den
    # Mittellinien zwischen den Nachbarn. Arme und Beine bleiben, wie gefittet —
    # die trennt schon das x.
    column = ["becken", "abdomen", "thorax", "hals", "kopf"]
    cuts = []
    for a, b in zip(column, column[1:]):
        ca, ha = boxes[a]
        cb, hb = boxes[b]
        cuts.append((ca[1] + ha[1] + cb[1] - hb[1]) / 2)
    for i, name in enumerate(column):
        c, h = boxes[name]
        lo = cuts[i - 1] if i > 0 else c[1] - h[1]
        hi = cuts[i] if i < len(cuts) else c[1] + h[1]
        c = c.copy(); h = h.copy()
        c[1] = (lo + hi) / 2
        h[1] = (hi - lo) / 2
        boxes[name] = (c, h)

    if len(pos) > 65535:
        sys.exit(f"{len(pos)} Vertices passen nicht in Uint16-Indizes.")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    inter = np.empty((len(pos), 6), dtype=np.float32)
    inter[:, 0:3] = pos
    inter[:, 3:6] = nrm
    idx = T.reshape(-1).astype(np.uint16)
    blob = inter.tobytes() + idx.tobytes()
    if len(blob) % 4:                      # Indizes 4-Byte-ausgerichtet halten
        blob += b"\0" * (4 - len(blob) % 4)
    (OUT_DIR / "body.bin").write_bytes(blob)

    (OUT_DIR / "body.json").write_text(json.dumps({
        "vertices": int(len(pos)),
        "indices": int(len(idx)),
        "vertexBytes": int(inter.nbytes),
        "ranges": ranges,
        "source": SOURCE_URL,
        "license": "CC0-1.0",
        "note": "MakeHuman basemesh hm08, Gruppe body; normiert auf Höhe 1, "
                "Füße bei y=0, Brustmitte bei x=z=0, Gesicht nach +z.",
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    (OUT_DIR / "HERKUNFT.md").write_text(
        "# Körpermodell — Herkunft\n\n"
        f"`body.bin` / `body.json` entstehen aus `make_body.py` aus dem\n"
        f"MakeHuman-Basisnetz (`basemesh hm08`):\n\n    {SOURCE_URL}\n\n"
        "Dieses Netz wurde im September 2020 ausdrücklich unter **CC0** gestellt;\n"
        "der Hinweis steht im Kopf der Quelldatei. Rechteinhaber zum Zeitpunkt\n"
        "der Freigabe: Data Collection AB (https://www.datacollection.se),\n"
        "Joel Palmius, Jonas Hauquier.\n\n"
        "CC0 verlangt keine Namensnennung. Sie steht hier trotzdem, weil\n"
        "nachvollziehbar sein soll, woher der Mensch im Blickfeld kommt.\n\n"
        "Es ist ein **geschlechtsneutrales** Basisnetz — MakeHuman formt daraus\n"
        "erst über Modifikatoren einen bestimmten Körper.\n\n"
        "Verarbeitet wurde: nur die Gruppe `body` (ohne Helfergeometrie und\n"
        "Gelenkwürfel), auf Höhe 1 normiert, in dreizehn Regionen zerlegt.\n",
        encoding="utf-8")

    print(f"{len(pos)} Vertices, {len(T)} Dreiecke, {len(blob)/1024:.0f} KB")
    print("\nTrefferquader für js/body.js (Modellraum, Höhe 1):")
    for name in REGION_ORDER:
        c, h = boxes[name]
        print(f'  {name:15s} box({c[0]:+.4f}, {c[1]:.4f}, {c[2]:+.4f}, '
              f'{h[0]:.4f}, {h[1]:.4f}, {h[2]:.4f})')


if __name__ == "__main__":
    build()
