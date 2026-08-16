# J.A.R. AR-Client — Sichtung im Blickfeld

Der **Trupp-Teil** von J.A.R. Medical / **TriARge**. Läuft im Headset-Browser auf
**PICO 4 (Enterprise)**, **Meta Quest** und **Microsoft HoloLens 2** über WebXR,
flach auch auf Handy oder Laptop. Gegenstück zum Lagebild der Einsatzleitung in
`../demo`.

Der Ablauf, von vorn bis hinten:

```
Tätigkeit wählen ─▶ Lagekarte ─▶ „Neuer Patient" (Stelle am Boden zeigen)
                 ─▶ was die Tätigkeit vorsieht ─▶ nächster
```

- **Zuerst die Tätigkeit.** Im MANV macht nicht dieselbe Person alles. Beim Start
  wird gewählt, worin man eingesetzt ist — **Vorsichtung**, **Sichtung
  (ärztlich)**, **Registrierung** oder **Behandlung & Transport**. Das ist keine
  Beschriftung: die Wahl bestimmt, was passiert, wenn du einen Patienten
  öffnest, und ob du überhaupt neue anlegen kannst. Gewechselt wird jederzeit
  über die Lage. Siehe [Die vier Tätigkeiten](#die-vier-tätigkeiten).
- **Kein mitgelieferter Datensatz.** Der Einsatz beginnt leer. Wer vor dir liegt,
  wird angelegt — in AR **an der Stelle, auf die du zeigst**: ein Ring wandert
  über den Boden, auslösen setzt ihn fest. Flach (Handy, Laptop) entsteht der
  Patient dort, wo du stehst. Diese Position hält die Lagekarte fest.
- **Karte kommt zuletzt.** Erst sichten, dann eine Umhängekarte umhängen und ihre
  Nummer zuweisen — per Scan oder von Hand. Die Karten sind austauschbare
  Rohlinge; welche an welchen Patienten geht, entscheidet sich im Einsatz. Eine
  Karte kann nur an einem Hals hängen, und die App bucht sie nicht still um.
- **Es ist ein HUD, kein Fenster.** Randinformation kopffest an den Rändern des
  Blickfelds, die Mitte bleibt frei. Es steht still, bis der Blick 40°
  abgewandert ist, und zieht dann in einem Zug um. Solange kein Schritt ansteht,
  gibt es **gar keinen großen Schirm**: „Neuer Patient" und „Tätigkeit" sind zwei
  kleine Knöpfe am unteren Rand, sonst schaust du einfach durch.
- **Marker liegen am Boden.** Über jedem angelegten Patienten liegt ein Ring an
  seiner Stelle — gefüllt in der Sichtungsfarbe, gestrichelt solange ungesichtet.
  Alle liegen auf **einer** Bodenebene, nicht auf dem y-Wert, den ihre Akte
  gerade trug. Der Marker **ist** die Schaltfläche: einen Patienten öffnest du,
  indem du seinen Marker anklickst. Von selbst geht nichts auf.
- **Herantreten zeigt, wer da liegt.** Ab drei Metern steigt über dem Marker eine
  kleine Anzeige auf: Nummer, Sichtungskategorie, Karte, ob schon etwas
  festgehalten wurde. Sie ist nicht bedienbar und fährt wieder ein, wenn du
  weitergehst — geöffnet wird weiterhin nur, was du anklickst.
- **Alles zu einem Patienten bleibt bei diesem Patienten.** Handlungskarte,
  Körpermodell und Anzeige stehen raumfest über seinem Marker und wandern nicht
  mit. (Die Karte wurde früher vor den Träger geholt, wenn sie länger aus dem
  Blick war. Das ist raus: was einem bestimmten Patienten gehört, darf nicht
  woanders auftauchen — wer sie sucht, dreht sich zu dem, an dem er arbeitet.)
- **Ein Körper zum Drehen.** Am geöffneten Patienten steht neben der
  Handlungskarte ein **echter Mensch** — das MakeHuman-Basisnetz, CC0 und
  geschlechtsneutral (siehe [Das Körpermodell](#das-körpermodell)), zerlegt in
  dreizehn Regionen. Mit dem Controller greifen und ziehen dreht ihn; nur mit
  Blick dreht er sich von selbst weiter und hält an, sobald der Blick auf einem
  Körperteil liegt. Region antippen → Befund wählen. Regionen mit Befund sind
  rot. Dieselbe Figur steht klein neben jeder Anzeige über einem Marker, dort in
  der Sichtungsfarbe — man sieht aus einigen Metern, wer da liegt und wo es ihn
  erwischt hat.
- **Sprechen statt tippen.** Die Vorsichtung ist ein Fragebogen aus Ja und Nein
  — genau das, was sich sagen lässt, während beide Hände am Patienten sind. Der
  Knopf **Sprechen** schaltet das Mikrofon zu; „ja", „nein", „zurück" und
  „weiter" bedienen den Ablauf. Die Erkennung läuft **nur lokal auf dem Gerät**
  (`processLocally`) — kann der Browser das nicht zusichern, bleibt das Mikrofon
  aus. Patiententon gehört nicht auf fremde Server, und Netz gibt es an der
  Einsatzstelle womöglich sowieso nicht. Die Knöpfe bleiben daneben bestehen: im
  Lärm einer Einsatzstelle darf die Bedienung nicht am Mikrofon hängen.
- **Ein Armband aus Papier statt Knöpfen im Blickfeld.** Sechs Felder auf einem
  Streifen am linken Unterarm, jedes mit ArUco-Marker und Zeichen: Ja, Nein,
  Zurück, Patient, Tätigkeit, Lagebild. Berühren löst aus. Liegt das Armband
  griffbereit, verschwindet die Knopfreihe am Blickfeldrand — siehe
  [Das Armband](#das-armband). Druckbogen:
  `assets/panel/armband.pdf`.
- **Zum Lagebild.** Der Randknopf **Lagebild** führt zur Live-Demo der
  Einsatzleitung (`../demo/`) — dasselbe Lagebild wie auf der Website. Sie ist
  eine gewöhnliche Webseite und lässt sich nicht in die AR-Ebene legen; aus der
  Brille heraus wird deshalb die Sitzung beendet und die Seite flach geöffnet.
- **Bedienung im Browser: Blick + Verweilen.** Fadenkreuz in der Blickmitte, 1,1 s
  auf einem Knopf löst aus. Controller gehen auch (Strahl + Trigger), und wo es
  Hände gibt (HoloLens 2), auch die. **Der PICO-Browser stellt die
  WebXR-Hand-Input-Schnittstelle nicht bereit** — dort trägt der Blick. Wer
  Handtracking auf PICO will, nimmt den nativen Build (`Unity/README-PICO.md`).
- **Es bewegt sich nichts nach Drehbuch.** Alles, was umzieht, aufsteigt oder
  nachläuft, läuft über Federn (`js/motion.js`): sie rechnen vom Ist-Wert und
  der Ist-Geschwindigkeit weiter und lassen sich deshalb mitten in der Bewegung
  greifen und umlenken, ohne zu springen. Wer das drehende Körpermodell
  anstößt, gibt ihm seine Geschwindigkeit mit; wer es wieder greift, hat es
  sofort. Siehe [Bewegung](#bewegung).
- **mSTaRT** — sechs Ja/Nein-Fragen, jede vorgelesen, Schritt-zurück inklusive.
- **Nichts wird erklärt.** Im Blickfeld steht kein Satz, den jemand mit
  Sanitäterausbildung nicht ohnehin weiß: keine Erläuterung zu den
  mSTaRT-Fragen, keine Bedienhinweise, keine Dauerzeile unten rechts. Dort
  erscheint nur noch, was das Gerät meldet — eine fehlende Kamera etwa. Der
  Warnhinweis, dass das kein Medizinprodukt ist, steht auf der Startseite und
  einmal bei der Tätigkeitswahl.

⚠️ **Übungszweck** — Schülerprojekt, kein Medizinprodukt. Die Sichtungskategorie
ist ein Vorschlag, die Verantwortung bleibt bei der Person mit der Brille.

Alles ist eine **statische Web-App** (kein Build, kein Backend); der Einsatz lebt
im Speicher der Sitzung.

---

## Run it

WebXR requires **HTTPS** (or `localhost`).

**A) The deployed copy** — this folder is served from the project website; open it
in the **PICO Browser** and tap **AR-Modus**.

**B) Local**
```sh
python3 -m http.server 8765          # http://<mac-ip>:8765
```
`localhost` is a secure context; for AR on a headset over the network you still
need HTTPS (a tunnel like `cloudflared`, or the deployed copy).

**Umhängekarten drucken:** `assets/markers/patientenkarten.pdf` (A4, 3 Seiten,
12 Karten) — oder `patientenkarten.html` im Browser drucken, **ohne Skalierung**.
Ausschneiden, oben rechts lochen. Es sind nummerierte Rohlinge: welchem
Patienten eine Karte gehört, entscheidest du im Einsatz.

---

## The three modes

| Modus | Was er tut | Wo er läuft |
|------|--------------|---------------|
| **AR-Modus** | Passthrough bzw. durchsichtiges Glas, Lagekarte und Ablauf auf einer WebGL-Ebene, bedient per Blick, Hand oder Controller. | PICO / Quest / HoloLens 2 |
| **Kamera-Modus** | Derselbe Ablauf flach, mit echtem QR-Scan der Karte. | Handy / Laptop |
| **Simulation** | Derselbe Ablauf ohne Kamera und ohne Headset. | überall |

Die Startseite prüft das Gerät und sperrt, was es nicht kann.

**Deep link:** `index.html?mode=sim` springt direkt in eine Betriebsart.

### Kein Spielbereich

Die App verlangt **keine gezeichnete Fläche**. `bounded-floor` — das einzige
WebXR-Merkmal, für das die Brille eine eingerichtete Spielfläche braucht — wird
nie angefordert; als Bezugsraum genügt `local-floor`, und wenn auch das nicht zu
haben ist, läuft alles mit `local` weiter und die Bodenhöhe wird einmal aus der
Kopfhöhe geschätzt (dann steht beim Start „Bodenhöhe geschätzt"). Die
Sitzungsanforderung hat drei Stufen und die letzte verlangt gar nichts.

Fragt die Brille beim Start trotzdem nach einer Fläche, ist das **ihre eigene
Sicherheitsgrenze** und nicht diese App — eine Systemeinstellung, an die eine
Webseite nicht herankommt. Abhilfe: in den Einstellungen der Brille von
Raumgröße auf **stationär / Sitzmodus** umstellen; dann wird nur noch die
Bodenhöhe bestätigt. Wie das Menü heißt, unterscheidet sich je nach Gerät und
Firmware (Quest: Physischer Raum → Grenze; PICO: Sicherheitsgrenze).

---

## HoloLens 2

Eine HoloLens 2 ist keine Quest mit weniger Blickfeld, sondern eine andere Art
von Anzeige — und drei Dinge, die auf Passthrough die Lesbarkeit tragen, tragen
dort nichts. Alles davon steckt in `js/display.js`; entschieden wird nach dem,
was das **Gerät meldet**, nie nach der Browserkennung (die ist auf der HoloLens
ein gewöhnliches Windows-Edge und von einem Laptop nicht zu unterscheiden).

| | PICO / Quest | HoloLens 2 |
|---|---|---|
| `environmentBlendMode` | `alpha-blend` | `additive` |
| Blickfeld | rund 100° × 95° | **43° × 29°** |
| Schwarz | eine Farbe | **die Wirklichkeit** |
| Bequeme Entfernung | ab ~0,5 m | **ab ~1,25 m** (Optik auf 2 m scharf) |
| Hände im Browser | nein (PICO) | ja |

**Schwarz ist unsichtbar.** Ein additives Glas kann Licht nur hinzufügen, nie
wegnehmen. Jede dunkle Unterlage und jeder schwarze Saum um die Schrift — genau
die Mittel, mit denen diese Anzeige bisher über wechselndem Untergrund lesbar
blieb — sind dort schlicht nicht vorhanden. `setPalette(additive)` tauscht sie
deshalb aus: keine Flächen, keine Säume, dafür ein Schriftschnitt schwerer, eine
Spur weiter gesperrt, kräftigere Linien und sattere Farben. Rangfolge entsteht
über Größe, Gewicht und Farbe statt über Deckkraft — eine Abstufung nach unten
wäre hier eine Abstufung ins Nichts.

**Das Blickfeld wird ausgemessen, nicht angenommen.** Das HUD war auf 82° Breite
fest verdrahtet; davon lägen auf einer HoloLens beide oberen Ecken und die halbe
Lagekarte außerhalb des Glases. Statt einer zweiten festen Größe für ein zweites
Gerät rechnet `fitToFov` die Fläche aus der **Projektionsmatrix der ersten
Ansicht** — das trägt auch für Brillen, die es noch nicht gibt. Auf einer Quest
kommt dabei ungefähr die alte Größe heraus, auf einer HoloLens rund die Hälfte.

Dasselbe gilt für die **Handlungskarte**, und dort war es der Unterschied
zwischen „schwer zu lesen" und „gar nichts zu sehen": 0,56 m fest auf 1,6 m sind
38,6° — praktisch das ganze Blickfeld einer HoloLens 2. Sichtbar blieb ihre
leere Mitte, während Überschrift und Knopfreihe am Rand oder außerhalb lagen,
und auf additivem Glas gibt es keinen Fond, an dem man wenigstens gemerkt hätte,
dass da etwas ist. Eingepasst sind es 28° × 20°.

Auf kleinem Blickfeld wird bewusst **nicht ausgereizt** (`hudSafety`,
`cardSafety`): das HUD trägt seinen Inhalt in den Ecken, und eine Fläche, die
das Glas gerade eben ausfüllt, schiebt genau diese Ecken an den Rand des
Sichtbaren.

**Wenn doch nichts zu sehen ist.** `index.html?beacon=1` zeichnet ein Prüfbild
geradeaus, 1,5 m vor dem Auge, rund 23° breit. Es hängt an nichts — nicht am
HUD, nicht an der Kopfpose, nur an der Projektionsmatrix. Ist es da, stimmen
Sitzung, Puffer und Mischung, und das Problem liegt in der Anordnung. Ist es
nicht da, liegt es tiefer. Dazu fängt die Bildschleife Fehler ab und meldet sie
(`Bildfehler: …` in der Statuszeile und auf der Konsole), statt still ein leeres
Bild zu zeigen: das nächste Bild wird als Erstes angefordert, alles Zeichnen
kommt danach — wirft etwas dazwischen, liefe die Schleife sonst ewig weiter,
ohne je den Augenpuffer zu beschreiben.

**`immersive-ar` ist dort nicht selbstverständlich.** Edge auf der HoloLens 2 hat
die Betriebsart je nach Fassung gar nicht und wies zeitweise sogar
`hand-tracking` als *unbekanntes* Merkmal zurück. `sessionLadder()` geht deshalb
vier AR-Stufen von „mit allem" bis „ganz ohne Zusatzmerkmale" durch und nimmt
zuletzt eine `immersive-vr`-Sitzung — auf einem additiven Glas ist das kein
Notbehelf, sondern dasselbe Bild, weil der Augenpuffer durchsichtig gelöscht
wird und Schwarz dort ohnehin die Wirklichkeit ist. Meldet die so entstandene
Sitzung `opaque`, ist es doch eine geschlossene VR-Brille: dann wird sie wieder
beendet, statt jemanden in eine schwarze Kammer zu setzen.

Was sich damit **nicht** ändert: der Ablauf, die Bedienung und die Lagekarte
sind auf allen drei Geräten dieselben.

### Als App aufs Gerät

Ins Startmenü kommt sie **über Edge, nicht über einen Sideload**:

> Seite in Edge öffnen → `…` → **Apps** → **Diese Website als App installieren**

Danach steht sie mit Symbol im Startmenü wie jede andere App, öffnet in einem
eigenen Fenster ohne Browserleiste und läuft ohne Netz. Am Gerät ändert sich
dabei nichts: kein Entwicklermodus, kein Zertifikat, kein Device Portal, keine
Auswirkung auf andere Apps.

Möglich ist das durch `manifest.webmanifest` (Name, Symbole, eigenes Fenster)
und `sw.js` — ohne einen Service Worker mit `fetch`-Behandlung bietet Edge die
Installation gar nicht erst an. Symbole erzeugt `make_icons.py`.

**Warum kein `.appx` wie bei den anderen Apps.** Das wäre der übliche Weg für
eine native HoloLens-App, hier aber aus drei Gründen der falsche:

1. Ein `.appx` wird mit Windows-Werkzeugen gebaut und signiert (MakeAppx,
   SignTool). Auf macOS gibt es die nicht.
2. Sideloading verlangt, dass die Brille dem Signaturzertifikat traut — es müsste
   also eines installiert werden. Das ist genau die Änderung am Gerät, die hier
   nicht stattfinden soll.
3. Vor allem: eine als UWP verpackte Webseite läuft in einer **WebView**, und
   `immersive-ar` steht dort nicht zur Verfügung. Die App käme gar nicht mehr in
   den AR-Modus — ein Rückschritt, kein Fortschritt. Als installierte
   Edge-App läuft sie dagegen in derselben Engine wie im Browser.

### Bildrate

Die HUD-Ebene ist 1536 × 864 groß und wurde in **jedem Bild** neu gezeichnet und
als Textur hochgeladen — gut 5 MB je Bild, rund 300 MB/s. Der Grund war eine
einzige Zeile: die Lagekarte kommt im Frame-Takt herein (`setContent`), und das
galt pauschal als „hat sich geändert". Eine Quest trug das gerade so, eine
HoloLens 2 steht damit.

Gezeichnet wird jetzt nach `_hudSignature()`, und die ist zweigeteilt:

- **schnell** — was auf eine Eingabe antwortet (Knopf unter dem Zeiger,
  gedrückt, Verweilen). Ändert sich das, wird sofort gezeichnet; eine
  Rückmeldung, die auf den nächsten Takt wartet, fühlt sich tot an.
- **träge** — Lagekarte, Zählung, Statuszeile. Höchstens alle 80 ms, und die
  Kartenwerte sind gerundet, damit das Zittern der Kopfverfolgung allein nichts
  auslöst.

Dazu drei Dinge, die nur additive Geräte betreffen: keine Kantenglättung und
`framebufferScaleFactor 0.7` (die Anzeige besteht fast nur aus Texturrechtecken,
denen MSAA wenig gibt), und neben den Anzeigen über den Markern steht nur noch
**eine** Figur statt dreier — das Körpernetz hat 26 756 Dreiecke, und die fallen
je Auge an.

**Nachmessen:** `index.html?perf=1` stellt Bildrate und Zahl der Neuzeichnungen
unten rechts ins Blickfeld (`120 B/s · HUD 12× · Karte 0× · additiv …`). Ohne
Gerät lässt sich nicht sagen, was eine HoloLens 2 schafft — mit dem Schalter
sagt sie es selbst.

---

## Bewegung

`js/motion.js` — der Grund, warum hier nichts mehr mit fester Dauer läuft.

Eine Zeitkurve kann auf eine neue Eingabe nicht antworten. Wer eine Anzeige
anstößt und sie sofort wieder greift, bekommt einen Sprung; wer eine Bewegung
umlenkt, läuft gegen eine Wand, weil die alte Geschwindigkeit abgeschnitten
wird. Eine Feder rechnet dagegen immer vom **Ist-Wert und der
Ist-Geschwindigkeit** weiter — ein neues Ziel ist nur ein neues Ziel.

Beschrieben wird sie mit zwei Begriffen statt mit Masse/Steifigkeit/Dämpfung:

| | | |
|---|---|---|
| `damping` | 1,0 | aperiodischer Grenzfall, kein Überschwingen |
| | 0,8 | schwingt leicht über |
| `response` | 0,3–0,4 s | wie schnell sie am Ziel ist — **keine Dauer** |

Hausregel: alles läuft mit `damping 1,0`. Überschwingen gibt es nur da, wo die
Geste selbst Schwung hatte. Wo das im Einsatz ist:

- **Das HUD zieht um** über zwei Federn (Gier und Neigung getrennt — eine
  gemeinsame Feder auf dem Richtungsvektor liefe auseinander, sobald die Achsen
  verschieden schnell sind). Wer beim Umzug weiterdreht, lenkt die laufende
  Bewegung um, statt eine neue anzustoßen.
- **Die Anzeige über dem Marker** steigt über **eine** Feder auf und fährt über
  dieselbe wieder ein. Wer an der Grenze steht und einen Schritt zurückgeht,
  während sie noch aufgeht, sieht sie dort umdrehen, wo sie gerade ist.
- **Das Körpermodell** nimmt beim Loslassen die Geschwindigkeit der Hand mit und
  rollt genau die Strecke aus, die `project()` vorhersagt (Apples
  Exponentialform, nicht `v²/2a`). Zugreifen beendet den Nachlauf sofort und an
  Ort und Stelle.
- **Anschläge geben nach** statt hart zu stoppen: die Neigung des Modells und die
  Reichweite des Anlege-Rings laufen über `clampRubber`. Ein harter Stopp liest
  sich als „hängt", nachgebender Widerstand als „so weit und nicht weiter".
- **Gedrückt ist ein eigener Zustand** und erscheint, sobald der Trigger unten
  ist — nicht erst beim Auslösen. Dazwischen liegen leicht ein paar Zehntel, und
  in denen wüsste man sonst nicht, ob man getroffen hat.

**Weniger Bewegung.** Steht `prefers-reduced-motion` auf `reduce`, setzen alle
Federn sofort auf ihren Zielwert — die Anzeige ändert sich weiter, sie fliegt
nur nicht mehr. Dieselbe Einstellung wird an zwei Stellen beantwortet, weil es
zwei Systeme sind: `watchReducedMotion()` für die Federn, eine `@media`-Abfrage
für das CSS. Dazu `prefers-reduced-transparency` (Flächen frosten statt
verschwimmen) und `prefers-contrast` (fast deckend mit klarer Kante).

---

## Das Armband

Ein Stück Papier am linken Unterarm, sechs Felder, je ein ArUco-Marker und ein
Zeichen. Der Gedanke: die Hände sind am Patienten und der Blick ist beim
Patienten — eine Knopfreihe im Blickfeld ist beides nicht.

**Drucken:** `assets/panel/armband.pdf` (A4), oder `armband.html` im Browser
drucken. **Ohne Skalierung**, sonst stimmen die Markergrößen nicht. Ausschneiden,
auf festes Papier kleben oder laminieren, mit Gummi- oder Klettband um den Arm.
Matt drucken — Glanzpapier spiegelt, und ein gespiegelter Marker wird nicht
erkannt.

Alles über das Armband steht in **einer** Datei, `js/wristband.js`: welche
Felder es gibt, welcher Marker darauf sitzt, wie groß gedruckt wird und wann
eine Berührung als Druck zählt. Der Druckbogen erzeugt seine Marker mit
derselben Bibliothek, die sie später liest (`vendor/aruco.js`, js-aruco2, MIT) —
Druck und Erkennung können also nicht auseinanderlaufen.

### Zwei Wege, es zu erkennen

| | wie „berühren" erkannt wird | läuft auf |
|---|---|---|
| **Am Controller** | Das Band sitzt am Arm, der einen Controller hält — dessen Lage kennt die Brille, also auch die des Papiers. Berührt wird mit der Spitze des anderen Controllers. | PICO/Quest im Browser, **heute** |
| **Vor einer Kamera** | Ein Feld gilt als gedrückt, wenn sein Marker verdeckt ist. Kein Handtracking, keine Tiefe — nur ein Schwarzweißbild. | Kamera-Modus (Handy/Laptop), nativer Build |

**Im Headset-Browser gibt es keine Kamera** (siehe unten) — dort trägt der
Controller-Weg. Er braucht zwei Controller: einer trägt, einer zeigt. Ist nur
einer da, bleibt die Knopfreihe am Blickfeldrand stehen, damit man nicht ohne
Bedienung dasteht.

Beide Wege enden in derselben Handlung, und die geht denselben Weg wie
Gesprochenes (`Workflow.handleSpeech`) — „Ja" am Band, „ja" gesagt und der
JA-Knopf sind dieselbe Sache, an einer Stelle definiert.

### Warum Verdeckung und nicht Fingerverfolgung

Eine Kamera sieht keine Tiefe, und Handtracking gibt der PICO-Browser nicht her.
Ein Finger auf einem Marker macht ihn aber unsichtbar — und *das* sieht jede
Kamera. Deshalb trägt jedes Feld seinen eigenen Marker und das Band zusätzlich
zwei Anker an den Schmalseiten: fehlt genau ein Feld, während ein Anker noch zu
sehen ist, liegt dort ein Finger. Fehlen mehrere, ist das Band schräg oder halb
aus dem Bild — daraus wird bewusst keine Handlung.

Dazu drei Regeln gegen Fehlauslösung, alle in `wristband.js` und ohne Gerät
prüfbar: eine Berührung muss gut zwei Zehntelsekunden stehen (sonst löst
Darüberstreifen aus), danach ist kurz Ruhe (sonst feuert ein liegender Finger
im Bildtakt), und zweimal dasselbe Feld verlangt einmal Loslassen dazwischen.

---

## Das Körpermodell

Der Mensch im Blickfeld ist nicht selbstgebaut, sondern das **MakeHuman-Basisnetz**
(`basemesh hm08`). Es wurde im September 2020 ausdrücklich unter **CC0**
gestellt — der Hinweis steht im Kopf der Quelldatei; Rechteinhaber zum Zeitpunkt
der Freigabe waren Data Collection AB, Joel Palmius und Jonas Hauquier. CC0
verlangt keine Namensnennung; sie steht in `assets/body/HERKUNFT.md` trotzdem.

Es ist bewusst das **geschlechtsneutrale** Basisnetz: MakeHuman formt daraus erst
über Modifikatoren einen bestimmten Körper. Hier soll es „ein Mensch" heißen und
keine bestimmte Person.

```sh
../../.venv/bin/python make_body.py
```

Das Skript lädt die Quelle (1,7 MB), wirft Helfergeometrie, Gelenkwürfel und
Zähne weg, normiert auf Höhe 1 (Füße bei y = 0, Gesicht nach +z) und schreibt
`assets/body/body.bin` + `body.json` — rund 470 KB, 13 380 Punkte, 26 756
Dreiecke. Eingecheckt wird das Ergebnis, nicht die Quelle.

**Die dreizehn Regionen** entstehen dabei mit: das Netz steht in A-Haltung, feste
Quader träfen die abgespreizten Arme nicht. Stattdessen bekommt jeder Punkt die
Region des nächstgelegenen **Knochens** — der Strecke zwischen zwei Gelenken, die
MakeHuman als eigene Gruppen mitliefert. Aus den zugeordneten Punkten fallen die
Trefferquader heraus, die in `js/body.js` stehen; der Quader, auf den man zeigt,
ist also die Hülle dessen, was man sieht. Die Rumpfsäule wird zusätzlich in y
sauber geteilt, damit Brust und Bauch beim Zeigen nicht um denselben Strahl
streiten.

Lädt das Netz nicht, zeichnet die App die Quader — ein fehlendes Modell hält den
Einsatz nicht auf.

---

## Die vier Tätigkeiten

Der erste Schirm fragt: **Was machst du gerade?** Die Antwort steht danach oben
links im Blickfeld und in **jeder Protokollzeile** — sonst ließe sich später
nicht mehr sagen, ob eine Kategorie aus der Vorsichtung des Trupps oder aus der
ärztlichen Sichtung stammt.

| Tätigkeit | Am Patienten passiert | Neue anlegen? |
|---|---|---|
| **Vorsichtung** | mSTaRT, sechs Fragen → Kategorie → Umhängekarte | ja |
| **Sichtung (ärztlich)** | Kategorie direkt wählen, **SK IV regulär** statt als Override | ja |
| **Registrierung** | direkt in den Kartenschritt — zuweisen oder Nummer ändern | ja |
| **Behandlung & Transport** | Maßnahmen festhalten (nochmal antippen nimmt zurück), Abtransport buchen | nein |

Befunde am Körpermodell gehen in jeder Tätigkeit: Region antippen, aus sechs
Einträgen wählen (Blutung, Fraktur, Wunde, Verbrennung, Prellung, Amputation),
nochmal antippen streicht. Sie hängen an der Region, nicht frei in der Akte —
„Blutung, Oberschenkel rechts" ist das, was weitergegeben wird.

Behandlung legt bewusst niemanden an: wer behandelt, arbeitet an Patienten, die
schon auf der Lagekarte stehen. Abtransportierte bleiben dort, wo sie lagen — das
gehört zum Lagebild —, treten aber zurück: Marker und Kartenpunkt werden matt.

Eine fünfte Tätigkeit ist ein Eintrag in der Tabelle in `js/tasks.js` plus ein
Zweig in `Workflow._atPatient()`.

---

## ⚠️ Kamera und Kartenschritt

Die App **fordert die Kamera überall an**, auch im Headset — ob eine kommt,
beantwortet nur das Gerät. Bekommt sie eine, wird die Umhängekarte wirklich
gescannt; bekommt sie keine, steht der Grund unten rechts und die Nummer wird
mit **−/+** gewählt. Der Ablauf läuft in beiden Fällen durch.

Hier stand lange, Headset-Browser gäben die Kameras grundsätzlich nicht heraus.
Das war **voreilig**: im AR-Modus konnte es gar nicht klappen, und zwar aus drei
Gründen, die alle bei uns lagen. Sie sind behoben:

1. **Die Kamera wurde zu spät angefragt.** `getUserMedia` lief erst *nach*
   `xr.start()`, also mitten in der immersiven Sitzung — und dort hat der
   Browser keine Fläche, auf der er die Berechtigungsfrage zeigen könnte. Sie
   wurde nie gestellt. Jetzt wird gefragt, **solange die Seite noch flach ist**.
2. **Das Videoelement stand auf `display: none`.** Ein Video, das aus dem Layout
   fällt, liefert in vielen Browsern keine Bilder mehr — `drawImage` bekommt
   Schwarz, und es wird nie ein Code erkannt. Jetzt bleibt es im Layout, nur
   winzig und durchsichtig (`.stumm`).
3. **Die Scanschleife hing an `requestAnimationFrame`.** Läuft eine immersive
   WebXR-Sitzung, ruft der Browser das rAF der flachen Seite nicht mehr auf. Die
   Schleife stand ab dem Betreten der Brille still. Jetzt läuft sie über einen
   Zeitgeber (15 Bilder/s).

Dazu eine Zeitgrenze: antwortet `getUserMedia` binnen 6 s nicht — es kann
hängenbleiben, statt abzulehnen —, geht es ohne Kamera weiter. Sonst käme man
gar nicht mehr in den AR-Modus, seit die Anfrage davor liegt.

**Ob die PICO 4 Enterprise die Kamera nun wirklich herausgibt, ist damit noch
nicht gesagt** — nur, dass die Frage jetzt überhaupt gestellt wird und die
Antwort im Blickfeld steht. Unten rechts erscheint entweder „Kamera aktiv" oder
der genaue Grund, inklusive der Fälle „erlaubt, liefert aber kein Bild" und
„Bild steht still". Bleibt es dabei, dass keine kommt: Handy im Kamera-Modus,
oder der native Build (`Unity/README-PICO.md`).

---

## Files

```
oculusapp/
├─ index.html            Landing + Bühne (Ablaufschirm, Lagekarte, Akte)
├─ css/hud.css           Styling (Triage-Palette wie im Lagebild)
├─ js/
│  ├─ motion.js          Federn, Schwungübergabe, Gummiband — alles, was sich bewegt
│  ├─ display.js         welches Glas ist das? Blickfeld ausmessen, additive Palette,
│  │                     Sitzungsleiter bis hinunter zu immersive-vr (HoloLens 2)
│  ├─ data.js            Akten dieses Einsatzes (leer beim Start) + Schreibfunktionen
│  ├─ tasks.js           die vier Tätigkeiten als Tabelle (Ablauf, Rechte, Beschriftung)
│  ├─ wristband.js       das Armband: Felder, Marker, Maße, wann ein Druck zählt
│  ├─ arucoscan.js       Armband vor der Kamera — Verdeckung statt Fingerverfolgung
│  ├─ body.js            dreizehn Körperregionen: Trefferquader, Notbehelfsnetz, Zeigen
│  ├─ bodyview.js        das Modell laden und zeichnen — in der Brille (BodyMesh)
│  │                     und flach mit Maus/Finger drehbar (BodyView)
│  ├─ mstart.js          das mSTaRT-Schema als Entscheidungsbaum (reine Logik)
│  ├─ layout.js          Lagekarte: Weltpositionen → Kartenfläche, Ausschnitt, Distanzen
│  ├─ workflow.js        der Ablauf als Zustandsmaschine — kennt keine Darstellung
│  ├─ hudscreen.js       zeichnet die flachen AR-Ebenen (Rand-HUD mit Kleinknöpfen,
│  │                     Handlungskarte, Bodenmarker, Anlege-Ring, Anzeige über
│  │                     dem Marker) und liefert die Trefferflächen
│  ├─ xr.js              WebXR-Sitzung: kopffestes HUD, raumfeste Karte,
│  │                     anklickbare Bodenmarker, Stelle am Boden zeigen,
│  │                     Körpermodell in 3D, Strahl und Auslösen
│  ├─ hudcanvas.js       Patientenakte auf Canvas
│  ├─ hud.js             Patientenakte als DOM
│  ├─ qr.js              QR: BarcodeDetector → jsQR-Fallback; liest JAR-P<n>
│  ├─ voice.js           Sprachausgabe und -eingabe; Erkennung nur lokal (processLocally)
│  └─ app.js             Verdrahtung: Betriebsarten, DOM-Darstellung, Deep-Links
├─ tests/
│  ├─ logic.test.mjs     272 Prüfungen: mSTaRT, Akten, Lagekarte, Ablauf,
│  │                     Stelle am Boden, alle vier Tätigkeiten, Körperregionen
│  │                     samt der Rückrechnung für AR, Spracheingabe, Armband,
│  │                     Federn und Schwung, Blickfeld und additive Palette
│  ├─ probe_flow.html    rendert alle AR-Schirme nacheinander
│  │                     (`?additiv=1` zeigt sie wie auf einer HoloLens 2:
│  │                      heller Hintergrund, Licht wird addiert statt gedeckt)
│  ├─ probe_body.html    lädt das Körpernetz, zeichnet es aus vier Richtungen
│  │                     und prüft, dass jede Region zu treffen ist
│  ├─ probe_band.html    druckt Marker, erkennt sie wieder, legt einen Finger auf
│  ├─ probe_dom.html     klickt den flachen Ablauf durch
│  └─ probe_qr.html      decodiert jede gedruckte Karte mit jsQR
├─ Unity/                nativer PICO-/Quest-Build (siehe Unity/README-PICO.md)
├─ vendor/jsQR.min.js    QR-Decoder-Fallback
├─ vendor/aruco.js       ArUco für das Armband (js-aruco2, MIT)
├─ vendor/cv.js          Bildverarbeitung dazu (gehört zu js-aruco2)
├─ make_body.py          holt das MakeHuman-Basisnetz (CC0) und macht daraus
│                        assets/body/ — siehe „Das Körpermodell"
├─ manifest.webmanifest  macht die Seite als App installierbar (Startmenü)
├─ sw.js                 hält sie vor: Code aus dem Netz, Großes aus der Ablage
├─ make_icons.py         erzeugt assets/icon/ — das Symbol im Startmenü
├─ make_cards.py         erzeugt den Druckbogen der Umhängekarten (segno)
├─ make_markers.py       erzeugt die nackten QR-Marker (segno)
├─ assets/body/          body.bin/.json (Menschmodell) + HERKUNFT.md
├─ assets/panel/         armband.pdf/.html (Bedienband, zum Drucken)
└─ assets/markers/       patientenkarten.pdf/.html (Umhängekarten, zum Drucken)
                         JAR-P1..JAR-P12.svg + markers.html (nackte Marker)
```

### Prüfen

```sh
node tests/logic.test.mjs
node tests/sw.test.mjs
```

Die Darstellung lässt sich headless ansehen: `tests/probe_flow.html` zeichnet
jeden AR-Schirm auf eine Canvas, `tests/probe_body.html` lädt das Körpernetz und
zeichnet es aus vier Richtungen, `tests/probe_dom.html` klickt den flachen Ablauf
durch (`?stop=koerper`, `?stop=lagebild`, …) — alle über einen lokalen Server
öffnen und mit `--screenshot` abgreifen. Für WebGL im Headless-Chrome braucht es
`--use-gl=swiftshader --enable-unsafe-swiftshader`.

### Karten neu erzeugen
```sh
../../.venv/bin/python make_cards.py
```
Nutzt `segno`. Die Nutzlast ist `JAR-P<id>`; `qr.js` versteht `JAR-P7`, `JAR:7`,
`.../patient/7` und die nackte `7`.

Zwei Dinge daran sind nicht verhandelbar und stehen deshalb im Skript
kommentiert: **Fehlerkorrektur H** (bei niedrigeren Stufen wählt segno für so
kurze Nutzlasten ein Micro-QR, und jsQR liest Micro-QR nicht) und eine
**viewBox** am SVG (ohne sie rastert die Grafik beim Verkleinern falsch und ist
nicht mehr scanbar). `tests/probe_qr.html` prüft beides, indem es jeden Code aus
dem fertigen Bogen mit jsQR decodiert — klar, in Kameragröße und schräg mit
Rauschen.

---

## Das mSTaRT-Schema

`js/mstart.js` bildet den mSTaRT-Algorithmus für Erwachsene ab — das modifizierte
"Simple Triage and Rapid Treatment" von Feuerwehr München und LMU (Kanz et al.,
*Notfall + Rettungsmedizin*, 2006), auf das sich auch die Übungslagen in `../demo`
beziehen:

| # | Frage | ja | nein |
|---|---|---|---|
| 1 | Kritische Blutung? | Blutstillung → **SK I** | weiter |
| 2 | Gehfähig? | **SK III** | weiter |
| 3 | Atmung vorhanden? | weiter zu 4 | Atemwege freimachen → 3a |
| 3a | Atmung nach Freimachen? | **SK I** | **verstorben** |
| 4 | AF < 10 oder > 30/min? | **SK I** | weiter |
| 5 | Radialispuls tastbar? | weiter | **SK I** |
| 6 | Befolgt Aufforderungen? | **SK II** | **SK I** |

Zwei bewusste Entscheidungen, beide im Code kommentiert:

- **Die Blutung wird zuerst geprüft.** Publizierte Fassungen unterscheiden sich
  darin; zuerst heißt, dass ein gehfähiger Patient mit spritzender Blutung nicht
  grün herauskommen kann. Der Baum steht in einer Datenstruktur (`NODES`),
  Umstellen ist eine Änderung an einer Stelle.
- **SK IV (blau) vergibt der Algorithmus nie.** Das ist eine ärztliche Entscheidung
  (LNA) und keine Vorsichtung — es gibt sie nur als ausdrücklich beschrifteten
  Override, und sie wird als solcher protokolliert.

---

## Wo das an das echte Produkt anschließt

Im Produkt kommen die Akten vom FastAPI-Hub über REST + WebSocket, und eine
zugewiesene Karte taucht sofort im Lagebild der Einsatzleitung auf. Hier, ohne
Backend auf statischem Hosting, hält `js/data.js` den Einsatz im Speicher — mit
derselben Satzform.

Jeder Schreibzugriff geht durch `createPatient` / `assignCard` / `setCategory` /
`addTreatment` / `removeTreatment` / `markTransported` / `addInjury` /
`removeInjury` / `pushProtocol` und nirgends sonst. Eine abgeschlossene Sichtung schreibt Kategorie,
Sofortmaßnahmen und zwei Protokollzeilen (Antwortpfad und ausschlaggebende
Begründung). Genau diese Funktionen sind die Naht, an der `POST /api/patients`
und `PATCH /api/patients/{id}` andocken.

Die gewählte Tätigkeit hängt an der Sitzung, nicht an der Akte
(`setActiveTask`), und wird auf jede Protokollzeile gestempelt — im Produkt wäre
das die Rolle am angemeldeten Gerät.

## Next steps
- **Hub-Anbindung:** die Sitzung gegen REST/WebSocket tauschen.
- **Räumliche Anker:** Positionen über WebXR-Anchors halten, damit sie ein
  Neuladen überleben.
- **Nativer PICO-Build:** `Unity/README-PICO.md` — dort scannt die Brille wirklich.
- **Diktat:** Freitext-Befunde per Offline-STT, wie im Produkt vorgesehen.
