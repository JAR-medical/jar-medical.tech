// The read-aloud corpus of mitmachen-aufnahme.html: 4,000 German sentences in
// the style of mSTaRT pre-triage radio traffic, served as 500 passages of 8.
// The first 800 are the original corpus and keep their ids (s001 to s800).
//
//   node tools/record-sentences.mjs    write assets/corpus/<CORPUS_NAME>.js and the
//                                      first passage shown before the script runs
//
// The output is deterministic (fixed seed), so a sentence id such as s042
// always names the same words. Numbers are written out so the expected text
// matches what is said, and every character is Latin-1 because the WAV INFO
// chunk is. Any change to the wording changes recorded data: bump CORPUS in
// the page's record.js along with it. tests/recording.test.mjs fails while
// the page and this generator disagree.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const COUNT = 4000;
export const BASE_COUNT = 800;
export const PER_PASSAGE = 8;
/** The name the page sends with each take. Bump it whenever the sentences change. */
export const CORPUS_NAME = 'mstart-4000-v1';
const SEED = 0x4a4152; // "JAR"
const EXTENSION_SEED = 0x4a4153;
const PAGE = fileURLToPath(new URL('../mitmachen-aufnahme.html', import.meta.url));
const CORPUS_FILE = fileURLToPath(new URL(`../assets/corpus/${CORPUS_NAME}.js`, import.meta.url));

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

/** German number words, 0 to 999, written as one word the way they are spoken. */
export function words(n) {
  if (n >= 100) {
    const h = Math.floor(n / 100);
    return (h > 1 ? ONES[h] : '') + 'hundert' + (n % 100 ? words(n % 100) : '');
  }
  if (n < 20) return ONES[n];
  const unit = n % 10, ten = TENS[Math.floor(n / 10)];
  return unit ? (unit === 1 ? 'ein' : ONES[unit]) + 'und' + ten : ten;
}
const times = (n) => (n === 1 ? 'einmal' : words(n) + 'mal');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const SIDES = ['rechten', 'linken'];
const LIMBS = ['Oberschenkel', 'Unterschenkel', 'Oberarm', 'Unterarm', 'Knie', 'Fuß', 'Sprunggelenk', 'Handgelenk'];
const LONG_BONES = ['Oberschenkel', 'Unterschenkel', 'Oberarm', 'Unterarm'];
const SECTIONS = ['Nord', 'Süd', 'Ost', 'West', 'Mitte'];
// [where, where to]
const PLACES = [
  ['am Haupteingang', 'zum Haupteingang'], ['am Bahnsteig zwei', 'zum Bahnsteig zwei'],
  ['am Bahnsteig vier', 'zum Bahnsteig vier'], ['am Parkplatz Ost', 'zum Parkplatz Ost'],
  ['am Busbahnhof', 'zum Busbahnhof'], ['am Ausgang West', 'zum Ausgang West'],
  ['am Sammelpunkt Nord', 'zum Sammelpunkt Nord'], ['am Sammelpunkt Süd', 'zum Sammelpunkt Süd'],
  ['auf dem Vorplatz', 'zum Vorplatz'], ['auf dem Schulhof', 'zum Schulhof'],
  ['im Treppenhaus', 'ins Treppenhaus'], ['im Festzelt', 'ins Festzelt'],
  ['im zweiten Waggon', 'zum zweiten Waggon'], ['im hinteren Bus', 'zum hinteren Bus'],
  ['an der Tribüne Nord', 'zur Tribüne Nord'], ['an der Bühne', 'zur Bühne'],
  ['an der Einfahrt Süd', 'zur Einfahrt Süd'], ['an der Rolltreppe', 'zur Rolltreppe'],
  ['in der Unterführung', 'zur Unterführung'], ['in der Sporthalle', 'zur Sporthalle'],
  ['in der Tiefgarage', 'zur Tiefgarage'], ['auf der Fußgängerbrücke', 'zur Fußgängerbrücke'],
];
// [nominative, where to]
const HOSPITALS = [
  ['das Klinikum Nord', 'ins Klinikum Nord'], ['das Klinikum Süd', 'ins Klinikum Süd'],
  ['die Kreisklinik', 'in die Kreisklinik'], ['das Universitätsklinikum', 'ins Universitätsklinikum'],
  ['die Unfallklinik', 'in die Unfallklinik'], ['die Kinderklinik', 'in die Kinderklinik'],
  ['das Verbrennungszentrum', 'ins Verbrennungszentrum'], ['das Städtische Krankenhaus', 'ins Städtische Krankenhaus'],
];
const INJURIES = ['Unterschenkelfraktur', 'Oberschenkelfraktur', 'Unterarmfraktur', 'Rippenserienfraktur',
  'Beckenfraktur', 'Sprunggelenksfraktur', 'Schlüsselbeinfraktur', 'Wirbelsäulenverletzung', 'Schädel-Hirn-Trauma',
  'innere Blutung', 'Milzverletzung', 'Rauchgasvergiftung', 'Gehirnerschütterung', 'Schulterluxation',
  'Unterkühlung', 'Kohlenmonoxidvergiftung', 'Lungenkontusion', 'Handgelenksfraktur'];
const MINOR = ['Schnittwunde an der rechten Hand', 'Schnittwunde an der linken Hand', 'Prellung am Knie',
  'Schürfwunden an beiden Unterarmen', 'Platzwunde an der Stirn', 'Verstauchung am linken Fuß',
  'Prellung an der Schulter', 'Nasenbluten', 'Brandblase am Unterarm', 'Kratzer im Gesicht',
  'Zerrung im Oberschenkel', 'Prellung am Ellenbogen'];
const TREATMENTS = ['Druckverband angelegt', 'Wunde steril abgedeckt', 'Rettungsdecke angelegt', 'Sauerstoff gegeben',
  'Beine hochgelagert', 'Arm geschient', 'Bein geschient', 'Halswirbelsäule stabilisiert', 'venöser Zugang gelegt',
  'Infusion angehängt', 'Beckenschlinge angelegt', 'Brandwunden gekühlt'];
const REGIONS = ['im Bauch', 'im Rücken', 'im Becken', 'im Nacken', 'in der Brust', 'in der Schulter', 'in der Hüfte', 'im Kopf'];
const SCENARIOS = ['Busunfall auf der Autobahn', 'Zugentgleisung im Bahnhof', 'Brand in einer Lagerhalle',
  'Gedränge bei einem Konzert', 'Explosion in einer Werkstatt', 'Gasaustritt in einer Schule',
  'Teileinsturz einer Tribüne', 'Massenkarambolage im Nebel', 'Chemieunfall in einem Betrieb',
  'Unwetter auf einem Festgelände', 'Straßenbahnunfall an einer Haltestelle', 'Brand in einem Wohnheim'];
const LANGUAGES = ['Englisch', 'Französisch', 'Arabisch', 'Türkisch', 'Polnisch', 'Ukrainisch', 'Spanisch',
  'Rumänisch', 'Italienisch', 'Russisch'];
