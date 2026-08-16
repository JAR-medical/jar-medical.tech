#!/usr/bin/env python3
"""Die App-Symbole erzeugen — assets/icon/.

Sie sind das, was auf der HoloLens 2 (und auf jedem Handy) im Startmenü steht,
sobald die Seite als App installiert ist. Deshalb liegen sie hier als Skript und
nicht als eingecheckte Handarbeit: Farbe und Wortmarke stehen an genau einer
Stelle, zusammen mit dem Rest der Palette.

    ../../.venv/bin/python make_icons.py

Zwei Sorten, und der Unterschied ist keine Förmlichkeit:

  icon-*.png       normal. Wird so gezeigt, wie es ist.
  icon-maskable    „maskable". Manche Systeme schneiden ein Symbol auf ihre
                   eigene Form zu — rund, Kreis, abgerundetes Quadrat. Wer dafür
                   kein eigenes Bild mitliefert, bekommt sein Motiv beschnitten.
                   Hier sitzt deshalb alles Wichtige in den mittleren 80 %.
"""

from PIL import Image, ImageDraw, ImageFont

# Dieselben Farben wie css/hud.css und js/hudscreen.js.
BG = (16, 20, 24)
RED = (229, 72, 77)
INK = (232, 237, 242)

FONT = "/System/Library/Fonts/Helvetica.ttc"
BOLD = 1                     # Index der fetten Schnittlage in der .ttc

OUT = "assets/icon"
SIZES = (192, 512)


def font_at(px):
    """Helvetica Bold in der gewünschten Größe, mit Rückfall auf die Standardschrift."""
    try:
        return ImageFont.truetype(FONT, px, index=BOLD)
    except (OSError, IOError):
        return ImageFont.load_default()


def centred(draw, text, font, cx, cy, fill):
    """Text auf einen Punkt zentrieren — optisch, nicht nach Kastenmaß."""
    left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
    draw.text((cx - (right + left) / 2, cy - (bottom + top) / 2), text, font=font, fill=fill)


def icon(size, maskable=False):
    """
    Ein Symbol zeichnen.

    Bei `maskable` bleibt außen ein Fünftel frei: das ist die Zone, die ein
    System wegschneiden darf. Die Wortmarke wird entsprechend kleiner, statt
    näher an den Rand zu rücken — sonst stünde sie zwar im sicheren Bereich,
    aber gedrängt.
    """
    img = Image.new("RGB", (size, size), BG)
    d = ImageDraw.Draw(img)

    safe = 0.80 if maskable else 1.0
    inner = size * safe

    # Der Ring: derselbe Bodenmarker, der in der Brille über jedem Patienten
    # liegt — gestrichelt heißt dort „ungesichtet". Hier steht er geschlossen
    # und nur als Andeutung, damit die Wortmarke die Hauptsache bleibt.
    r = inner * 0.40
    w = max(2, int(size * 0.030))
    box = (size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r)
    d.ellipse(box, outline=RED, width=w)

    centred(d, "J.A.R.", font_at(int(inner * 0.21)), size / 2, size / 2 - inner * 0.045, INK)
    centred(d, "AR", font_at(int(inner * 0.10)), size / 2, size / 2 + inner * 0.14, RED)
    return img


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    written = []
    for s in SIZES:
        p = f"{OUT}/icon-{s}.png"
        icon(s).save(p)
        written.append(p)
    p = f"{OUT}/icon-maskable-512.png"
    icon(512, maskable=True).save(p)
    written.append(p)

    for p in written:
        print(f"  {p}  {os.path.getsize(p) / 1024:.1f} kB")


if __name__ == "__main__":
    main()
