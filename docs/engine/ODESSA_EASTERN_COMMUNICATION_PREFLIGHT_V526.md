# Checkpoint 292 / v526 — Kiev–Odessa provisional eastern communication audit

## Source and purpose

Objective: Kiev §7.0 and §12.2 define the six-hex ZOC and Soviet communication path: except for the origin, a communication path to the red eastern map edge cannot enter an enemy-occupied hex or an EZOC. Objective: Odessa §5.0 uses isolation from that edge to resolve its 18/19-city victory branches.

This checkpoint provides a **read-only diagnostic communication tracer**, not gameplay authorization. It is built on the existing 261-cell, 714-physical-edge / 614 passable candidate map. No new rules, countries, railway links, shorelines, or political boundaries are guessed.

## Important border evidence discrepancy

The composite's `entryBoundarySelections` is explicitly `SOURCE_GUIDED_VISUAL_GEOMETRY_NOT_RULE_CERTIFIED`. It lists **26 Soviet-colored sides**, of which **24 sides** lead off the current map and **two now connect existing cells**:

- `1810` SE → `1911`
- `1810` S → `1811`

The 24 exterior sides occupy **12 distinct hexes** (`1601`, `1701`, `1801`–`1810`). The two interior-marked sides are recorded in the audit and **excluded** from provisional edge access. These positions are not promoted to a rules-certified reinforcement ledger. The German visual border also has internal composite-marked sides and must be separately certified before game activation.

## Communication-trace behavior

`core/composite_eastern_communication_preflight.js` supplies:

- `metadata`: explicit exterior/interior provenance, counts, certification status;
- `trace(hex,{units})`: a *candidate-only* reachable path to a provisional Soviet exterior hex;
- `allCities({units})`: candidate paths for all 20 source-identified cities.

Traversable edges exclude Sea and authored impassable Coast. ZOC, however, is evaluated over all **physical adjacent land hexes**, even across a land-to-land Coast barrier; this follows Kiev §7's six-hex ZOC definition. The origin is exempt from the EZOC restriction under Kiev §12, but an enemy-occupied origin is invalid. An enemy-occupied or EZOC destination cannot be entered as a later path step. Air/Fleet support markers do not create a ground ZOC. Source paths are recomputed for each supplied ground-unit ledger and can change as the game state changes.

## Validation and deliberate restrictions

- 265 new assertions; source border classification and 20-city paths, hostile exit blocking, origin exemption, Coast-crossing ZOC, malformed-unit/map/source-restriction negatives.
- Existing source-graph, setup, roster, Romanian setup subset, and 4,814-assertion Odessa victory tests pass.
- **No** communication boolean is exported for use in live victory or replacements; outputs explicitly carry `certifiedForVictory: false`.
- **No** modifications to approved map SVG/PNG, source PDFs, counter sheets, CRT, TEC or prior gameplay.

## Remaining authorization steps

1. Validate source-traced red exterior reinforcement edges against the *combined* printed/map SVG geography, particularly the two inherited-but-internal hexsides.
2. Certify the 261-hex movement/shoreline connectivity and country boundaries independently of source-colored illustrations.
3. Reconcile 12 frontline star markers versus 11 §6 unit slots and fixed mech `0706` versus rule-required `1309`.
4. Only then bind a **certified** communication function to the campaign's §12 replacement and §5 endgame evaluator, with replay, Undo and browser end-to-end acceptance.

This is a real improvement in test coverage and failure isolation, but **Kiev–Odessa remains non-playable**.