const SHELTERS = ['im Gemeindehaus', 'in der Turnhalle', 'im Bus vor dem Eingang', 'im Feuerwehrhaus'];
const LANDINGS = ['auf dem Sportplatz', 'auf dem Parkplatz Ost', 'auf der Wiese hinter der Halle', 'auf der gesperrten Fahrbahn'];
const ROUTES = ['die Nordseite', 'die Südseite', 'die Hauptstraße', 'die Bahnhofstraße', 'die Feuerwehrzufahrt'];
const ORGS = ['Rotkreuz', 'Florian', 'Johannes', 'Malteser', 'Sama'];
const TOWNS = ['Neubiberg', 'Ottobrunn', 'Haar', 'Unterhaching', 'Putzbrunn', 'Taufkirchen'];
const CATEGORIES = [['eins', 'rot', 'sofort'], ['zwei', 'gelb', 'dringend'], ['drei', 'grün', 'nachrangig']];

/** Every template is a function of the random helpers returning one sentence. */
function templates(rand) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const n = (lo, hi) => words(int(lo, hi));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const patG = () => {
    const m = rand() < 0.5;
    return { name: (m ? 'Patient ' : 'Patientin ') + n(1, 120), m, er: m ? 'er' : 'sie' };
  };
  const pat = () => patG().name;
  const at = () => pick(PLACES)[0];
  const to = () => pick(PLACES)[1];
  const side = () => pick(SIDES);
  const section = () => pick(SECTIONS);
  const time = () => n(6, 23) + ' Uhr ' + n(1, 59);
  const trupp = () => 'Sichtungstrupp ' + n(1, 9);
  const rtw = () => pick(['Rettungswagen ', 'RTW ']) + n(1, 12);
  const nef = () => pick(['Notarzt ', 'NEF ']) + n(1, 6);
  const lead = () => pick(['Einsatzleitung', 'Leitstelle', 'Behandlungsplatz',
    'Abschnittsleitung ' + section(), 'Patientenablage ' + n(1, 4)]);
  const callsign = () => pick(ORGS) + ' ' + pick(TOWNS) + ' ' + n(10, 99) + ' ' + n(1, 9);
  const hosp = () => pick(HOSPITALS);

  return [
    // Radio procedure
    () => `${lead()} von ${trupp()}, kommen.`,
    () => `Hier ${trupp()}, ich höre, kommen.`,
    () => `${callsign()} von ${callsign()}, kommen.`,
    () => `Verstanden, ${trupp()} geht ${to()}, Ende.`,
    () => 'Bitte wiederholen Sie die letzte Meldung, ich habe nur die Hälfte verstanden.',
    () => `Die Funkverbindung ${at()} ist schlecht, ich melde mich gleich erneut.`,
    () => `Alle Einheiten bitte auf Kanal ${n(30, 99)} wechseln.`,
    () => `Meldung verstanden, wir sind in ${n(2, 15)} Minuten bei Ihnen.`,
    () => `Bitte eine kurze Lagemeldung für Abschnitt ${section()}, kommen.`,
    () => `Vorrang für ${nef()}, alle anderen bitte Funkdisziplin halten.`,
    () => `${trupp()} an Einsatzleitung, wir sind ${at()} eingetroffen.`,
    () => `Ich bestätige ${n(2, 30)} Patienten ${at()}, kommen.`,

    // Walking wounded
    () => `Achtung, alle, die gehen können, sammeln sich bitte ${at()}!`,
    () => `${n(2, 40)} gehfähige Verletzte ${at()}, alle Sichtungskategorie drei, grün.`,
    () => `${pat()} ist gehfähig und geht selbstständig ${to()}.`,
    () => `Die Leichtverletzten ${at()} werden von ${n(2, 6)} Helfern betreut.`,
    () => 'Bitte bleiben Sie hier sitzen, gleich kommt jemand zu Ihnen.',
    () => 'Können Sie aufstehen und ein paar Schritte zu mir kommen?',
    () => `Gehfähige werden ${at()} registriert und betreut.`,

    // Critical bleeding
    () => `Kritische Blutung am ${side()} ${pick(['Oberschenkel', 'Oberarm'])}, Tourniquet angelegt um ${time()}.`,
    () => `${pat()}: spritzende Blutung am ${side()} ${pick(LIMBS)}, ein Druckverband reicht nicht aus.`,
    () => `Tourniquet bei ${pat()} sitzt, die Blutung steht, Anlagezeit ${time()}.`,
    () => `Zweites Tourniquet am ${side()} Oberschenkel angelegt, die Blutung ist jetzt gestoppt.`,
    () => `Starke Blutung am Hals bei ${pat()}, manuelle Kompression läuft.`,
    () => `Wir brauchen dringend ${n(3, 10)} Tourniquets und Verbandmaterial ${at()}.`,
    () => `${pat()}: starke Blutung am Kopf, mit Druckverband beherrschbar.`,

    // Airway and breathing
    () => `${pat()}: keine Atmung, ich mache die Atemwege frei.`,
    () => `Nach Freimachen der Atemwege setzt die Atmung bei ${pat()} wieder ein.`,
    () => `${pat()} atmet auch nach Freimachen der Atemwege nicht, keine Lebenszeichen.`,
    () => `${pat()}: Atemfrequenz ${n(31, 44)} pro Minute, Sichtungskategorie eins, rot.`,
    () => `${pat()}: Atemfrequenz ${n(12, 24)} pro Minute, Atmung unauffällig.`,
    () => `${pat()} hat starke Atemnot, die Lippen sind bläulich verfärbt.`,
    () => `Guedeltubus bei ${pat()} eingelegt, die Atmung ist jetzt ruhiger.`,
    () => `${pat()}: Verdacht auf Spannungspneumothorax, Notarzt bitte sofort ${to()}.`,
    () => `Atemgeräusch ${pick(['links', 'rechts'])} abgeschwächt, ${pat()} bleibt Sichtungskategorie eins.`,
    () => `${pat()} bekommt ${n(4, 15)} Liter Sauerstoff pro Minute über eine Maske.`,

    // Circulation
    () => `${pat()}: Radialispuls nicht tastbar, Haut blass und kaltschweißig.`,
    () => `${pat()}: Rekapillarisierungszeit über zwei Sekunden, Sichtungskategorie eins.`,
    () => `${pat()}: Rekapillarisierungszeit unter zwei Sekunden, Radialispuls gut tastbar.`,
    () => `${pat()}: Puls ${n(110, 160)} pro Minute, fadenförmig, Verdacht auf Schock.`,
    () => {
      const sys = int(85, 190), dia = int(45, Math.min(110, sys - 25));
      return `${pat()}: Blutdruck ${words(sys)} zu ${words(dia)}, Puls ${n(48, 150)}.`;
    },
    () => `Beine hochgelagert und Rettungsdecke angelegt, ${pat()} wird engmaschig überwacht.`,
    () => `${pat()}: Puls ${n(38, 52)} pro Minute, sehr langsam und unregelmäßig.`,

    // Consciousness
    () => `${pat()} befolgt einfache Aufforderungen nicht, Sichtungskategorie eins, rot.`,
    () => `${pat()} ist wach, orientiert und befolgt alle Aufforderungen.`,
    () => `${pat()} reagiert nur auf Schmerzreiz, Pupillen ${pick(['isokor', 'anisokor', 'weit', 'eng'])}.`,
    () => `${pat()}: Glasgow Coma Scale ${n(5, 14)}, Verdacht auf Schädel-Hirn-Trauma.`,
    () => `${pat()} ist bewusstlos, atmet normal und liegt in stabiler Seitenlage.`,
    () => { const p = patG(); return `${p.name} ist verwirrt und weiß nicht, wo ${p.er} sich befindet.`; },
    () => `${pat()} hat einen Krampfanfall, die Umgebung ist gesichert.`,
    () => `${pat()} war kurz bewusstlos und kann sich an den Unfall nicht erinnern.`,

    // Triage results
    () => `${pat()}: Atmung normal, Kreislauf stabil, ansprechbar, Sichtungskategorie zwei, gelb.`,
    () => `${pat()}: gehfähig, ${pick(MINOR)}, Sichtungskategorie drei, grün.`,
    () => `${pat()}: Verdacht auf ${pick(INJURIES)}, Sichtungskategorie zwei, gelb.`,
    () => `Der Notarzt stuft ${pat()} in Sichtungskategorie vier ein, blau, abwartende Behandlung.`,
    () => `${pat()} ohne Lebenszeichen, als verstorben gekennzeichnet.`,
    () => `${pick(['Anhängekarte', 'Patientenanhängekarte'])} für ${pat()} ausgefüllt und am ${side()} Handgelenk befestigt.`,
    () => `${pat()} hat noch keine Anhängekarte, bitte nachsichten.`,
    () => `${pat()} wird mit roter Markierung sofort zum Behandlungsplatz getragen.`,
    () => { const c = pick(CATEGORIES); return `${pat()}: Sichtungskategorie ${c[0]}, ${c[1]}, Transport ${c[2]}.`; },

    // Re-triage
    () => `${pat()} nachgesichtet: Zustand verschlechtert, hochstufen auf Sichtungskategorie eins.`,
    () => `${pat()} nachgesichtet: Zustand stabil, bleibt Sichtungskategorie zwei.`,
    () => `Nachsichtung ${at()} abgeschlossen, keine Änderungen.`,
    () => `${pat()} nachgesichtet: Atemfrequenz jetzt über dreißig, Kategorie rot.`,
    () => `Zweite Nachsichtung bei ${pat()} um ${time()}, Puls jetzt ${n(60, 130)}.`,
    () => `${pat()} nachgesichtet: deutlich gebessert, herabstufen auf Sichtungskategorie drei.`,

    // Vital signs
    () => `${pat()}: Sauerstoffsättigung ${n(82, 99)} Prozent unter Raumluft.`,
    () => `${pat()}: Blutzucker ${n(40, 320)} Milligramm pro Deziliter.`,
    () => `${pat()}: Körpertemperatur ${n(34, 39)} Komma ${n(0, 9)} Grad.`,
    () => {
      const sys = int(85, 190), dia = int(45, Math.min(110, sys - 25));
      return `${pat()}: Blutdruck ${words(sys)} zu ${words(dia)}, Puls ${n(48, 150)}, Sättigung ${n(82, 99)} Prozent.`;
    },
    () => `${pat()}: Blutdruck nicht messbar, Puls nur an der Halsschlagader tastbar.`,
    () => `${pat()} gibt Schmerzen von ${n(3, 10)} auf einer Skala bis zehn an, vor allem ${pick(REGIONS)}.`,

    // Injuries
    () => `${pat()}: offene Fraktur am ${side()} ${pick(LONG_BONES)}, Wunde steril abgedeckt.`,
    () => `${pat()}: Verbrennungen an beiden Armen, etwa ${n(10, 40)} Prozent der Körperoberfläche.`,
    () => `${pat()}: Verdacht auf Beckenfraktur, Beckenschlinge angelegt.`,
    () => `${pat()}: Prellmarken am Brustkorb, Schmerzen beim Atmen.`,
    () => `${pat()}: Platzwunde an der Stirn, kurzzeitig bewusstlos.`,
    () => `${pat()}: Rauchgasinhalation, hustet stark, die Stimme ist heiser.`,
    () => `${pat()}: Pfählungsverletzung am ${side()} Oberschenkel, der Fremdkörper bleibt stecken.`,
    () => `${pat()}: Amputationsverletzung am ${side()} Unterarm, das Amputat ist gesichert.`,
    () => `${pat()}: Schnittverletzung durch Glas, Blutung mit Druckverband gestillt.`,
    () => `${pat()} war eingeklemmt, die Befreiung durch die Feuerwehr dauerte ${n(10, 50)} Minuten.`,
    () => `${pat()}: Verbrennung im Gesicht, Verdacht auf Inhalationstrauma.`,
    () => `${pat()}: Bauch hart und druckschmerzhaft, Verdacht auf innere Blutung.`,

    // Measures
    () => `Halswirbelsäule bei ${pat()} manuell stabilisiert, Zervikalstütze angelegt.`,
    () => `Venöser Zugang bei ${pat()} liegt, die Infusion läuft.`,
    () => `Der Notarzt hat ${pat()} ein Schmerzmittel gegeben, die Schmerzen lassen nach.`,
    () => `${pat()} ist auf der Vakuummatratze gelagert und transportbereit.`,
    () => `Bitte bei allen Patienten ${at()} auf Wärmeerhalt achten.`,
    () => {
      const a = pick(TREATMENTS);
      let b = pick(TREATMENTS);
      while (b === a) b = pick(TREATMENTS);
      return `${pat()}: ${a} und ${b}, Zustand unverändert.`;
    },

    // Situation reports
    () => `Einsatzleitung von ${trupp()}: Abschnitt ${section()} vollständig gesichtet.`,
    () => `Zwischenstand Abschnitt ${section()}: ${times(int(1, 9))} rot, ${times(int(2, 15))} gelb, ${times(int(3, 30))} grün.`,
    () => `${at()} liegen noch ${n(2, 15)} Patienten, die nicht gesichtet sind.`,
    () => `Starke Rauchentwicklung ${at()}, der Bereich wird geräumt.`,
    () => `Gefahrenbereich ${at()}, Betreten nur mit Atemschutz.`,
    () => { const all = int(8, 80); return `Wir haben insgesamt ${words(all)} Verletzte, davon ${words(int(2, Math.floor(all / 2)))} schwer.`; },
    () => `Erste Lagemeldung: ${pick(SCENARIOS)}, etwa ${n(15, 120)} Verletzte.`,
    () => `Die Einsatzstelle ist abgesperrt, Zufahrt nur über ${pick(ROUTES)}.`,
    () => 'Der Leitende Notarzt ist eingetroffen und übernimmt die medizinische Leitung.',
    () => `Die Sichtung im Abschnitt ${section()} dauert noch etwa ${n(5, 30)} Minuten.`,
    () => `Bisher ${n(2, 12)} rote, ${n(2, 20)} gelbe und ${n(2, 40)} grüne Patienten registriert.`,
    () => `Abschnitt ${section()} meldet ${n(2, 5)} Tote und ${n(2, 12)} Schwerverletzte.`,

    // Requests
    () => `Wir brauchen ${n(2, 12)} weitere Tragen ${at()}.`,
    () => `Fordere ${n(2, 8)} Rettungswagen und einen Notarzt für Abschnitt ${section()} nach.`,
    () => `Bitte einen Rettungshubschrauber für ${pat()} anfordern.`,
    () => `Die Rettungsdecken gehen aus, bitte Nachschub ${to()}.`,
    () => `Wir brauchen ${n(2, 10)} Helfer zum Tragen ${at()}.`,
    () => `Bitte einen Dolmetscher zum Behandlungsplatz, ${pat()} spricht nur ${pick(LANGUAGES)}.`,
    () => `Wir brauchen Beleuchtung ${at()}, es wird dunkel.`,
    () => `Bitte Material für Brandverletzte und Kühlung ${to()}.`,
    () => 'Am Behandlungsplatz wird ein zusätzlicher Notarzt benötigt.',
    () => `Bitte ${n(2, 6)} Schaufeltragen und ${n(2, 6)} Vakuummatratzen ${to()}.`,

    // Transport and handover
    () => `Übergabe an ${rtw()}: ${pat()}, Sichtungskategorie ${pick(['eins', 'zwei'])}, kreislaufstabil.`,
    () => `${pat()} abtransportiert mit ${rtw()} ${hosp()[1]}, Abfahrt ${time()}.`,
    () => `${rtw()} ist wieder frei und meldet sich am Rettungsmittelhalteplatz.`,
    () => `Transportpriorität eins für ${pat()}, Zielklinik ist ${hosp()[0]}.`,
    () => `${hosp()[0]} meldet: Schockraum belegt, Aufnahme erst in ${n(10, 60)} Minuten.`,
    () => `${hosp()[0]} kann noch ${n(2, 9)} Patienten aufnehmen.`,
    () => `Der Rettungshubschrauber landet in ${n(3, 15)} Minuten ${pick(LANDINGS)}.`,
    () => `${rtw()} mit ${pat()} unterwegs, Eintreffen in ${n(5, 25)} Minuten.`,
    () => `Bitte einen Krankentransportwagen für ${n(2, 4)} Leichtverletzte ${to()}.`,
    () => `${pat()} wird ${hosp()[1]} gebracht, die Voranmeldung ist erfolgt.`,

    // Talking to patients
    () => `Hallo, ich bin ${pick(['vom Rettungsdienst', 'von der Feuerwehr', 'vom Roten Kreuz'])}, können Sie mich hören?`,
    () => 'Wie heißen Sie, und wissen Sie, wo Sie gerade sind?',
    () => 'Haben Sie Schmerzen, und wenn ja, wo genau?',
    () => 'Drücken Sie bitte meine Hand, so fest Sie können.',
    () => 'Bitte bewegen Sie den Kopf nicht, wir stabilisieren Ihren Nacken.',
    () => 'Nehmen Sie regelmäßig Medikamente, zum Beispiel Blutverdünner?',
    () => 'Haben Sie Allergien gegen Medikamente?',
    () => 'Wir bringen Sie jetzt in ein Krankenhaus, ein Kollege bleibt bei Ihnen.',
    () => 'Können Sie mir sagen, was passiert ist?',
    () => 'Atmen Sie ruhig und gleichmäßig, wir sind bei Ihnen.',

    // Organisation
    () => {
      const a = int(1, 4);
      let b = int(1, 4);
      while (b === a) b = int(1, 4);
      return `Patientenablage ${words(a)} ist voll, neue Patienten bitte zur Ablage ${words(b)}.`;
    },
    () => `Der Behandlungsplatz ist betriebsbereit, Kapazität ${n(20, 100)} Patienten.`,
    () => 'Jeder Patient wird beim Verlassen der Einsatzstelle registriert.',
    () => `Abschnittsleitung ${section()} an Einsatzleitung: Das Personal reicht nicht aus.`,
    () => `Alle Sichtungstrupps bitte um ${time()} zur Lagebesprechung.`,
    () => `${trupp()} übernimmt ab sofort den Bereich ${at()}.`,
    () => `Die Betreuungsstelle für Unverletzte ist ${pick(SHELTERS)} eingerichtet.`,
    () => `Angehörige werden zur Betreuungsstelle ${pick(SHELTERS)} gebracht.`,
    () => `${trupp()} wird abgelöst und geht zur Pause in den Bereitstellungsraum.`,

    // Children and special cases
    () => `Kind, etwa ${n(3, 12)} Jahre alt, weint, ist ansprechbar und atmet normal.`,
    () => `Kind ohne Begleitperson ${at()}, bitte Betreuung schicken.`,
    () => `Patientin ${n(1, 120)} ist schwanger, etwa im ${pick(['sechsten', 'siebten', 'achten', 'neunten'])} Monat, und hat Bauchschmerzen.`,
    () => { const p = patG(); return `${p.name} ist ${p.m ? 'Diabetiker' : 'Diabetikerin'} und hat seit Stunden nichts gegessen.`; },
    () => `${pat()}, etwa ${n(70, 95)} Jahre alt, ist gestürzt und kann nicht aufstehen.`,
    () => `${pat()} trägt einen Herzschrittmacher, der Ausweis liegt vor.`,
    () => `${pat()}, etwa ${n(18, 69)} Jahre alt, ${pick(['ansprechbar und orientiert', 'eingetrübt', 'unruhig', 'stark verängstigt'])}.`,

    // Safety
    () => `Achtung, Gasgeruch ${at()}, alle sofort zurück!`,
    () => `Einsturzgefahr ${at()}, Rettungskräfte bitte zurückziehen.`,
    () => 'Achtung, Stromleitung am Boden, bitte Abstand halten!',
    () => `Die Feuerwehr gibt den Bereich ${at()} wieder frei.`,
    () => `Achtung, verdächtiger Gegenstand ${at()}, Bereich sofort räumen!`,
  ];
}

