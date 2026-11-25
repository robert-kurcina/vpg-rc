# Checkpoint 246 / v480 — Kiev §10.8 Romanian setup-hex interpretation

## Decision and source

Original *Objective: Kiev* draft rules v1.0, §6.0 (printed page 2), identify the four Romanian Axis setup hexes. Section §10.8 (printed page 5) names them as `0709`, `0809`, `0910`, and `1010`, prohibits Axis units **originally set up** there from attacking on Turn 1, and limits Turn-1 Soviet attacks against Axis units **in Romania** to Soviet units originally deployed at `0708`, `0808`, or `1110`.

**Explicit project interpretation (user approved, 2026-11-21):** for the limited purpose of Turn-1 §10.8 attack legality, *Romanian territory* means exactly the four printed Romanian Axis setup hexes. No full historical Romanian political boundary is asserted. Original deployment lineage (`openingHex`) continues to determine which counters may attack. Moving a counter does not change the nationality of a hex or its original deployment.

The older diagnostic tools asked for a country-wide mask of all 165 Kiev board hexes. That extra geographical requirement is not necessary under this agreed scenario-scoped interpretation. The historical Romanian border review remains optional research; its unapproved user annotations are not used by the game engine.

## Implementation

- `maps/combat-configs/kiev.json`: `firstTurnTerritorialRestriction` now enumerates exactly four target hexes and the three eligible Soviet original deployment hexes. The rule is mandatory and **not bypassed** in the updated diagnostic tests.
- `core/historical_combat_declarations.js`: the shared engine accepts either the existing certified-complete territorial contract or a distinct `setup-hexes-adjudicated` contract. The latter **fails closed** unless the target hexes are *exactly* the opposite side's source-defined Turn-1 restricted setup hexes, the phase and owners agree, and `interpretation: scenario-turn-1-only` is explicit. The complete-territory contract remains backward-compatible. Malformed/partial/widened target sets are rejected.
- `core/historical_engine_browser_bundle.js` regenerated directly from the shared Node sources; no separate browser rule implementation.
- Updated Kiev setup and Romanian source-review browser notices clearly distinguish the completed game-only interpretation from optional border research and the still-provisional movement graph.
- Source rulebook, user SVG, map JSON, counter artwork, CRT, city dots, and five approved map exports remain unchanged.

## Verification

The new `tests/kiev-turn-one-romania-convention-v480.test.js` runs against the genuine Kiev 165-cell/442-edge source-reviewed candidate in a **test-process-only movement authorization**. It checks:

1. Original source pinning for four Romanian setup cells and three eligible Soviet origins.
2. Real adjacent Soviet attacks against `0709`, `0809`, `1010` in Turn 1, including rejection of an attacker whose current position is eligible but whose **original** hex is not.
3. Eligibility of the same attacker on Turn 2 and legal non-border Soviet attacks on other targets during Turn 1.
4. Original Romanian Axis corps forbidden from attacking on Turn 1 but allowed on Turn 2.
5. Rejection of enlarged, reduced, duplicated, or reinterpreted target sets, or target sets lacking a matching Axis setup restriction.
6. An actual shared-campaign path from the German Turn-1 combat phase into special movement: a genuine Axis unit moves from `0910` to `0909`, retaining its original `openingHex`; the four-hex Romanian target list **does not change**. The Soviet player then commits a legal Turn-1 attack on `0709`, and the campaign save restores to an identical state.
7. The movement-graph registry is restored and still prohibits production Kiev gameplay after the diagnostic.

The older seven-turn (`v474`, `v475`) and contested Kovel (`v476`) diagnostics were updated to exercise the **actual configured four-hex rule**, eliminating their former test-only missing-mask bypass. Their outcomes and protected map assets remain unchanged. Older archived audit JSON files document what passed in those checkpoints; their labels about the then-unresolved mask are historical, not current authorization statements.

## What remains

- **Kiev movement graph is still provisional.** The in-memory test binding proves mechanics on the candidate graph, but does not constitute production source authorization. Its 442 edge records need review/adjudication or a documented acceptance decision.
- Genuine end-to-end seven-turn **human browser** play from the player's chosen source-legal setup has not yet passed acceptance.
- Kiev–Odessa remains non-playable and dependent on Kiev integration.
- The historical Romanian political border remains unverified, but is no longer a prerequisite for the agreed Turn-1 four-hex game rule.

**Playable-game count stays 3 of 5.** No strategic AI or exhaustive historical acceptance is claimed.
