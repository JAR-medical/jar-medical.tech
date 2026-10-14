# J.A.R. Corporate — Schulungsportal

Kundenportal unter **jar-medical.tech/corporate/**. Kunden legen selbst ein Konto
an, fragen Kurse an und lernen nach der Freischaltung. Admins sehen alle Kunden,
entscheiden Anfragen und schalten Kurse frei oder entziehen sie.

Statisch wie der Rest der Website: HTML, CSS, ES-Module, kein Build-Schritt.
Das Aussehen folgt den dunklen Seiten der Website (`css/showcase.css` dort):
[`css/tokens.css`](css/tokens.css) ist eine wörtliche Kopie des
`css/tokens.css`-Blocks, den jede Seite inline trägt — bei Änderungen an den
Tokens der Website mitziehen. [`css/portal.css`](css/portal.css) verwendet nur
diese Variablen. Die Sprachwahl teilt sich das Portal mit der Website
(`localStorage` „jar.lang“). Die Bewegung ([`js/motion.js`](js/motion.js)) folgt
`js/scroll-fx.js` und `js/waveform.js` der Website: rein an die Scrollposition
gebunden, rückwärts umkehrbar, aus bei „Bewegung reduzieren“.
Anmeldung und Datenbank liefert **[Supabase](https://supabase.com)** (Supabase
Auth + Postgres). Wer was lesen und schreiben darf, entscheiden die
Row-Level-Security-Regeln in [`supabase/schema.sql`](supabase/schema.sql) auf dem
Server — nicht der Browser.

| Seite | Wer | Inhalt |
|---|---|---|
| `index.html` | alle | Vorstellung, Kurskatalog, Anmelden / Registrieren / Passwort vergessen |
| `dashboard.html` | Kunden | eigene Kurse mit Fortschritt, Kurse anfragen, Anfragen, Profil |
| `course.html?c=<id>` | freigeschaltete Kunden | Lektionen, Quiz, Teilnahmebestätigung zum Drucken |
| `admin.html` | Admins | Kennzahlen, offene Anfragen, alle Kunden, Freischalten / Entziehen |
| `reset.html` | Link aus der Mail | neues Passwort setzen |

## Demo-Modus

Solange `SUPABASE_URL` in [`js/config.js`](js/config.js) leer ist, läuft das
Portal im **Demo-Modus**: keine echte Anmeldung, alle Daten nur im
`localStorage` dieses Browsers, mit Beispielkunden vorbelegt. Ein Banner weist
darauf hin. Als Admin anmelden: `admin@jar-medical.tech` mit beliebigem Passwort.
Gut zum Vorführen — **nicht** für echte Kunden.

## Einrichtung mit Supabase (einmalig, ca. 15 Minuten)

1. **Projekt anlegen** auf supabase.com. Region **Central EU (Frankfurt)**, damit
   die Daten in der EU liegen. Achtung Free-Plan: Projekte ohne Aktivität werden
   nach einer Woche pausiert; dann scheitert jede Anmeldung, bis man das Projekt
   im Dashboard wieder startet.
2. **Schema einspielen:** Dashboard → *SQL Editor* → Inhalt von
   `supabase/schema.sql` einfügen → *Run*. Das Skript lässt sich gefahrlos
   erneut ausführen.
3. **Auth konfigurieren:** *Authentication → URL Configuration*
   - Site URL: `https://jar-medical.tech/corporate/`
   - Redirect URLs: `https://jar-medical.tech/corporate/dashboard.html` und
     `https://jar-medical.tech/corporate/reset.html` (für lokale Tests zusätzlich
     `http://127.0.0.1:8767/**`)
   - *Authentication → Sign In / Providers → Email*: „Confirm email“ an,
     Mindestlänge des Passworts 8 (wie im Formular).
4. **Absender-Mail (Pflicht für echte Kunden):** Ohne eigenen SMTP-Server
   verschickt Supabase Bestätigungs- und Passwort-Mails nur an Mitglieder des
   eigenen Supabase-Teams und nur wenige pro Stunde. Unter
   *Authentication → Emails → SMTP Settings* einen Anbieter eintragen (z. B.
   Resend, Brevo, Postmark) mit Absender `noreply@jar-medical.tech`; dafür beim
   Anbieter die Domain per DNS (SPF/DKIM) bestätigen. Die Mailtexte lassen sich
   unter *Authentication → Emails → Templates* auf Deutsch umstellen.
5. **Schlüssel eintragen:** *Project Settings → API Keys* → den
   **Publishable key** (`sb_publishable_…`) als `SUPABASE_ANON_KEY` und die
   Project URL (`https://<projekt>.supabase.co`, unter *Project Settings → Data
   API*) als `SUPABASE_URL` in `js/config.js`. Der Publishable key ist öffentlich
   gedacht und darf ins Repository. **Den Secret key (`sb_secret_…`) bzw. den
   alten `service_role`-Key niemals.**
6. **Admin werden:** Auf der Seite ganz normal registrieren und die Mail
   bestätigen, dann im SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'sie@jar-medical.tech';
   ```
7. **Optional — Anmeldung mit Google, Apple, Microsoft, GitHub:** Wer sich
   damit zum ersten Mal anmeldet, bekommt automatisch ein Konto. Je Anbieter:
   in dessen Entwicklerkonsole eine App registrieren, Client-ID und Secret unter
   *Authentication → Providers* in Supabase eintragen, als Redirect-URL dort die
   Callback-Adresse angeben, die Supabase anzeigt
   (`https://<projekt>.supabase.co/auth/v1/callback`), und die Kennung in
   `OAUTH_PROVIDERS` in `js/config.js` aufnehmen — z. B.
   `["google", "apple", "azure"]`. Dann erscheinen die Knöpfe „Weiter mit …“.

   | Anbieter | Kennung | wo registrieren | Hinweis |
   |---|---|---|---|
   | Google | `google` | Google Cloud Console → APIs & Services → Credentials | kostenlos; OAuth-Zustimmungsbildschirm ausfüllen |
   | Apple | `apple` | Apple Developer → Certificates, IDs & Profiles (Services ID + Key) | braucht ein Apple-Developer-Konto (99 $/Jahr); Apple liefert den Namen nur beim ersten Login |
   | Microsoft | `azure` | Microsoft Entra ID → App registrations | passt zu Organisationen mit Microsoft-365-Konten |
   | GitHub | `github` | GitHub → Settings → Developer settings → OAuth Apps | eher für Entwickler |

   Diese Anbieter liefern höchstens einen Namen, nie die Organisation. Das
   Dashboard fordert deshalb zum Vervollständigen des Profils auf, und Kurse
   lassen sich erst mit Name und Organisation anfragen (die Datenbank prüft das
   in `request_course()`). Unter den Knöpfen steht ein Hinweis auf die
   Datenschutzerklärung, weil hier kein Häkchen gesetzt wird.

### Datenschutz

Mit Supabase (Konten, Datenbank) und Resend (Anmelde-Mails) verarbeiten zwei
Dienstleister personenbezogene Daten (Name, Organisation, E-Mail,
Lernfortschritt). Abschnitt 6 von `../datenschutz.html` beschreibt das Portal;
die Registrierung verlinkt dorthin (`#ds-portal`). Wer dort etwas ändert —
neuer Dienst, Anmeldung über Google/Apple/Microsoft, andere Region als Irland,
supabase-js von einem CDN statt aus `vendor/` —, muss den Abschnitt mitziehen.
Die Auftragsverarbeitungsverträge beider Anbieter gelten mit Annahme ihrer
Nutzungsbedingungen; Version und Datum für die eigenen Unterlagen festhalten.

**Konto löschen** (Anspruch aus Abschnitt 6): Supabase → *Authentication →
Users* → Nutzer → *Delete user*. Profil, Anfragen, Freischaltungen und
Fortschritt werden mitgelöscht (`on delete cascade`).

## Was die Datenbank absichert

- Jedes neue Konto ist `client`. Die Rolle kann kein Nutzer selbst ändern —
  Kunden dürfen an ihrem Profil nur Name und Organisation schreiben.
- Kunden sehen nur ihr eigenes Profil, ihre Anfragen, Freischaltungen und
  Fortschritte; Admins sehen alles.
- Anfragen entstehen nur über `request_course()` (eine offene Anfrage je Kurs,
  keine für bereits freigeschaltete Kurse); entschieden werden sie nur über
  `decide_request()`, und nur von Admins. Freischalten schließt eine offene
  Anfrage automatisch.
- Fortschritt lässt sich nur für freigeschaltete Kurse und nur für Lektionen
  speichern, die in `course_lessons` stehen. Entziehen löscht den Fortschritt
  nicht.

**Grenze:** Die Kursinhalte selbst liegen als statische Dateien auf der Website
(`js/courses/`). Die Freischaltung regelt, wer den Kurs im Portal belegt und wer
Fortschritt sammelt — sie hält die Texte nicht geheim. Für vertrauliche
Inhalte müssten sie in eine Supabase-Tabelle oder in Supabase Storage mit
eigenen Regeln.

## Einen Kurs hinzufügen

1. `js/courses/<id>.js` im Format von `katastrophenschutz.js` anlegen
   (zweisprachig DE/EN, Bausteine `p`, `h`, `list`, `steps`, `callout`,
   `table`, `figure`, `link`, je Lektion ein Quiz).
2. In `js/catalog.js` importieren und in `COURSES` aufnehmen.
3. In `supabase/schema.sql` den Kurs bei `courses` und alle Lektions-IDs bei
   `course_lessons` ergänzen, dann das Skript erneut im SQL Editor ausführen.
   Fehlt eine Lektion dort, schlägt das Speichern des Fortschritts fehl.

`npm test` prüft, dass Kursdateien und `course_lessons` zusammenpassen.

## Tests

```sh
npm install   # einmalig: PGlite (Postgres im Prozess) für den Schema-Test
npm test
```

- `tests/content.test.mjs` prüft jede Kursdatei (Übersetzungen vollständig,
  Quiz-Antworten gültig, Minuten stimmen) und den Abgleich mit `course_lessons`.
- `tests/demo-backend.test.mjs` prüft, dass das Demo-Backend dieselben Regeln
  durchsetzt wie die Datenbank.
- `tests/rls.test.mjs` spielt `schema.sql` in ein echtes Postgres (PGlite) mit
  nachgebildetem Supabase-`auth`-Schema und prüft die Zugriffsregeln aus Sicht
  zweier Kunden, eines Admins und eines anonymen Besuchers.

Lokal ansehen: im Repository-Wurzelverzeichnis `python3 -m http.server 8765`,
dann `http://localhost:8765/corporate/`. (Über `file://` laden Browser keine
ES-Module.)