// Extension: 3,200 more sentences from their own bank of templates and seed.
// They follow the original 800, which keep their ids (s001 to s800).
const X_UNITS = ['Rettungswagen', 'Notarztwagen', 'Krankentransportwagen', 'Löschzug', 'Sichtungstrupp',
  'Behandlungstrupp', 'Transporttrupp', 'Erkundungstrupp'];
const X_REPORTS = ['Einsatzstelle erreicht', 'Zufahrt ist frei', 'Zufahrt ist blockiert',
  'erste Patienten werden versorgt', 'Ablage ist eingerichtet', 'Lage unter Kontrolle',
  'Material wird dringend benötigt', 'Rettungsmittel wird abgezogen', 'Kräfte reichen nicht aus',
  'bitte um Ablösung', 'Einsatzstelle ist gesichert', 'Behandlungsplatz steht', 'Lage ist unverändert',
  'Patienten sind verladen', 'Transport läuft', 'keine weiteren Verletzten gefunden',
  'Suche im Gebäude abgeschlossen', 'Brandstelle ist abgelöscht', 'Übergabe am Haupteingang abgeschlossen',
  'wir benötigen einen zweiten Notarzt'];
const X_STATES = ['wir sind eingetroffen', 'wir sind wieder frei', 'wir sind auf dem Rückweg',
  'wir warten am Sammelpunkt', 'wir sind einsatzbereit', 'wir haben Sichtkontakt zur Einsatzleitung'];
