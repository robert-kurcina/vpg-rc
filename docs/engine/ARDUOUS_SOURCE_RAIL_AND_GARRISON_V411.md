# Checkpoint 177 / v411 — Arduous source-piece and railway reconciliation

## Source basis

- `references/rules/arduous-rules.pdf`, §6.0, printed page 2: under **Soviet** setup, Brest receives "Its (3-4) Garrison Infantry Corps". The source also says the Brest Garrison is a one-step piece.
- `assets/official-counters/source-sheets/counters-arduous-front.jpg`, paired with `counters-arduous-back.jpg`: the location-marker face `arduous-front-r04c03` is paired with a playable `3-4` garrison `arduous-back-r04c06`. The source sheet's existing face transcription labels the reverse `printedAffiliation: axis` based on visual appearance. That is not the unit's starting ownership; the printed rule places it with the Soviets. We preserved that original transcription and bound ownership independently to the rule.
- `maps/arduous.json`, fixed Brest city marker `use337` at `0211`, and `v310UserRailDeploymentAudit.removedRailLinks` for the three previously corrected omissions.
- `maps/source/user-svg/arduous-map-temp(3).svg` and original `rules/audit/arduous-kiev-svg-first-rail-graph-v318.json` are checksum-verified by the new railway audit.

## Changes and bounded behavior

1. `maps/setup/arduous-fixed-pieces.json` registers the exceptional one-step source piece without fabricating a front-face ground unit. `core/historical_fixed_source_pieces.js` is shared and scenario-neutral. It validates both source faces, their mirrored pairing, the required source map marker, and the source-backed ownership and strength. Duplicate assignment and incorrect source IDs fail closed.
2. `core/historical_counter_face_projection.js` displays the unique printed `garrison` face using the existing infantry NATO template; no new counter art or renderer.
3. `core/historical_combat_consequences.js` recognizes reverse-only combat surfaces **only** when explicitly authorized through source-bound `combatPolicy.reverseOnlyPieces`. `Fixed.combatAuthorizations` derives this from the verified exceptional-piece policy. A reduced one-step Garrison is eliminated by the next loss, not flipped to the noncombat location-marker front. All ordinary source-counter paths are unchanged.
4. `core/source_rail_reconciliation.js` and `tools/audit-arduous-rail-reconciliation-v411.js` check 85 registered rail links against 88 SVG-derived crossings, with precisely three user-removed links (`1801:1802`, `1804:1805`, `1807:1808`). All 85 registered links trace to existing IDs in the **exact** source SVG. The audit does NOT authorize movement or silently restore excluded links.
5. The old readiness snapshot `rules/audit/arduous-kiev-certification-readiness-v318.json` was regenerated from its own unchanged audit script. Its historical copy had off-board neighbor IDs in `hexes[].sides`; those IDs did not exist in either map. The reissued snapshot correctly represents those sides with `neighbor:null`, while the substantive coverage metrics remain unchanged. Checkpoint 176's ZIP retains the prior diagnostic snapshot for provenance.

## Verification

- 30/30 selected Node suites pass: 25 inherited plus three new exceptional-piece/rail tests and the strict movement-policy and readiness tests.
- A source-paired Garrison on the **verified Leningrad graph as a test fixture only** completes a DRL step-loss transaction: its 3-4 source face is removed in a single loss, with no mutation to the original state. This is a combat-pipeline test, NOT Arduous gameplay certification.
- The prior Chromium Leningrad click/swap deployment test still passes against the regenerated common browser bundle.
- `maps/arduous.json`, `maps/kiev.json`, all five approved map SVG exports, shared B4M CRT, and the B4M production entry remain byte-for-byte unchanged.

## Remains open

The complete Arduous movement graph is deliberately still rejected by the existing `source-geometry-not-gameplay-certified` policy. Its terrain review (105 provisional/open/unclassified cells), river/hexside legality, and grid registration must be reconciled using the authored SVG and source map before enabling executable movement. The fixed Garrison helper is not yet bound to the incomplete Arduous full-deployment specification. The complete seven-turn campaign/browser UI is not implemented. Objective: Kiev and the combined Kiev–Odessa game remain incomplete. All five historical games continue to share one B4M CRT and one rendering engine.
