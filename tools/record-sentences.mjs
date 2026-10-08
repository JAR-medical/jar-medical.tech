// The read-aloud corpus of mitmachen-aufnahme.html: 800 German sentences in
// the style of mSTaRT pre-triage radio traffic, served as 100 passages of 8.
//
//   node tools/record-sentences.mjs    rewrite the corpus inlined in the page
//
// The output is deterministic (fixed seed), so a sentence id such as s042
// always names the same words. Numbers are written out so the expected text
// matches what is said, and every character is Latin-1 because the WAV INFO
// chunk is. Any change to the wording changes recorded data: bump CORPUS in
// the page's record.js along with it. tests/recording.test.mjs fails while
// the page and this generator disagree.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const COUNT = 800;
export const PER_PASSAGE = 8;
const SEED = 0x4a4152; // "JAR"
const PAGE = fileURLToPath(new URL('../mitmachen-aufnahme.html', import.meta.url));

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

/** One sentence: capitalised, Latin-1, no digits or quotes, one terminal mark. */
function check(s) {
  if (!/^[A-ZÄÖÜ]/.test(s)) throw new Error(`not capitalised: ${s}`);
  if (!/^[\x20-\x7e\u00a0-\u00ff]+$/.test(s)) throw new Error(`not Latin-1: ${s}`);
  if (/[\d'"\\]/.test(s)) throw new Error(`digit or quote: ${s}`);
  if (!/[^.!?][.!?]$/.test(s) || /[.!?]\s/.test(s)) throw new Error(`not exactly one sentence: ${s}`);
  return s;
}

/**
 * The corpus, in passage order. Templates take turns adding a sentence they
 * have not produced yet, so no template dominates; then passages are dealt
 * so that no passage holds two sentences from the same template.
 */
export function buildCorpus() {
  const rand = mulberry32(SEED);
  const makers = templates(rand);
  const seen = new Set();
  const buckets = makers.map(() => []);
  let active = makers.map((_, i) => i), total = 0;
  while (total < COUNT) {
    if (!active.length) throw new Error(`templates ran out at ${total} sentences`);
    active = active.filter((i) => {
      if (total >= COUNT) return true;
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
  while (passages.length < COUNT / PER_PASSAGE) {
    const keys = buckets.map((b) => [b.length, rand()]);
    const order = buckets.map((_, i) => i).filter((i) => buckets[i].length)
      .sort((a, b) => keys[b][0] - keys[a][0] || keys[b][1] - keys[a][1]);
    if (order.length < PER_PASSAGE) throw new Error('too few templates left for a passage');
    const passage = order.slice(0, PER_PASSAGE).map((i) => buckets[i].splice(Math.floor(rand() * buckets[i].length), 1)[0]);
    shuffle(passage, rand);
    passages.push(passage);
  }
  shuffle(passages, rand);
  return passages.flat();
}

function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** The page's JavaScript array literal for the corpus, one sentence per line. */
export function corpusSource(sentences) {
  return '  var SENTENCES = [\n' + sentences.map((s) => `    '${s}'`).join(',\n') + '\n  ];\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sentences = buildCorpus();
  let page = fs.readFileSync(PAGE, 'utf8');
  const block = /(\/\* sentences:begin \*\/\n)[\s\S]*?(  \/\* sentences:end \*\/)/;
  if (!block.test(page)) throw new Error('sentences:begin/end markers not found in mitmachen-aufnahme.html');
  page = page.replace(block, (_, open, close) => open + corpusSource(sentences) + close);
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