const X_ORDERS = ['Funkdisziplin halten', 'Rettungsgasse freihalten', 'nur Notfälle über Funk melden',
  'Zufahrten nicht blockieren', 'Material nur auf Anforderung bringen', 'Anhängekarten vollständig ausfüllen',
  'Warnwesten dauerhaft tragen', 'Sprechpausen einhalten'];
const X_TRIAGE = [
  ['eins', 'rot', 'Atemnot mit bläulichen Lippen'],
  ['eins', 'rot', 'starke Blutung und Schocksymptome'],
  ['eins', 'rot', 'bewusstlos, Atmung flach'],
  ['eins', 'rot', 'Kreislaufversagen, Puls nicht tastbar'],
  ['zwei', 'gelb', 'Verdacht auf Knochenbruch, starke Schmerzen'],
  ['zwei', 'gelb', 'Brandverletzungen an den Händen'],
  ['zwei', 'gelb', 'Bauchschmerzen, Kreislauf stabil'],
  ['zwei', 'gelb', 'Verdacht auf Gehirnerschütterung, ansprechbar'],
  ['drei', 'grün', 'Schnittwunde, gehfähig'],
  ['drei', 'grün', 'Schürfwunden und Prellungen, ansprechbar'],
  ['drei', 'grün', 'leichte Verstauchung, selbstständig unterwegs'],
  ['vier', 'blau', 'schwerste Verletzungen, abwartende Behandlung'],
];
const X_RESIGHT = ['Atmung ruhiger, Kategorie verbessert', 'Kreislauf instabil, Kategorie angehoben',
  'Schmerzen nehmen zu, bitte erneut prüfen', 'Zustand unverändert, bleibt im Bereich',
  'Verletzung größer als gedacht, sofort zum Transport', 'Puls kräftiger, Kategorie um eine Stufe gesenkt',
  'Bewusstsein klarer, Anhängekarte aktualisiert', 'Blutung steht, Verband kontrolliert'];
