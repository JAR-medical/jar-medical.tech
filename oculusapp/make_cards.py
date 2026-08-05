#!/usr/bin/env python3
"""Druckbogen der Patientenumhängekarten für den J.A.R. AR-Client.

Eine Karte je Patient, zum Ausdrucken, Ausschneiden und Umhängen. Auf der Karte
steht ein QR-Code mit der Nutzlast "JAR-P<id>" — genau das, was js/qr.js zurück
in eine Patientennummer übersetzt.

Bewusst NICHT auf der Karte: die Sichtungskategorie. Der Ablauf ist ja gerade,
dass der Trupp den Patienten sichtet und das Ergebnis danach auf die Karte
bucht; stünde es schon gedruckt darauf, wäre die Übung wertlos. Zum Eintragen
von Hand gibt es stattdessen Ankreuzfelder — so wie auf der echten
Verletztenanhängekarte, die das Ding hier ersetzen soll.

Ausgabe (eine einzige, selbsttragende Datei — die SVGs stecken inline drin):

    assets/markers/patientenkarten.html

Aufruf:
    ../../.venv/bin/python make_cards.py        # aus "Website/oculusapp/"
"""

import io
import pathlib
import re

import segno

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE / "assets" / "markers" / "patientenkarten.html"

# Nur die Nummern — alles Medizinische entsteht erst bei der Sichtung.
PATIENTS = list(range(1, 13))

CARDS_PER_PAGE = 4

CATEGORIES = [
    ("SK I", "rot", "#e5484d"),
    ("SK II", "gelb", "#f5b301"),
    ("SK III", "grün", "#46a758"),
    ("SK IV", "blau", "#3e7bfa"),
    ("tot", "schwarz", "#222222"),
]


def qr_svg(payload: str) -> str:
    """QR als Inline-SVG ohne XML-Deklaration, damit es in die Seite passt.

    Fehlerkorrektur H ist hier nicht nur Vorsicht, sondern Notwendigkeit: bei
    niedrigeren Stufen wählt segno für so kurze Nutzlasten ein **Micro-QR**
    (M3/M4), und der im Kamera-Modus benutzte Decoder jsQR liest Micro-QR nicht.
    H erzwingt ein normales QR Version 1 (21 Module) — und übersteht nebenbei
    Knicke und Dreck auf einer Karte, die am Patienten hängt.

    Die Größenangaben bleiben am SVG stehen und bekommen zusätzlich eine
    viewBox: ohne beides hat die Grafik kein Seitenverhältnis und rastert beim
    Verkleinern falsch — dann liest sie kein Scanner mehr.
    """
    qr = segno.make(payload, error="h")
    scale, border = 10, 4
    side = qr.symbol_size(scale=scale, border=border)[0]

    buf = io.BytesIO()
    qr.save(buf, kind="svg", scale=scale, border=border, dark="#101418", light="#ffffff")
    svg = buf.getvalue().decode("utf-8")
    svg = re.sub(r"<\?xml[^>]*\?>\s*", "", svg)
    if "viewBox" not in svg:
        svg = svg.replace("<svg ", f'<svg viewBox="0 0 {side} {side}" ', 1)
    return svg


def card(pid: int) -> str:
    boxes = "".join(
        f'<span class="kat"><span class="box" style="--c:{color}"></span>'
        f'<span class="kat-t">{sk}<em>{name}</em></span></span>'
        for sk, name, color in CATEGORIES
    )
    return f"""      <article class="card">
        <div class="hole" aria-hidden="true"></div>
        <header>
          <span class="marke">J.A.R.</span>
          <span class="typ">Patientenumhängekarte · Übung</span>
        </header>

        <div class="oben">
          <div class="qr">{qr_svg(f"JAR-P{pid}")}</div>
          <div class="nr">
            <span class="nr-l">Patient</span>
            <strong>#{pid}</strong>
            <span class="code">JAR-P{pid}</span>
          </div>
        </div>

        <section class="kats">
          <span class="feld-l">Sichtungskategorie</span>
          <div class="kat-reihe">{boxes}</div>
        </section>

        <section class="felder">
          <div class="zeile"><span class="feld-l">Maßnahmen</span><span class="linie"></span></div>
          <div class="zeile"><span class="feld-l">Befund</span><span class="linie"></span></div>
          <div class="zeile schmal">
            <span class="feld-l">Uhrzeit</span><span class="linie kurz"></span>
            <span class="feld-l">Trupp</span><span class="linie kurz"></span>
          </div>
        </section>
      </article>"""


