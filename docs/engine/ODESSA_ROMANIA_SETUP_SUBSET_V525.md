# Checkpoint 291 / v525 — Romanian initial setup subset

## Source and scope

Objective: Kiev §6.0(7) explicitly gives the Romanian setup crosses as `0709`, `0809`, `0910`, and `1010`. The supplied Odessa §6.0(7) applies the Kiev setup procedure with modifications and requires **three German Infantry and four Romanian ground units** to start in Romania; it does not specify an alternative seven-hex country allocation.

Accordingly, the existing four approved orange crosses are sufficient for a **candidate initial placement** of seven starting units, subject to the inherited stacking restrictions. They are **not evidence of the complete political border** or an exception permitting Romanian Home Army movement across unknown territory.

## Exact implementation

- `maps/setup-configs/kiev-odessa-source-setup-v522.json` now declares the fixed, source-verified **setup-only** subset and its limited authority.
- `core/composite_setup_source_preflight.js` validates that the original four map hexes still bear source `cross` markers and remain non-Sea, non-Bessarabia land. It exposes a scoped `setupTerritoryEvidence()` classifier distinguishing `verified-setup-only`, `verified-territory`, `unverified`, and `not-romanian`.
- `core/composite_starting_state_candidate.js` uses only this scoped authority during initial setup, preserves all 37 face-bound units, and separately reports unknown Romanian positions. Any unclassified proposed location outside the four crosses remains **unverified**.
- The full country-border and eastern communications limitations remain explicit; the actual movement engine's `sourceTerritory` evidence gate has **not** been changed.

## Test fixture (not an official historical deployment)

| hostCell | Diagnostic occupant(s) |
|---|---|
| 0709 | German infantry + Romanian Home Army |
| 0809 | German infantry + Romanian 4th Army |
| 0910 | German infantry |
| 1010 | Romanian 3rd Army + Romanian Cavalry Corps |

This 7-on-4 arrangement is rules-compatible with the current normal stacking check, but is merely one candidate allocation. No additional Romania hexes were added or inferred.

## Tests and exclusions

- 56 new explicit positive/negative source-bound checks, including altered map markers, added unauthorized setup hexes, staged unknown positions, and prohibited Bessarabia entry.
- Existing setup, source-face, territory, annexation, city-victory, and land-graph regressions pass.
- Approved maps, printed counter artwork, source PDFs, TEC and CRT were not modified.

## Remaining blockers

1. Twelve visible frontline red stars versus eleven required frontline Soviet placements; the current diagnostic allocator still selects exactly eleven and reports the unused marker.
2. Source rules/original Kiev authorize a mechanized starting piece at `1309`, while the combined-map marker remains at `0706`.
3. The full Romanian political map required for unrestricted Home Army and Hungarian movement remains unverified.
4. Combined 261-cell movement / eastern-edge communication and full seven-turn campaign integration remain unapproved.

**No historical Kiev–Odessa game activation in v525.**
