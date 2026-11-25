# Checkpoint 293 / v527 — Active composite entry edge reconciliation

## Why this checkpoint is necessary

The earlier v526 eastern communication preflight traced `map.entryBoundarySelections` (an inherited Kiev-era snapped visual path). In the 261-hex combined board this record has 26 Soviet marked sides, two of which become **internal** at `1810`:

- `1810` SE → `1911`
- `1810` S → `1811`

Its German visual path has 41 marks, seven of which are also internal to the expanded map. These inherited paths are **not the final composite entry-edge record**.

A second pass found that `maps/composer.js` already creates `compositeEntryEdges` from the v290 source-registered `odessa-extension.json.authoritativeEntryEdges`. That active source mapping refers to `path468` (Soviet) and `path470` (German), and uses the SHA-256 of the actual supplied `maps/source/user-svg/kiev-odessa-main.svg` (`2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e`). The active mapping is **32 Soviet and 50 German sides, all geometrically exterior**.

In particular, the active Soviet eastern trace continues through `1911`–`1914`. The v526 provisional exit list omitted those southern hexes. Its historical audit is preserved rather than silently overwritten.

## Implementation

- `maps/movement-configs/odessa-entry-border-geometry-v527.json` is a source-hash-pinned, ordered ledger for **both** the inherited visual path and active composite edge projection.
- `core/composite_entry_border_reconciliation.js` checks each marked side against the exact active composite hex grid, validates side reciprocity/physical exterior status, source SVG identity, sequence, and source geometry SHA; rejects drift, duplication and invalid status claims.
- `core/composite_eastern_communication_preflight.js` retains `create(...)` as the original legacy v526 audit interface and provides **`createComposite(...)`**, the corrected read-only composite tracer using all 16 candidate Soviet exit hexes, including `1911`–`1914`.
- Both trace modes continue to return `certifiedForVictory: false`; neither produces production reinforcement eligibility or victory decisions.
- A new rendered diagnostic overlays the classified sides on the **actual shared-engine map export** (green = active Soviet exterior candidate, blue = active German exterior candidate, orange/white dots = inherited visual marks that are now internal). The approved game maps remain untouched.

## Source and rule distinction

Kiev §12.2 and Odessa §5 require communication to the Soviet eastern red border. Geometry identifies **where a source-colored line lies on the active board**; it does not prove that every highlighted side is an authorized reinforcement route. This checkpoint does not upgrade source geometry to historical gameplay certification.

## Tests and implications

The v527 test enumerates both source records, validates their side-by-side geometry, checks the actual source SVG hash and fails on multiple tampering scenarios. It demonstrates a concrete effect of the omitted south boundary: with the 12 Kiev-era candidate exits occupied, the old tracer reports Nikolaev blocked while the corrected candidate can still reach a southern exit. This is a preflight distinction, **not** an authorized victory outcome.

Remaining: full movement/shoreline certification, Romanian country mask, Soviet deployment visual discrepancies, and active seven-turn historical acceptance. Kiev–Odessa remains **non-playable**.