def build() -> pathlib.Path:
    pages = []
    for start in range(0, len(PATIENTS), CARDS_PER_PAGE):
        chunk = PATIENTS[start:start + CARDS_PER_PAGE]
        pages.append('    <div class="bogen">\n' +
                     "\n".join(card(pid) for pid in chunk) +
                     "\n    </div>")

    html = f"""<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>J.A.R. — Patientenumhängekarten</title>
<style>
  /* Für den Druck gebaut: A4, vier Karten je Bogen, echte Millimeter. */
  @page {{ size: A4 portrait; margin: 8mm; }}

  :root {{
    --tinte: #101418;
    --grau: #6b7078;
    --linie: #b9bec4;
  }}

  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: var(--tinte);
    background: #e9ebee;
  }}

  .hinweis {{
    max-width: 190mm;
    margin: 10mm auto 6mm;
    padding: 6mm 7mm;
    background: #fff;
    border-left: 3px solid #101418;
    font-size: 10.5pt;
    line-height: 1.5;
  }}
  .hinweis h1 {{ font-size: 13pt; margin: 0 0 2mm; }}
  .hinweis p {{ margin: 0 0 2mm; }}
  .hinweis code {{ font-family: ui-monospace, Menlo, monospace; }}
  @media print {{ .hinweis {{ display: none; }} }}

  .bogen {{
    width: 194mm;
    margin: 0 auto 8mm;
    display: grid;
    grid-template-columns: repeat(2, 95mm);
    grid-auto-rows: 133mm;
    gap: 4mm;
    justify-content: center;
    break-after: page;
  }}
  .bogen:last-child {{ break-after: auto; }}

  .card {{
    position: relative;
    background: #fff;
    border: 1px dashed var(--linie);      /* Schnittkante */
    padding: 6mm 6mm 5mm;
    display: flex;
    flex-direction: column;
    gap: 3.5mm;
    break-inside: avoid;
  }}

  /* Markierung fürs Loch, durch das die Schnur kommt. */
  .hole {{
    position: absolute; top: 4mm; right: 6mm;
    width: 4mm; height: 4mm;
    border: 1px solid var(--linie); border-radius: 50%;
  }}

  header {{ display: flex; align-items: baseline; gap: 3mm; }}
  .marke {{ font-weight: 800; font-size: 11pt; letter-spacing: .5px; }}
  .typ {{ font-size: 7pt; letter-spacing: .10em; text-transform: uppercase; color: var(--grau); }}

  .oben {{ display: flex; align-items: center; gap: 5mm; }}
  .qr {{ width: 46mm; flex: none; }}
  .qr svg {{ width: 100%; height: auto; display: block; }}

  .nr {{ display: flex; flex-direction: column; gap: 1mm; }}
  .nr-l {{ font-size: 7.5pt; letter-spacing: .12em; text-transform: uppercase; color: var(--grau); }}
  .nr strong {{ font-size: 30pt; line-height: 1; font-weight: 800; }}
  .code {{ font-family: ui-monospace, Menlo, monospace; font-size: 8pt; color: var(--grau); }}

  .feld-l {{
    font-size: 7pt; letter-spacing: .12em; text-transform: uppercase;
    color: var(--grau); white-space: nowrap;
  }}

  .kats {{ display: flex; flex-direction: column; gap: 1.5mm; }}
  .kat-reihe {{ display: flex; gap: 2mm; }}
  .kat {{ display: flex; align-items: center; gap: 1.2mm; }}
  .box {{
    width: 5mm; height: 5mm; flex: none;
    border: 1.2pt solid var(--c); background: color-mix(in srgb, var(--c) 12%, #fff);
  }}
  .kat-t {{ display: flex; flex-direction: column; line-height: 1.1; }}
  .kat-t {{ font-size: 7.5pt; font-weight: 700; }}
  .kat-t em {{ font-style: normal; font-weight: 400; font-size: 6.5pt; color: var(--grau); }}

  .felder {{ display: flex; flex-direction: column; gap: 3mm; margin-top: auto; }}
  .zeile {{ display: flex; align-items: flex-end; gap: 2mm; }}
  .zeile.schmal {{ gap: 2mm; }}
  .linie {{ flex: 1; border-bottom: .8pt solid var(--linie); height: 6mm; }}
  .linie.kurz {{ flex: 0 1 22mm; }}
</style>
</head>
<body>
  <div class="hinweis">
    <h1>Patientenumhängekarten — {len(PATIENTS)} Stück</h1>
    <p><strong>Drucken</strong> (A4, ohne Skalierung — „tatsächliche Größe“), ausschneiden,
    oben rechts lochen und dem Patienten umhängen.</p>
    <p><strong>Ablauf:</strong> Patient sichten, dann diese Karte scannen — der AR-Client
    bucht die ermittelte Sichtungskategorie auf genau diese Nummer. Die Kategorie steht
    absichtlich <em>nicht</em> gedruckt auf der Karte; angekreuzt wird sie von Hand als
    Rückfallebene, falls die Brille ausfällt.</p>
    <p>Nutzlast je Code: <code>JAR-P&lt;Nr&gt;</code>. Fehlerkorrektur H, damit ein
    geknickter oder verschmutzter Code noch liest.</p>
  </div>

{chr(10).join(pages)}
</body>
</html>
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")
    return OUT


if __name__ == "__main__":
    path = build()
    print(f"{path.relative_to(HERE)} — {len(PATIENTS)} Karten, "
          f"{-(-len(PATIENTS) // CARDS_PER_PAGE)} Seiten")
