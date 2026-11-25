# Artifact relocation index

The companion ZIP `hex_wargame_v417_HISTORICAL_EVIDENCE.zip` contains retired material from checkpoint 182, not required for current gameplay. Every retired item retains its exact checkpoint-182 path in the companion ZIP (aside from the three former root documentation files stored under `history/checkpoint-182/`). The accompanying `HISTORY_MANIFEST.json` identifies each path and SHA-256.

| Retired category | Prior location | Treatment |
|---|---|---|
| Old diagnostics and screenshots | `rules/audit/visual/` | Moved to history unless needed for an active source regression |
| Obsolete Leningrad comparison PNGs | `exports/` | Moved to history; five current exports retained |
| Generated large reference-counter PNG sheets | `assets/official-counters/reference-sheets/` | Moved to history; original counter master and JPG sheets retained |
| Root export/render logs | Project root | Moved to history |
| Old checkpoint packagers | `scripts/`, `tools/` | Moved to history to prevent use of stale package file lists |
| Overlapping checkpoint manifests | Project root | Moved to history; new single manifest generated |
| Full previous PLAN, README, UPDATE | Project root | Replaced with concise current docs; originals moved to history |

The active project now contains only `rules/audit/visual/arduous-river-candidates.png`, derived from the approved map PNG. Older ambiguity diagnostics are not dependencies and are not included in the current source distribution. The companion v417 history ZIP is unchanged.
