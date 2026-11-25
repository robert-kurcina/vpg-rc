> **Superseded in checkpoint 260 / v494:** The text below incorrectly treats seven source-authored Coast sides between land-classified hex centers as possible legal crossings. They are all impassable Coast barriers, as corrected in `ODESSA_SEA_COAST_IMPASSABLE_CORRECTION_V494.md`. The original SVG was not defective.

# Checkpoint 259 / v493 — Kiev–Odessa source seam and shoreline audit

## Purpose

Advance the fifth game toward experimental play without mistaking map art for historical movement rules. This checkpoint creates a **read-only, reproducible movement-topology candidate** for the 261-cell composed Kiev–Odessa map. It does not alter the movement/rail rules, historical source artwork, any map export, or game authorization.

## Source evidence and observed geometry

Sources: the original `maps/source/user-svg/kiev-odessa-main.svg`, the existing Kiev and Odessa map registrations, original `references/rules/odessa-rules.pdf` and retained renderer map export `exports/kiev-odessa.png`. Source SHA-256 hashes are recorded in the companion JSON audit.

| Measurement | Source candidate result |
| --- | ---: |
| Composed hexes | 261 (165 Kiev + 96 Odessa extension) |
| Reciprocal physical neighbor pairs | 714 |
| Land–land pairs | 621 |
| Pairs touching Sea | 93 |
| Reciprocal Kiev–Odessa seam pairs | 24 |
| Reciprocal annotated ordinary River sides | 105 |
| Reciprocal annotated Major River sides | 22 |
| Reciprocal annotated rail sides | 42 |
| Authored shoreline-side records | 32 |
| Shore records with Sea neighbor | 24 |
| Shore records with land neighbor | 7 |
| Shore records off-board | 1 |

**Important:** the 42 registered rail sides are reciprocal **visual/cell annotations**, not an independently certified complete railway network. The combined map intentionally has no source-certified `hexCenterRailConnections`. The 24 seam pairs are geometry, not legal movement authorizations. Sea-adjacent pairs are not asserted to permit ground movement. Nor should a shoreline overlay between two land cells automatically deny otherwise legitimate movement.

Seven land–land shoreline cases (from original source map data):

- `1315:1414`
- `1413:1513`
- `1513:1612`
- `1513:1514`
- `1712:1812`
- `1812:1813`
- `1812:1913`

These require explicit separation of visible shore artwork from movement impassability. They are not necessarily defects in the source map.

## Implementation

- Added `movementCandidate(base, extension, composite)` to `core/composite_graph_audit.js`, without touching the executable movement graph.
- The source candidate fails closed on nonreciprocal neighbors, divergent river/rail feature annotations, duplicate shore entries, source overlaps and unsourced cells.
- Added deterministic generator `scripts/build-odessa-movement-candidate-v493.js` that pins current source hashes and publishes all 714 candidate edge records, 32 shoreline records and the 31 distinct map-review markers in `rules/audit/odessa-composite-movement-candidate-v493.json`.
- Added `tools/odessa-movement-review/index.html`. It displays the **actual shared-engine map PNG export** with optional source-derived annotations for the 24 seams or the 7 land–land shoreline records. No fabricated map is used.
- Added homepage navigation to the review tool.

## Tests

- `node tests/odessa-composite-candidate-v493.test.js`: **1,474 assertions passed** (exact source counts, 714 edge verification, source hashes, fail-closed tampering, and production graph still blocked).
- `python tests/odessa-composite-topology-browser-v493.py`: **17 Chromium checks passed** (actual map loading, responsive UI, both source marker filters, selecting seam/shore pairs, no JavaScript errors).
- `node tests/kiev-odessa-composite-seam-v318.test.js`: legacy composite seam acceptance remains passing.

Browser evidence from the actual engine export:

- `rules/audit/visual/odessa-seam-shore-review-browser-v493.png`
- `rules/audit/visual/odessa-land-shore-review-browser-v493.png`

## Limits and next priority

Kiev–Odessa remains **not playable**. No AI, fleet, port, cavalry, national-boundary, reinforcement, or composite victory rule is activated by this audit. Before experimental campaign authorization, the project needs a **source-approved executable land movement graph** for the extension, including coast/Sea barriers, any shoreline edge exceptions, and the complete authoritatively traced railway links. Separately implement Odessa §§5, 6, 8.3, 9.4, 10.5–10.6, 11–12, and 15 using the shared scenario configurations and shared rules engine, preserving the B4M CRT.
