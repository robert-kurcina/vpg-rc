# Checkpoint 118 / v352 — Actual movement snapshot migration (preview only)

## Real implementation change
- `core/canonical_state_migration.js`: added `translateMovementSnapshot` supporting the actual `WargameHistoricalMovementLifecycle.snapshot()` shape and real movement-unit scalar fields.
- The real movement-phase Undo history stores `{cursor,actor,state,usedUnitIds}` per entry. The new method migrates and validates all such entries without dropping cursor/actor data, including after a phase is finished.
- The migration requires an explicit phase configuration; unmarked old physical states require `allowUnmarkedLegacy:true`; canonical IDs remain candidate and are **not** activated.
- Strict field validation rejects unknown position-bearing fields, invalid/unknown actors and cursors, or unmapped water-only cells.

## Proof / boundaries
- `tests/leningrad-canonical-movement-snapshot-v352.test.js` creates a real movement session, makes a legal move, finishes movement, then round-trips both recorded Undo entries.
- `tools/audit-leningrad-movement-snapshot-v352.js` writes the reproducible sample report under `rules/audit/` using a **synthetic** German unit on a certified legal movement edge. No historical counter roster or complete scenario start was invented.
- The v345 whole-image parity test is retained in historical provenance because user-approved v350 smooth rivers intentionally changed pixels. Current test compares against independent frozen v350 SHA256 values for both SVG and PNG.
- `maps/leningrad.json`, `core/terrain_tiles.js`, `core/presentation.js`, current Leningrad-approved deployment and all existing `exports/*.svg` / `exports/*.png` files are unchanged from v351.

## Not implemented
Historical source-number certification, production save restore, game-state activation, canonical coastline composition, historical setup, and complete combat adjudication remain blocked/unimplemented; a candidate preview should not be interpreted as gameplay activation.