const X_BREATH = ['flach und schnell', 'ruhig und gleichmäßig', 'pfeifend beim Ausatmen',
  'nur mit Hilfe der Atemhilfsmuskulatur', 'mit längeren Pausen', 'nach der Beutelbeatmung wieder ruhiger'];
const X_PULSE = ['regelmäßig und kräftig', 'unregelmäßig', 'schwach tastbar', 'gut gefüllt',
  'nur an der Halsschlagader tastbar', 'auffällig schnell'];
const X_PROCEDURES = ['eine Beatmung mit dem Beutel', 'eine Lagerung in Schocklage', 'eine Wiederbelebung',
  'eine Thoraxdrainage', 'eine Entlastungspunktion', 'eine Schmerzbehandlung',
  'eine Stabilisierung der Wirbelsäule', 'eine Kühlung der Brandwunden'];
const X_MEDICATION = ['ein Schmerzmittel über die Vene', 'eine Infusion mit Kochsalzlösung',
  'ein Mittel gegen Übelkeit', 'Traubenzucker über die Vene', 'ein Mittel zur Beruhigung',
  'ein krampflösendes Medikament'];
const X_DRESSINGS = [
  ['Kompressionsverband am linken Oberschenkel', 'Blutung steht'],
  ['Wundauflage an der rechten Schulter', 'Blutung sickert noch'],
  ['Verband um den Brustkorb', 'Atmung ist frei'],
  ['Schiene am linken Unterarm', 'Durchblutung ist gut'],
  ['Vakuumverband auf der Wunde am Rücken', 'Blutung ist gestillt'],
  ['Druckverband am Hals', 'Blutung ist gestoppt'],
  ['Kühlkompresse auf dem Gesicht', 'Schwellung geht zurück'],
];
const X_INJURIES = ['Verdacht auf Hüftfraktur, Bein verkürzt und nach außen gedreht',
  'Verdacht auf Speichenbruch, Hand blass und kalt', 'Schultereckgelenk verletzt, Arm wird geschont',
  'Schädelprellung über dem rechten Ohr, Erbrechen', 'Verdacht auf Brustbeinbruch, Schmerzen beim Atmen',
  'Quetschung am Unterschenkel, Haut gespannt', 'Stichverletzung am Oberarm, Blutung gering',
  'Augenverletzung links, Sehen eingeschränkt', 'Kieferprellung, Zähne locker',
  'Verletzung am Knie, Bein kann nicht belastet werden', 'Fingerkuppe abgetrennt, Stumpf verbunden',
  'Verdacht auf Nasenbeinbruch, Nasenbluten', 'Bisswunde am Unterarm, Blutung mit Druckverband gestillt',
  'Verdacht auf Bänderriss am Sprunggelenk, Fuß geschwollen',
  'Verdacht auf Ellenbogenluxation, Arm in Schonhaltung'];
const X_BURNS = ['am Rücken', 'an beiden Händen', 'im Gesicht', 'am Oberkörper', 'an beiden Beinen',
  'an den Unterarmen'];
const X_UNDER = ['einer Holzplatte', 'einem Betonteil', 'einem umgestürzten Regal', 'einem Fahrzeug',
  'einem Gerüst', 'einem Stromkasten'];
const X_ITEMS = ['Decken', 'Wärmefolien', 'Wasserflaschen', 'Tragen', 'Vakuummatratzen', 'Verbandpäckchen',
  'Infusionsbeutel', 'Sauerstoffflaschen', 'Schienen', 'Halskrägen', 'Rettungsdecken', 'Einmalhandschuhe'];
const X_DESTINATIONS = ['zum Behandlungsplatz', 'an die Einsatzstelle', 'zur Patientenablage',
  'in den Bereitstellungsraum', 'zum Sammelpunkt Nord', 'zur Betreuungsstelle'];
const X_SUPPLY = ['Stromversorgung', 'Wasserversorgung', 'Beleuchtung', 'Heizung', 'Funkverbindung'];
const X_STAFF = ['Helfer', 'Sanitäter', 'Pflegekräfte', 'Feuerwehrleute', 'Notfallsanitäter', 'Ärzte', 'Dolmetscher'];
const X_STAFF_FOR = ['für die Sichtung', 'am Behandlungsplatz', 'zur Betreuung der Angehörigen',
  'für den Transport', 'in der Patientenablage'];
const X_RELATIVES = [['Die Mutter', 'ihr Kind'], ['Der Vater', 'seinen Sohn'], ['Die Großmutter', 'ihren Enkel'],
  ['Die Nachbarin', 'ihre Tochter'], ['Der Großvater', 'seine Enkelin'], ['Die Ehefrau', 'ihren Mann']];
const X_SHELTERS = ['Gemeindehaus', 'Bürgerhaus', 'Rathaus', 'Kindergarten', 'Bahnhof', 'Stadion'];
const X_DANGER = ['Glatteis', 'Hochspannung', 'austretendes Benzin', 'Rauch', 'herabfallende Teile', 'Rutschgefahr'];
const X_HAZARD_PLACES = ['am Haupteingang', 'am Parkplatz Ost', 'im Treppenhaus', 'in der Tiefgarage',
  'auf dem Vorplatz', 'an der Einfahrt Süd', 'in der Unterführung', 'auf der Fußgängerbrücke', 'im Keller',
  'am Ausgang West'];
const X_ROUTES = ['die Hauptstraße', 'die Bahnhofstraße', 'die Nordseite', 'die Südseite', 'den Feldweg', 'die Brücke'];
const X_LANGUAGES = ['Arabisch', 'Englisch', 'Französisch', 'Türkisch', 'Polnisch', 'Ukrainisch', 'Spanisch',
  'Rumänisch', 'Italienisch', 'Russisch', 'Serbisch', 'Griechisch', 'Persisch', 'Vietnamesisch', 'Kurdisch'];
const X_ASKS = ['mir Ihren Namen nennen', 'mir sagen, welcher Tag heute ist', 'die Augen öffnen',
  'mit den Zehen wackeln', 'mir zeigen, wo es wehtut', 'kurz tief einatmen', 'Ihre Finger bewegen',
  'mir sagen, ob Sie Blut verloren haben', 'mir Ihre Adresse sagen', 'mit mir sprechen', 'die Hand heben',
  'mir sagen, was passiert ist', 'mir Ihr Geburtsdatum nennen', 'die Schulter bewegen',
  'mir sagen, wo Sie sich gerade befinden'];

