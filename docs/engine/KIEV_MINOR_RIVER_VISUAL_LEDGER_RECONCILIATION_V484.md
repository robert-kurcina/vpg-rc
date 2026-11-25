# Checkpoint 250 / v484 — Kiev river-class annotation reconciliation

## Problem and source evidence

Five **reciprocal map-cell annotations** labelled `majorRiver` from a preliminary v234 visual pass disagreed with both the preserved user-authored source SVG and the independently bound movement/combat ledger. The specific **undirected** source hexsides are:

| Hexside | Original user SVG | Candidate gameplay graph | Previous annotation | Corrected annotation |
| --- | --- | --- | --- | --- |
| `1401:1502` | `path616` / `river-minor` | `river` | `majorRiver` | `river` |
| `1402:1502` | `path615` / `river-minor` | `river` | `majorRiver` | `river` |
| `1402:1503` | `path615` / `river-minor` | `river` | `majorRiver` | `river` |
| `1403:1503` | `path615` / `river-minor` | `river` | `majorRiver` | `river` |
| `1403:1504` | `path615` / `river-minor` | `river` | `majorRiver` | `river` |

Source: `maps/source/user-svg/kiev-odessa-main.svg`, with named Inkscape `river-minor` layer; original source-geometry audit `rules/audit/kiev-definitive-city-river-v429.json`; source-reviewed physical edge ledger `maps/movement-configs/source-reviewed-edge-ledgers.json`. Every named source trace covers at least 99% of its hexside. The user-supplied SVG is untouched.

## Correction and protection

- Corrected the ten reciprocal `tileEdges` records in `maps/kiev.json` from `majorRiver` to `river`; each carries a distinct `source-svg-river-minor-v484` status.
- The **shared** `core/source_reviewed_movement_graph.js` now rejects explicitly annotated `rail`, `river`, or `majorRiver` tile edges that disagree with the source-pinned candidate ledger. It applies by the generic existing `definitive-city-layer-v1` evidence mode; no scenario ID branches were added.
- The entire ledger is not inferred from `tileEdges`: 57 ordinary River and three Major River physical sides are carried by independent source-authored line paths without corresponding tile-edge annotations. The test verifies **positive annotations**, not an invalid assumption that every river path has a tile-edge record.
- Recomputed the movement review workbench's map-source SHA and audit digest, keeping the exact 442 physical edge records and source feature flags unchanged. The reviewed export/draft version remains read-only and unapproved; old draft checksums are deliberately source-mismatched after the map JSON change.
- The original engine-generated Kiev and Kiev–Odessa SVG/PNG exports, all three other game exports, the common B4M CRT, original counter/rules art, movement ledger, and scenario combat/movement rules are byte-for-byte identical to v483. The shared water artwork was already sourced from independently authored SVG water paths, so this correction changes annotation metadata, **not visible river drawing**.

## Tests and remaining limits

- `node tests/kiev-river-class-reconciliation-v484.test.js`: **279 source, topology, and classification assertions**, including deliberate visual-water misclassification rejection.
- `python tests/kiev-river-source-layer-v484.py`: **30 source-vector assertions** using the actual original SVG layer names and v429 finite-hexside audits.
- Prior Kiev candidate movement geometry: **2,949 assertions passed**.
- Prior Kiev edge-review audit: **3,557 assertions passed** and **37 Chromium checks passed**.
- Kiev Turn-1 Romanian rule, combat profile, Kovel contested control, seven-turn contested replacement diagnostic, Terrain Effects Chart, Arduous candidate graph and shared movement registry regressions passed.

**Still not authorized:** This resolves a concrete representation disagreement, not all historical uncertainty. It does not certify the printed initial deployment, independent review of every river and railway connection, or a complete human-controlled browser campaign. `maps/movement-configs/graph-sources.json` is unchanged at `provisional` for Kiev; Kiev–Odessa remains separately gated. Playability remains three of five.
