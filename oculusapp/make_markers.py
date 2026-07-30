#!/usr/bin/env python3
"""Generate printable QR markers for the J.A.R. AR-Client.

Each patient in the scenario roster gets a QR code encoding "JAR-P<id>" — the
exact payload js/qr.js parses back into a marker id. Output:

  assets/markers/JAR-P<id>.svg   one crisp, printable QR per patient
  assets/markers/markers.html    a print sheet (QR + patient no. + triage class)

Run with the repo venv (segno is pure-Python):
    ../.venv/bin/python make_markers.py     # from inside "Oculus App/"
"""

import pathlib
import segno

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "assets" / "markers"
OUT.mkdir(parents=True, exist_ok=True)

# id -> (triage short label, colour) — mirrors CATEGORY_META in js/data.js and
# the scenario roster (Website/demo). Kept in sync manually; these decks/markers
# are static scenario props.
ROSTER = {
    1: ("ROT", "#e5484d"),
    2: ("ROT", "#e5484d"),
    3: ("GELB", "#f5b301"),
    4: ("GELB", "#f5b301"),
    5: ("GRÜN", "#46a758"),
    6: ("GRÜN", "#46a758"),
    7: ("GELB", "#f5b301"),
    8: ("ROT", "#e5484d"),
    9: ("GRÜN", "#46a758"),
    10: ("GELB", "#f5b301"),
    11: ("SCHWARZ", "#6f6f6f"),
    12: ("BLAU", "#3e7bfa"),
}


def build():
    cards = []
    for pid, (label, colour) in ROSTER.items():
        payload = f"JAR-P{pid}"
        # make_qr (not make) forces a standard QR — segno.make() would emit a
        # Micro QR for such short payloads, which jsQR / most phone scanners
        # cannot read. border=4 is the spec-required quiet zone.
        qr = segno.make_qr(payload, error="q")  # 25% error correction — robust to wear
        svg_name = f"{payload}.svg"
        qr.save(OUT / svg_name, kind="svg", scale=10, border=4, dark="#101418", light="#ffffff")
        cards.append(
            f'''<figure class="card">
      <img src="{svg_name}" alt="QR {payload}">
      <figcaption>
        <span class="pid">Patient #{pid}</span>
        <span class="cat" style="--c:{colour}">{label}</span>
        <span class="code">{payload}</span>
      </figcaption>
    </figure>'''
        )

    sheet = f"""<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8">
<title>J.A.R. — Patienten-Marker</title>
<style>
  @page {{ margin: 12mm; }}
  body {{ font-family: "Helvetica Neue", Arial, sans-serif; color: #101418; margin: 0; padding: 16px; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  p.note {{ color: #555; font-size: 13px; margin: 0 0 18px; max-width: 70ch; }}
  .grid {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }}
  .card {{ border: 1px solid #d5d9de; border-radius: 12px; padding: 12px; margin: 0; text-align: center; break-inside: avoid; }}
  .card img {{ width: 100%; max-width: 190px; height: auto; }}
  figcaption {{ display: flex; flex-direction: column; gap: 3px; margin-top: 8px; }}
  .pid {{ font-weight: 800; font-size: 17px; }}
  .cat {{ font-weight: 800; font-size: 13px; letter-spacing: .5px; color: var(--c); }}
  .code {{ font-family: monospace; font-size: 12px; color: #7a828a; }}
</style></head>
<body>
  <h1>J.A.R. AR-Client — Patienten-Marker</h1>
  <p class="note">Ausdrucken und am Patienten anbringen. Im Kamera-Modus scannt die
  App den Code und ruft den Datensatz auf; im AR-Modus (Quest) nennt der Code die
  Patientennummer für die Sprach-/Controller-Auswahl. Payload: <code>JAR-P&lt;Nr&gt;</code>.</p>
  <div class="grid">
    {"".join(cards)}
  </div>
</body></html>
"""
    (OUT / "markers.html").write_text(sheet, encoding="utf-8")
    print(f"Wrote {len(ROSTER)} markers + markers.html to {OUT}")


if __name__ == "__main__":
    build()
