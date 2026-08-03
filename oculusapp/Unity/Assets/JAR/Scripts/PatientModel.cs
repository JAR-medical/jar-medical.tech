// J.A.R. AR-Client (Unity / Meta Quest) — patient data model.
//
// C# port of js/data.js: the same triage classes, colours and 12-patient A9
// coach MANV roster used by the WebXR client and the Einsatzleitung dashboard,
// so a marker resolves to an identical record on the glasses and the board.
//
// In the shipping product these stream from the FastAPI hub; here the roster is
// bundled. The mutation helpers (SetCategory / AddTreatment / AddInjury /
// AddNote) are the seams where the real PATCH + WebSocket sync would attach.

using System;
using System.Collections.Generic;
using UnityEngine;

namespace JAR
{
    public enum Triage { SK1, SK2, SK3, SK4, DECEASED, UNSIGHTED }

    public static class TriageMeta
    {
        public static string Label(Triage t) => t switch
        {
            Triage.SK1 => "SK I — rot",
            Triage.SK2 => "SK II — gelb",
            Triage.SK3 => "SK III — grün",
            Triage.SK4 => "SK IV — blau",
            Triage.DECEASED => "verstorben",
            _ => "ungesichtet",
        };

        public static string Short(Triage t) => t switch
        {
            Triage.SK1 => "ROT",
            Triage.SK2 => "GELB",
            Triage.SK3 => "GRÜN",
            Triage.SK4 => "BLAU",
            Triage.DECEASED => "SCHWARZ",
            _ => "UNGESICHTET",
        };

        public static string Spoken(Triage t) => t switch
        {
            Triage.SK1 => "rot",
            Triage.SK2 => "gelb",
            Triage.SK3 => "grün",
            Triage.SK4 => "blau",
            Triage.DECEASED => "schwarz",
            _ => "ungesichtet",
        };

        public static Color Color(Triage t) => t switch
        {
            Triage.SK1 => Hex("#e5484d"),
            Triage.SK2 => Hex("#f5b301"),
            Triage.SK3 => Hex("#46a758"),
            Triage.SK4 => Hex("#3e7bfa"),
            Triage.DECEASED => Hex("#6f6f6f"),
            _ => Hex("#4a5561"),
        };