function extensionTemplates(rand) {
  const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
  const n = (lo, hi) => words(int(lo, hi));
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const pat = () => (rand() < 0.5 ? 'Patient ' : 'Patientin ') + n(1, 120);
  const at = () => pick(PLACES)[0];
  const to = () => pick(PLACES)[1];
  const hazard = () => pick(X_HAZARD_PLACES);
  const section = () => pick(SECTIONS);
  const unit = () => pick(X_UNITS) + ' ' + n(2, 40);
  const rtw = () => 'Rettungswagen ' + n(2, 30);
  const hosp = () => pick(HOSPITALS);
  const time = () => n(6, 23) + ' Uhr ' + n(10, 59);

  return [
    // Radio: reports, states, orders and requests
    () => `${unit()} an Einsatzleitung: ${pick(X_REPORTS)}, kommen.`,
    () => `${unit()} ${pick(['fährt', 'kommt', 'geht'])} ${to()}, Ende.`,
    () => `Bitte ${pick(['Verbindung prüfen', 'Rückruf bestätigen', 'Meldung wiederholen'])}, ${unit()} hat seit ${n(2, 9)} Minuten keine Rückmeldung gegeben, kommen.`,
    () => `Hier ${unit()}, ${pick(X_STATES)}, kommen.`,
    () => `Einsatzleitung an alle Einheiten auf Kanal ${n(10, 99)}: ${pick(X_ORDERS)}, bitte bestätigen, kommen.`,
    () => `${unit()} wechselt auf Kanal ${n(10, 99)}, ${pick(['bitte kurz warten', 'bitte um Bestätigung'])}, Ende.`,
    () => `Die Verbindung ${pick(['zur Leitstelle', 'zum Krankenhaus', 'zum Abschnitt Nord', 'zum Hubschrauber'])} ist seit ${n(2, 30)} Minuten ${pick(['gestört', 'unterbrochen'])}, bitte Meldungen kurz halten.`,
    () => `${unit()} meldet ${n(2, 12)} Einsatzkräfte im Abschnitt ${section()}, ${pick(['alle einsatzbereit', 'zwei davon in Pause', 'eine Person fehlt noch'])}.`,
    () => `${unit()}: ${pick(['Patientenübergabe abgeschlossen', 'Fahrzeug einsatzbereit', 'Einsatzstelle geräumt', 'Lage stabil', 'Abtransport gestartet'])}, ${pick(['weitere Meldung folgt', 'bitte um Rückmeldung'])}, kommen.`,
    () => `Hier spricht ${pick(['die Einsatzleitung', 'der Abschnittsleiter Nord', 'der Leitende Notarzt', 'die Leitstelle'])}, ${pick(['alle Einheiten bitte melden', 'Sichtung beginnt sofort', 'Lage wird neu bewertet', 'Funkkanal bleibt frei'])}, Rückmeldung bis ${time()}, kommen.`,

    // Triage and re-triage
    () => { const t = pick(X_TRIAGE); return `${pat()}: Sichtungskategorie ${t[0]}, ${t[1]}, ${t[2]}.`; },
    () => { const t = pick(X_TRIAGE); return `${pat()} wird vorläufig als Sichtungskategorie ${t[0]} eingestuft, ${t[2]}.`; },
    () => `${pat()} nachgesichtet: ${pick(X_RESIGHT)}.`,

    // Vital signs
    () => `${pat()}: Atemfrequenz ${n(8, 40)} pro Minute, ${pick(X_BREATH)}.`,
    () => `${pat()}: Puls ${n(40, 150)} pro Minute, ${pick(X_PULSE)}.`,
    () => `${pat()}: Sauerstoffsättigung ${n(70, 99)} Prozent ${pick(['unter Raumluft', 'mit Nasensonde', 'mit Sauerstoffmaske'])}.`,
    () => `${pat()}: Blutzucker ${n(30, 380)} Milligramm pro Deziliter, ${pick(['ansprechbar', 'eingetrübt', 'verwirrt', 'müde'])}.`,
    () => `${pat()} hat ${n(35, 40)} Komma ${n(1, 9)} Grad Körpertemperatur, ${pick(['Schüttelfrost', 'kalte Haut', 'trockene Schleimhäute', 'starkes Schwitzen'])}.`,
    () => `${pat()}: Glasgow Coma Scale ${n(3, 15)}, Pupillen ${pick(['gleich weit', 'ungleich weit', 'eng', 'weit'])}, ${pick(['Reaktion auf Licht vorhanden', 'keine Reaktion auf Licht'])}.`,
    () => `${pat()} gibt Schmerzen von ${n(1, 10)} auf einer Skala bis zehn an, ${pick(['im Brustkorb', 'im Bauch', 'im rechten Knie', 'im unteren Rücken', 'im linken Handgelenk'])}.`,

    // Measures
    () => `Bei ${pat()} wurde ${pick(X_PROCEDURES)} durchgeführt, ${pick(['die Wirkung wird beobachtet', 'Zustand danach stabil', 'Dokumentation folgt'])}.`,
    () => `${pat()} erhält ${pick(X_MEDICATION)}, ${pick(['Dosierung nach Vorgabe', 'Gabe bitte dokumentieren', 'Wirkung in fünf Minuten prüfen'])}.`,
    () => `Defibrillator bei ${pat()} angeschlossen, ${pick(['kein Schock indiziert', 'Rhythmus wird analysiert', 'Schock wurde abgegeben', 'Herzmassage läuft'])}.`,
    () => `${pat()}: Zugang ${pick(['in der rechten Ellenbeuge', 'am linken Unterarm', 'am Handrücken', 'an der rechten Hand'])} gelegt, ${pick(['Infusion läuft', 'Infusion ist beendet', 'Flüssigkeit wird nachgegeben'])}.`,
    () => { const d = pick(X_DRESSINGS); return `${pat()}: ${d[0]}, ${d[1]}.`; },

    // Injuries and conditions
    () => `${pat()}: ${pick(X_INJURIES)}.`,
    () => `${pat()}: Verbrennungen ${pick(X_BURNS)}, etwa ${n(3, 30)} Prozent der Körperoberfläche.`,
    () => `${pat()} ist unter ${pick(X_UNDER)} eingeklemmt, ${pick(['das Bein ist taub', 'der Arm ist blass', 'die Hand ist kalt', 'der Fuß ist kühl'])}.`,
    () => `${pat()} hat eine Unterzuckerung, ${pick(['ist ansprechbar', 'bekommt Traubenzucker', 'ist schweißig und unruhig'])}, der Blutzucker wird gemessen.`,
    () => `${pat()}: Verdacht auf Herzinfarkt, ${pick(['Oberkörper kalt und schweißig', 'Kreislauf instabil', 'Schmerzmittel gegeben'])}.`,
    () => `${pat()} hat Brustschmerzen, die ${pick(['in den linken Arm ausstrahlen', 'bei Belastung auftreten', 'seit dem Morgen anhalten'])}.`,
    () => `${pat()} hat einen Krampfanfall, ${pick(['der Anfall ist vorbei', 'der Atemweg ist frei'])}.`,
    () => `${pat()} hat eine allergische Reaktion, ${pick(['Schwellung im Gesicht', 'Atemnot und Hautausschlag', 'Juckreiz am ganzen Körper'])}, ${pick(['Notarzt informiert', 'Antiallergikum gegeben', 'Zustand wird beobachtet'])}.`,

    // Children, older people, pregnancy
    () => `Kind, etwa ${n(2, 14)} Jahre alt, ${pick(['weint stark', 'ist still und blass', 'ruft nach den Eltern', 'hat einen Sturz erlebt'])}, ${pick(['Begleitperson wird gesucht', 'Eltern sind informiert', 'Betreuung übernommen'])}.`,
    () => `${pat()}, etwa ${n(65, 95)} Jahre alt, ${pick(['ist verwirrt', 'hat Brustschmerzen', 'ist im Badezimmer gestürzt', 'nimmt mehrere Medikamente ein'])}.`,
    () => `Patientin ${n(18, 45)} ist schwanger, ${pick(['im dritten Trimenon', 'in der Frühschwangerschaft', 'etwa im siebten Monat'])}, ${pick(['hat Blutungen', 'hat Bauchschmerzen', 'klagt über Kreislaufbeschwerden'])}.`,

    // Logistics and organisation
    () => `Bitte ${n(2, 20)} ${pick(X_ITEMS)} ${pick(X_DESTINATIONS)} ${pick(['bringen', 'schicken'])}.`,
    () => `Die ${pick(X_SUPPLY)} ist seit ${n(10, 90)} Minuten ${pick(['ausgefallen', 'nur eingeschränkt verfügbar', 'gestört'])}.`,
    () => `Wir brauchen ${n(2, 12)} ${pick(X_STAFF)} ${pick(X_STAFF_FOR)}.`,
    () => `${unit()} wird um ${time()} abgelöst, die Ablösung ist ${pick(['schon unterwegs', 'bereits eingetroffen', 'noch nicht erreichbar'])}.`,
    () => `Bitte die ersten ${n(5, 40)} Anhängekarten ${pick(['vollständig ausfüllen', 'gegenzeichnen', 'kontrollieren'])} und ${pick(['am Handgelenk befestigen', 'in die Ablage legen'])}.`,
    () => `Die Anhängekarte Nummer ${words(int(100, 999))} ist ${pick(['ausgegeben', 'eingezogen', 'verloren gegangen'])}.`,
    () => `Von ${n(10, 99)} gemeldeten Verletzten sind ${n(2, 9)} ${pick(['bereits im Krankenhaus', 'noch nicht gefunden', 'schon entlassen'])}.`,
    () => `Bisher ${n(10, 40)} Anhängekarten ausgegeben, ${n(2, 9)} davon ${pick(['für Kinder', 'für Senioren', 'mit roter Markierung'])}.`,

    // Relatives, shelter and counts
    () => { const t = pick(X_RELATIVES); return `${t[0]} sucht ${t[1]}, zuletzt gesehen um ${time()}, bitte ${pick(['Namen melden', 'Beschreibung aufnehmen', 'an die Betreuungsstelle verweisen'])}.`; },
    () => `Vor dem ${pick(X_SHELTERS)} warten ${n(5, 60)} Personen auf Informationen, ${pick(['sie werden registriert', 'eine Ansprechperson kommt', 'die Betreuung läuft'])}.`,
    () => `Die Liste der Vermissten wird in der ${pick(['Betreuungsstelle', 'Leitstelle', 'Auskunft'])} ${pick(['geführt', 'abgeglichen', 'erstellt'])}, ${n(2, 40)} Namen sind schon eingetragen.`,
    () => `Insgesamt ${n(10, 90)} Personen sind im Bereich ${section()} ${pick(['registriert', 'gesichtet', 'betreut'])}, davon ${n(2, 9)} ${pick(['Kinder', 'Senioren', 'Angehörige'])}.`,
    () => `Zwischenstand ${at()}: ${n(2, 20)} ${pick(['Patienten versorgt', 'Patienten transportiert', 'Patienten noch in Behandlung'])}, ${n(2, 15)} ${pick(['warten noch', 'sind unterwegs', 'warten auf Transport'])}.`,
    () => `Im Abschnitt ${section()} fehlen noch ${n(2, 12)} Personen, die Suche läuft ${pick(['weiter', 'mit zwei Trupps', 'seit einer Stunde', 'in den Kellerräumen'])}.`,

    // Safety and environment
    () => `Achtung, ${pick(X_DANGER)} ${hazard()}!`,
    () => `${pick(['Die Feuerwehr', 'Die Polizei', 'Die Leitstelle'])} meldet ${pick(['Gasgeruch', 'einen Schwelbrand', 'eine Ölspur', 'eine beschädigte Stromleitung', 'einen Erdrutsch'])} ${hazard()}, ${pick(['der Bereich wird weiträumig umgangen', 'Zugang nur mit Atemschutz', 'Einsatzkräfte bitte zurückhalten'])}.`,
    () => `Gefahrenbereich ${hazard()}, ${pick(['Betreten nur mit Schutzausrüstung', 'Zugang nur für Rettungskräfte', 'Abstand mindestens fünfzig Meter halten'])}.`,
    () => `Starker ${pick(['Regen', 'Wind', 'Schneefall', 'Nebel', 'Hagel'])} erschwert die Sichtung ${at()}, ${pick(['die Zelte bitte sichern', 'die Patienten bitte zudecken', 'mehr Material nachfordern'])}.`,
    () => `Die Temperatur liegt bei etwa ${n(1, 30)} Grad, ${pick(['die Patienten brauchen Wärme', 'Wärmefolien bereithalten', 'Patienten bitte im Windschutz lagern', 'die Decken nachfordern'])}.`,
    () => `Die Zufahrt über ${pick(X_ROUTES)} ist ${pick(['frei', 'gesperrt', 'nur für Rettungsfahrzeuge befahrbar', 'einspurig passierbar'])}, ${pick(['Fahrzeuge bitte umleiten', 'Lotsen sind eingewiesen', 'Rettungsgasse bitte freihalten'])}.`,
    () => `${unit()} meldet, dass die Straße ${pick(['hinter der Tankstelle', 'vor dem Friedhof', 'neben dem Spielplatz', 'an der Kreuzung'])} ${pick(['blockiert ist', 'frei ist', 'nur einspurig passierbar ist'])}.`,
    () => `In der ${pick(['Turnhalle', 'Aula', 'Mensa', 'Cafeteria', 'Sporthalle'])} der ${pick(['Grundschule', 'Realschule', 'Berufsschule'])} sind ${n(6, 80)} Personen untergebracht, ${pick(['die Lehrer bleiben bei ihnen', 'eine Betreuung ist vorhanden', 'alle sind unverletzt'])}.`,

    // Transport and handover
    () => `${unit()} übernimmt ${n(2, 4)} Patienten aus dem Bereich ${section()}, Abfahrt in ${n(3, 20)} Minuten.`,
    () => `Das Ziel für ${pat()} ist ${hosp()[0]}, ${pick(['die Voranmeldung ist erfolgt', 'die Voranmeldung läuft noch', 'die Klinik ist informiert'])}.`,
    () => `${hosp()[0]} meldet: ${pick(['Notaufnahme voll', 'Kinderstation aufnahmebereit', 'CT ist verfügbar', 'Intensivbett frei', 'Hubschrauberlandeplatz gesperrt', 'OP ist vorbereitet'])}.`,
    () => `Der Rettungshubschrauber ${pick(['ist im Anflug auf den Parkplatz Ost', 'landet auf dem Sportplatz'])}, Ankunft in ${n(3, 25)} Minuten.`,
    () => `Bitte ${n(2, 6)} Leichtverletzte mit einem ${pick(['Krankentransportwagen', 'Bus', 'Kleinbus'])} ${to()} bringen, ${pick(['Begleitung ist nicht nötig', 'Angehörige dürfen mitfahren'])}.`,
    () => `${rtw()} ${pick(['kommt ohne Patienten zurück', 'bleibt bis zur Ablösung am Sammelpunkt', 'wird am Rettungsmittelhalteplatz eingewiesen'])}.`,

    // Talking to patients
    () => `Können Sie ${pick(X_ASKS)}?`,
    () => `${pick(['Bitte bleiben Sie liegen', 'Bitte bleiben Sie ruhig sitzen', 'Bitte bewegen Sie sich nicht'])}, ${pick(['wir kümmern uns gleich um Sie', 'ein Kollege kommt gleich zu Ihnen', 'die Versorgung läuft schon'])}.`,
    () => `Ihre ${pick(['Verletzung', 'Wunde', 'Verbrennung'])} ${pick(['wird gerade versorgt', 'ist gut versorgt', 'sieht nicht gefährlich aus'])}, ${pick(['es dauert nicht mehr lange', 'Sie sind in guten Händen', 'bitte haben Sie noch etwas Geduld'])}.`,
    () => `Wie ${pick(['geht es Ihnen', 'fühlen Sie sich'])} ${pick(['jetzt', 'im Moment'])}?`,
    () => `Haben Sie ${pick(['Schwindel', 'Übelkeit', 'Kopfschmerzen', 'Atemnot', 'Schmerzen im Brustkorb', 'Taubheitsgefühl in den Händen'])}?`,

    // Patient-specific situations
    () => `${pat()} möchte ${pick(['nicht ins Krankenhaus', 'die Angehörigen anrufen', 'die Medikamente holen', 'nach Hause gehen'])}, ${pick(['bitte ruhig mit der Person sprechen', 'die Entscheidung wird dokumentiert', 'der Notarzt wird informiert'])}.`,
    () => `${pat()} verweigert ${pick(['die Untersuchung', 'den Transport', 'die Schmerzbehandlung', 'die Halskrause'])}, ${pick(['die Einwilligung wird geprüft', 'der Notarzt ist informiert', 'die Situation wird beobachtet'])}.`,
    () => `${pat()} ist ${pick(['sehr unruhig', 'stark verängstigt', 'aggressiv gegenüber dem Personal', 'still und apathisch'])}, ${pick(['behutsam ansprechen', 'eine Begleitperson bleibt in der Nähe', 'Sicherheit ist gewährleistet'])}.`,
    () => `${pat()} hat ${pick(['keine Papiere', 'keinen Ausweis', 'eine Adresse im Ausland'])} dabei, ${pick(['die Personalien werden später aufgenommen', 'die Polizei ist informiert'])}.`,
    () => `${pat()} spricht nur ${pick(X_LANGUAGES)}, ${pick(['ein Dolmetscher ist unterwegs', 'bitte Zeichen benutzen', 'ein Angehöriger übersetzt'])}.`,
  ];
}

