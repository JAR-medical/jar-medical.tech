// Where the patients are — the bridge between the scenario data and the room.
//
// The roster already carries a grid reference per patient (`location`: "C2",
// "B3", "F6" …) — the same Ablage grid the Einsatzleitung dashboard shows. This
// turns those cells into metres so the AR client can do two things the flat web
// client cannot:
//
//   • draw a minimap (Lagekarte) with everyone in their cell, and
//   • notice when the medic has physically walked up to a patient.
//
// The grid is anchored to the room once, at the start: the medic stands at the
// edge of the field, looks across it and confirms. Everything after that is
// relative to that pose, so an exercise in a gym hall lines up with the roster
// without any surveying.
//
// Coordinate convention: +Z of the field points away from the medic's alignment
// pose (rows increase into the field), +X to the right (columns A→G).

using System.Collections.Generic;
using UnityEngine;

namespace JAR
{
    public sealed class ScenarioLayout
    {
        /// Metres between two grid cells.
        public float CellSize = 3f;

        /// Metres from the alignment pose to the centre of the field.
        public float FieldDistance = 6f;

        readonly Dictionary<int, Vector2Int> _cells = new Dictionary<int, Vector2Int>();
        readonly Dictionary<int, Vector3> _local = new Dictionary<int, Vector3>();

        int _minCol, _maxCol, _minRow, _maxRow;
        Vector3 _anchor;
        Quaternion _rot = Quaternion.identity;

        public bool Aligned { get; private set; }
        public bool HasCells => _cells.Count > 0;

        public int MinCol => _minCol;
        public int MaxCol => _maxCol;
        public int MinRow => _minRow;
        public int MaxRow => _maxRow;
        public int Columns => _maxCol - _minCol + 1;
        public int Rows => _maxRow - _minRow + 1;

        // --- building ---------------------------------------------------------

        /// Read every patient's grid cell and lay the field out around its centre.
        public void Build(IEnumerable<Patient> patients)
        {
            _cells.Clear();
            _local.Clear();
            _minCol = _minRow = int.MaxValue;
            _maxCol = _maxRow = int.MinValue;

            foreach (var p in patients)
            {
                if (p == null || !TryParseCell(p.location, out int col, out int row)) continue;
                _cells[p.markerId] = new Vector2Int(col, row);
                if (col < _minCol) _minCol = col;
                if (col > _maxCol) _maxCol = col;
                if (row < _minRow) _minRow = row;
                if (row > _maxRow) _maxRow = row;
            }

            if (_cells.Count == 0)
            {
                _minCol = _maxCol = 0;
                _minRow = _maxRow = 1;
                return;
            }

            float cx = (_minCol + _maxCol) * 0.5f;
            float cz = (_minRow + _maxRow) * 0.5f;
            foreach (var kv in _cells)
                _local[kv.Key] = new Vector3((kv.Value.x - cx) * CellSize, 0f, (kv.Value.y - cz) * CellSize);
        }

        /// Pin the field to the room: the medic stands here, looking that way.
        public void Align(Vector3 headPosition, Vector3 headForward)
        {
            var flat = new Vector3(headForward.x, 0f, headForward.z);
            if (flat.sqrMagnitude < 1e-4f) flat = Vector3.forward;
            flat = flat.normalized;

            _rot = Quaternion.LookRotation(flat, Vector3.up);
            _anchor = new Vector3(headPosition.x, headPosition.y, headPosition.z) + flat * FieldDistance;
            Aligned = true;
        }

        // --- lookups ----------------------------------------------------------

        public bool TryCell(int markerId, out int col, out int row)
        {
            if (_cells.TryGetValue(markerId, out var c)) { col = c.x; row = c.y; return true; }
            col = row = 0;
            return false;
        }

        public bool TryWorld(int markerId, out Vector3 world)
        {
            if (_local.TryGetValue(markerId, out var local))
            {
                world = _anchor + _rot * local;
                return true;
            }
            world = Vector3.zero;
            return false;
        }

        public float Distance(int markerId, Vector3 from)
        {
            if (!TryWorld(markerId, out var w)) return float.PositiveInfinity;
            // Horizontal distance only — head height must not count as "far away".
            float dx = w.x - from.x, dz = w.z - from.z;
            return Mathf.Sqrt(dx * dx + dz * dz);
        }

        /// Closest patient from `candidates` within `maxDistance` metres.
        public bool TryNearest(Vector3 from, IEnumerable<int> candidates, float maxDistance,
                               out int markerId, out float distance)
        {
            markerId = -1;
            distance = float.PositiveInfinity;
            if (!Aligned) return false;

            foreach (int id in candidates)
            {
                float d = Distance(id, from);
                if (d < distance) { distance = d; markerId = id; }
            }
            if (markerId < 0 || distance > maxDistance) { markerId = -1; return false; }
            return true;
        }

        // --- minimap mapping --------------------------------------------------

        /// Cell → 0..1 inside the grid bounds (x = column, y = row, y grows away).
        public Vector2 Normalized(int col, int row) => new Vector2(
            (col - _minCol + 0.5f) / Columns,
            (row - _minRow + 0.5f) / Rows);

        public bool TryNormalized(int markerId, out Vector2 uv)
        {
            if (TryCell(markerId, out int col, out int row)) { uv = Normalized(col, row); return true; }
            uv = Vector2.zero;
            return false;
        }

        /// World position → 0..1 in grid space. Values outside 0..1 mean the
        /// medic is off the mapped field; the minimap clamps for drawing.
        public Vector2 NormalizedFromWorld(Vector3 world)
        {
            if (!Aligned) return new Vector2(0.5f, 0.5f);

            var local = Quaternion.Inverse(_rot) * (world - _anchor);
            float cx = (_minCol + _maxCol) * 0.5f;
            float cz = (_minRow + _maxRow) * 0.5f;
            float colF = local.x / Mathf.Max(0.01f, CellSize) + cx;
            float rowF = local.z / Mathf.Max(0.01f, CellSize) + cz;
            return new Vector2(
                (colF - _minCol + 0.5f) / Columns,
                (rowF - _minRow + 0.5f) / Rows);
        }

        /// Medic heading as a rotation about the minimap's "up" (degrees).
        public float HeadingDegrees(Vector3 headForward)
        {
            if (!Aligned) return 0f;
            var local = Quaternion.Inverse(_rot) * new Vector3(headForward.x, 0f, headForward.z);
            return Mathf.Atan2(local.x, local.z) * Mathf.Rad2Deg;
        }

        // --- cell parsing -----------------------------------------------------

        /// "C2" → col 2 (A = 0), row 2. Tolerates lower case and stray spaces.
        public static bool TryParseCell(string location, out int col, out int row)
        {
            col = 0; row = 0;
            if (string.IsNullOrEmpty(location)) return false;

            string s = location.Trim();
            if (s.Length < 2) return false;

            char c = char.ToUpperInvariant(s[0]);
            if (c < 'A' || c > 'Z') return false;
            col = c - 'A';

            if (!int.TryParse(s.Substring(1), out row)) return false;
            return row > 0;
        }

        public static string ColumnLabel(int col) =>
            col >= 0 && col < 26 ? ((char)('A' + col)).ToString() : "?";

        public string CellLabel(int markerId) =>
            TryCell(markerId, out int col, out int row) ? ColumnLabel(col) + row : "—";
    }
}