        public static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return c;
        }
    }

    // Nullable ints model "value present or not" exactly like the JS record.
    public class Vitals
    {
        public int? breathingRate, pulse, spo2, bpSystolic, bpDiastolic, gcs;
        public bool Any => breathingRate != null || pulse != null || spo2 != null
                           || bpSystolic != null || gcs != null;
    }

    public class ProtocolEntry
    {
        public string author;
        public string transcript;
        public DateTime timestamp;
    }

    public class Patient
    {
        public int markerId;
        public Triage category;
        public string sex;               // "m" | "w" | null
        public int? ageEstimate;
        public bool? ambulatory, conscious, airwayClear;
        public string location;
        public Vitals vitals = new Vitals();
        public List<string> injuries = new List<string>();
        public List<string> treatments = new List<string>();
        public List<ProtocolEntry> protocol = new List<ProtocolEntry>();
        public DateTime updatedAt = DateTime.Now;
        public string lastSeenBy;
        public DateTime? lastSeenAt;
    }

    /// The scenario store. Seeds the 12 patients on first use; edits persist for
    /// the session. Mirrors js/data.js resolvePatient / setCategory / etc.
    public class PatientStore
    {
        readonly Dictionary<int, Patient> _store = new Dictionary<int, Patient>();
        public readonly List<int> MarkerIds = new List<int>();

        public PatientStore()
        {
            foreach (var p in Roster.Build())
            {
                _store[p.markerId] = p;
                MarkerIds.Add(p.markerId);
            }
            MarkerIds.Sort();
        }

        public bool IsKnown(int markerId) => _store.ContainsKey(markerId);
        public Patient Resolve(int markerId) => _store.TryGetValue(markerId, out var p) ? p : null;

        public void MarkSeen(int markerId, string by = "AR-Client")
        {
            var p = Resolve(markerId);
            if (p == null) return;
            p.lastSeenBy = by;
            p.lastSeenAt = DateTime.Now;
        }

        public void SetCategory(int markerId, Triage cat)
        {
            var p = Resolve(markerId);
            if (p == null) return;
            p.category = cat;
            Touch(p, $"Sichtungskategorie gesetzt: {TriageMeta.Label(cat)}");
        }

        public void AddTreatment(int markerId, string treatment)
        {
            var p = Resolve(markerId);
            if (p == null || string.IsNullOrWhiteSpace(treatment)) return;
            if (!p.treatments.Contains(treatment)) p.treatments.Add(treatment);
            Touch(p, $"Maßnahme dokumentiert: {treatment}");
        }

        public void AddInjury(int markerId, string injury)
        {
            var p = Resolve(markerId);
            if (p == null || string.IsNullOrWhiteSpace(injury)) return;
            if (!p.injuries.Contains(injury)) p.injuries.Add(injury);
            Touch(p, $"Befund dokumentiert: {injury}");
        }

        public void AddNote(int markerId, string note)
        {
            var p = Resolve(markerId);
            if (p == null || string.IsNullOrWhiteSpace(note)) return;
            Touch(p, note);
        }

        static void Touch(Patient p, string transcript)
        {
            p.updatedAt = DateTime.Now;
            p.protocol.Add(new ProtocolEntry
            {
                author = "AR-Client",
                transcript = transcript,
                timestamp = DateTime.Now,
            });
        }
    }

    /// The 12-patient roster — identical records to js/data.js / the dashboard.
    public static class Roster
    {
        static Vitals V(int? af = null, int? pulse = null, int? spo2 = null,
                        int? sys = null, int? dia = null, int? gcs = null)
            => new Vitals { breathingRate = af, pulse = pulse, spo2 = spo2,
                            bpSystolic = sys, bpDiastolic = dia, gcs = gcs };

        static Patient P(int id, Triage cat, string sex, int age, bool ambulatory,
                         bool conscious, bool airway, string loc, Vitals v,
                         string[] injuries, string[] treatments, string author, string first)
        {
            var p = new Patient
            {
                markerId = id, category = cat, sex = sex, ageEstimate = age,
                ambulatory = ambulatory, conscious = conscious, airwayClear = airway,
                location = loc, vitals = v,
                injuries = new List<string>(injuries),
                treatments = new List<string>(treatments),
            };
            p.protocol.Add(new ProtocolEntry { author = author, transcript = first, timestamp = DateTime.Now });
            return p;
        }

        public static List<Patient> Build() => new List<Patient>
        {
            P(1, Triage.SK1, "m", 45, false, false, false, "C2",
                V(32,130,84,90,60,6),
                new[]{"Thoraxtrauma","Schädel-Hirn-Trauma"}, new[]{"Sauerstoff","HWS-Immobilisation"},
                "Trupp-1", "Männlich, ca. 45, bewusstlos, Schnappatmung, instabiler Thorax — rot."),
            P(2, Triage.SK1, "w", 31, false, true, true, "B3",
                V(28,124,90,95,null,13),
                new[]{"offene Femurfraktur","starke Blutung"}, new[]{"Tourniquet","Druckverband"},
                "Trupp-2", "Weiblich, ca. 30, spritzende Blutung Oberschenkel. Tourniquet gesetzt — rot."),
            P(3, Triage.SK2, "m", 52, false, true, true, "D3",
                V(18,96,96,130,85,15),
                new[]{"Unterschenkelfraktur geschlossen"}, new[]{"Vakuumschiene","Analgesie"},
                "Trupp-1", "Männlich, ca. 50, Unterschenkel deformiert, ansprechbar, kreislaufstabil — gelb."),
            P(4, Triage.SK2, "w", 24, false, true, true, "D4",
                V(20,104,95,110,70,14),
                new[]{"V. a. Beckentrauma","Abdomen druckschmerzhaft"}, new[]{"Beckenschlinge"},
                "Trupp-2", "Weiblich, ca. 25, Beckenschmerz, Abdomen gespannt — gelb, engmaschig beobachten."),
            P(5, Triage.SK3, "m", 19, true, true, true, "F6",
                V(16,82,99,125,null,15),
                new[]{"Schürfwunden","Prellungen"}, new string[0],
                "Trupp-2", "Männlich, jung, gehfähig, nur Schürfwunden — grün, zum Sammelplatz."),
            P(6, Triage.SK3, "w", 38, true, true, true, "G6",
                V(15,78,99,null,null,15),
                new[]{"HWS-Distorsion"}, new string[0],
                "Trupp-2", "Weiblich, ca. 40, Nackenschmerz, gehfähig, stabil — grün."),
            P(7, Triage.SK2, "m", 60, false, true, true, "E3",
                V(22,110,93,150,95,15),
                new[]{"thorakaler Druck","kardiale Vorerkrankung"}, new[]{"Sauerstoff","Monitoring"},
                "Trupp-1", "Männlich, ca. 60, Thoraxschmerz, bekannte KHK — gelb, EKG anfordern."),
            P(8, Triage.SK1, "w", 8, false, false, true, "C3",
                V(30,140,88,null,null,8),
                new[]{"Schädel-Hirn-Trauma","Platzwunde"}, new[]{"Sauerstoff","Wärmeerhalt"},
                "Trupp-1", "Kind, ca. 8, somnolent, GCS 8, Kopfplatzwunde — rot, NEF dringend."),
            P(9, Triage.SK3, "m", 27, true, true, true, "F5",
                V(16,80,99,null,null,15),
                new[]{"oberflächliche Schnittwunden"}, new string[0],
                "Trupp-2", "Männlich, gehfähig, kleine Schnittwunden am Arm — grün."),
            P(10, Triage.SK2, "w", 44, false, true, true, "E4",
                V(21,100,94,120,null,15),
                new[]{"Klavikulafraktur","Rippenserienfraktur"}, new[]{"Analgesie","Sauerstoff"},
                "Trupp-1", "Weiblich, ca. 45, Rippenserie links, atemabhängiger Schmerz — gelb."),
            P(11, Triage.DECEASED, "m", 70, false, false, false, "A2",
                V(),
                new[]{"keine Lebenszeichen"}, new string[0],
                "Trupp-1", "Männlich, ca. 70, keine Atmung, keine Reaktion, keine Zeichen — schwarz."),
            P(12, Triage.SK4, "m", 66, false, false, false, "B2",
                V(8,40,70,null,null,3),
                new[]{"schwerstes Polytrauma"}, new[]{"Sauerstoff","betreuende Maßnahmen"},
                "LNA", "Männlich, ca. 65, infauste Prognose, Behandlung nachrangig — SK IV (blau)."),
        };
    }
}
