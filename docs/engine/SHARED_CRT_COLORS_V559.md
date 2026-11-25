# Checkpoint 324 / v559 — CRT color presentation

**Checkpoint 324 / v559 — shared Standard and Advanced CRT color presentation.** Standard (36 cells) now uses the reference palette in Battle for Moscow Rules reference and historical Settings. Both modes use one browser-only table renderer, alternating black/charcoal headers, alternating gray result cells, yellow/orange EX, red AL and muted gray-green DE. Both original engine matrices remain unchanged. The supplied Standard image has different die-result assignments from the active Oberlabs table; displayed values intentionally follow the actual engine, not the conflicting illustration. Standard remains default. Node Advanced/shared CRT tests pass (301 assertions and 36 cells × five mappings); actual Chromium B4M and Kiev–Odessa tests pass (20 + 35 assertions), including displayed matrix parity, color, toggle and save/restore. No gameplay, map or counter changes. See `docs/engine/SHARED_CRT_COLORS_V559.md`.

## Browser evidence

- `rules/audit/visual/standard-crt-b4m-v559.png`
- `rules/audit/visual/standard-crt-kiev-odessa-v559.png`

## Verification scope

The native and historical browser paths were exercised in Chromium. No fresh full campaign run or independent visual check of every scenario is claimed. The common historical renderer is shared. Both authoritative lookup modules and engine bundle remain unchanged.
