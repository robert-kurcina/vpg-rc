# Checkpoint 296 / v530 — gameplay-first replan and source §7 ZOC correction

## Decision

The original Kiev `1201`–`1202` railway is established in its gameplay graph. Its omission from the composite derived route ledger is routine reconciliation, **not a reason to delay Kiev–Odessa playtesting**. The combined map can be used as a clearly labelled experimental candidate, without pretending the 172 new traversable appended edges have achieved final historical certification. `PLAN.md` now specifies an executable human-browser seven-turn acceptance target and promotes source disputes only when they block a concrete legal action.

## Actual executable defect found

The user-provided `references/rules/kiev-rules.pdf` §7.0 describes each ground unit's ZOC as *the six surrounding hexes*. The original executable `core/movement_rules.js::enemyZOC`, `core/historical_buildup_phase.js`, and the two retreat modules had counted **only traversable adjacent hexsides**. As a result, an enemy occupying an adjacent land hex across an impassable Coast side could not stop movement or suppress replacement communication, although its ZOC should reach the hex. The v526 candidate tracer already used correct six-neighbor adjacency, creating a dangerous difference between diagnostics and gameplay.

- `maps/movement-configs/kiev.json` and `kiev-odessa-territory-candidate-v504.json` now set `zocAcrossImpassableHexsides: true`. Other scenarios retain their previously tested policy until individually qualified.
- `core/movement_rules.js::enemyZOC` is the shared predicate. When explicitly configured, a verified land-to-land physical hex adjacency projects ZOC even if a Coast marker blocks movement. The move itself still fails on `impassable`/`lake` hexsides.
- Historical buildup communication, forced retreat and safe retreat use this same predicate; movement and legal pathfinding already did. Stack-free markers and eliminated units do not project ground ZOC.
- The test uses the actual 261-hex composite candidate's seven land-to-land Coast edges. For the source coordinates `1215 → 1315 → 1214` with enemy at `1414`, `1315` is in enemy ZOC through its barrier, so the two-step move must fail after entering `1315` while the one-step stopping move succeeds. This was accepted before the fix.

## Scope and nonclaims

The historical browser bundle was rebuilt from the shared modules. Original map exports, printed rulebooks and original counter artwork were not edited. The ZOC correction affects the experimental Kiev game and the future Kiev–Odessa integration. It does **not** certify the combined movement graph, resolve the entire Romanian country border, or create a playable Kiev–Odessa campaign by itself.

## Revised acceptance ordering

1. Start a player-selectable 37-counter experimental Odessa session using the existing shared engine and 261-hex candidate map, retaining provisional labeling and fail-closed restrictions.
2. Wire combat, Fleet/air, buildup, naval return, control and provisional victory into the same journal and browser; keep nonauthorized phases disabled with reasons.
3. Complete and save/restore a reproducible real human-browser seven-turn campaign with cross-seam movement, combat, reinforcements and naval branches.
4. Close only the remaining source-rule discrepancies that affect historical choices; separately qualify Human vs AI and AI vs AI.

### Validation targets

`node tests/odessa-coast-zoc-shared-gameplay-v530.test.js`, original cross-game movement, Kiev seven-turn and source movement tests, historical buildup/forced-retreat/safe-retreat suites. Verify the rebuilt browser bundle shares the edited code. An archive preservation comparison must demonstrate all original source/map/artwork bytes unchanged.