/** One sentence: capitalised, Latin-1, no digits or quotes, one terminal mark. */
function check(s) {
  if (!/^[A-ZÄÖÜ]/.test(s)) throw new Error(`not capitalised: ${s}`);
  if (!/^[\x20-\x7e\u00a0-\u00ff]+$/.test(s)) throw new Error(`not Latin-1: ${s}`);
  if (/[\d'"\\]/.test(s)) throw new Error(`digit or quote: ${s}`);
  if (!/[^.!?][.!?]$/.test(s) || /[.!?]\s/.test(s)) throw new Error(`not exactly one sentence: ${s}`);
  return s;
}

/**
 * Passages from one template bank, `count` sentences in all. Templates take
 * turns adding a sentence they have not produced yet, so no template dominates;
 * then passages are dealt so that no passage holds two sentences from the same
 * template. `seen` is shared between banks, so no sentence appears twice.
 */
function dealPassages(makersOf, seed, count, seen) {
  const rand = mulberry32(seed);
  const makers = makersOf(rand);
  const buckets = makers.map(() => []);
  let active = makers.map((_, i) => i), total = 0;
  while (total < count) {
    if (!active.length) throw new Error(`templates ran out at ${total} sentences`);
    active = active.filter((i) => {
      if (total >= count) return true;
      for (let attempt = 0; attempt < 40; attempt++) {
        const s = check(cap(makers[i]()));
        if (seen.has(s)) continue;
        seen.add(s); buckets[i].push(s); total++;
        return true;
      }
      return false;
    });
  }

  const passages = [];
  while (passages.length < count / PER_PASSAGE) {
    const keys = buckets.map((b) => [b.length, rand()]);
    const order = buckets.map((_, i) => i).filter((i) => buckets[i].length)
      .sort((a, b) => keys[b][0] - keys[a][0] || keys[b][1] - keys[a][1]);
    if (order.length < PER_PASSAGE) throw new Error('too few templates left for a passage');
    const passage = order.slice(0, PER_PASSAGE).map((i) => buckets[i].splice(Math.floor(rand() * buckets[i].length), 1)[0]);
    shuffle(passage, rand);
    passages.push(passage);
  }
  shuffle(passages, rand);
  return passages;
}

/** The whole corpus in passage order: the original 800, then the extension. */
export function buildCorpus() {
  const seen = new Set();
  const original = dealPassages(templates, SEED, BASE_COUNT, seen);
  const extension = dealPassages(extensionTemplates, EXTENSION_SEED, COUNT - BASE_COUNT, seen);
  return [...original.flat(), ...extension.flat()];
}

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** The corpus file the page loads: a classic script that sets window.JAR_SENTENCES. */
export function corpusFile(sentences) {
  return `/* J.A.R. read-aloud corpus ${CORPUS_NAME}: ${sentences.length} sentences, ` +
    `${sentences.length / PER_PASSAGE} passages of ${PER_PASSAGE}.\n` +
    '   Generated by tools/record-sentences.mjs. Do not edit: change the templates and regenerate. */\n' +
    'window.JAR_SENTENCES = [\n' + sentences.map((s) => `  '${s}'`).join(',\n') + '\n];\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sentences = buildCorpus();
  fs.mkdirSync(path.dirname(CORPUS_FILE), { recursive: true });
  fs.writeFileSync(CORPUS_FILE, corpusFile(sentences));
  let page = fs.readFileSync(PAGE, 'utf8');
  // The markup shows the first passage until the script picks one.
  const first = sentences.slice(0, PER_PASSAGE).join(' ');
  page = page.replace(/(data-rec-text="">)[^<]*(<\/blockquote>)/, `$1„${first}“$2`);
  fs.writeFileSync(PAGE, page);

  const lengths = [];
  for (let i = 0; i < sentences.length; i += PER_PASSAGE) {
    lengths.push(sentences.slice(i, i + PER_PASSAGE).join(' ').split(/\s+/).length);
  }
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  console.log(`${sentences.length} sentences, ${lengths.length} passages; ` +
    `words per passage: min ${Math.min(...lengths)}, mean ${mean.toFixed(1)}, max ${Math.max(...lengths)}`);
}
