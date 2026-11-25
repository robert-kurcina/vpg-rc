# Historical canonical-hex state migration (preview)

`core/canonical_state_migration.js` is a universal, opt-in, bidirectional conversion utility for **draft** historical action states. It does not activate a game, persist a save, alter map geometry, or imply that candidate canonical IDs have been independently certified.

The module consumes the exact `record` returned by `CanonicalHexProjection.project(...)`, including its `physicalToCanonical`, `canonicalToPhysical`, and visual-only sea-cell ledgers. It rejects registries that are not error-free and marked `PREVIEW_ONLY`.

## Supported model

- A state has `scenarioId`, `hexIdSpace`, and a `units` object keyed by unit ID. Each unit has `id`, `hex`, and supported scalar unit metadata. State metadata permitted: `turn`, `phase`, `side`, `complete`.
- `hexIdSpace: 'legacy-physical'` -> `hexIdSpace: 'canonical-preview'` using `direction:'toCanonical'`.
- The reverse conversion uses `direction:'toPhysical'`. Converted states must carry the correct namespace label. Conversion twice in the same direction is rejected.
- `translateDraft` handles `{scenarioId,cursor,state,usedUnitIds,history}` with history entries `{state,usedUnitIds}`. Every recorded prior state is converted independently, preserving reversible Undo history. A draft is **not** a production session save format.
- Existing unmarked states can only be imported through `allowUnmarkedLegacy:true` explicitly; this is never implicit.

## Real movement-controller snapshot adapter (v352)

`translateMovementSnapshot(snapshot,{direction,phaseConfig,allowUnmarkedLegacy})` accepts the exact snapshot shape of `WargameHistoricalMovementLifecycle.snapshot()`:

```js
{
  cursor:{scenarioId,turn,index,complete}, actor,
  state:{scenarioId,units:{...}}, usedUnitIds:[...],
  history:[{cursor,actor,state,usedUnitIds}, ...]
}
```

The existing `translateDraft` continues to support the earlier simplified synthetic draft shape and is not a substitute for this adapter. `phaseConfig` is **required**, and the adapter verifies every historical cursor and actor as well as the current snapshot. It recognizes scalar `class`, `size`, `nationality`, and `mp` fields used by real movement units, without weakening the narrower `translateState` API. No additional nested locations or pending battle objects are allowed.

The movement-controller currently emits unmarked legacy states. Callers must explicitly request `allowUnmarkedLegacy:true` for import. The reverse conversion produces marked `hexIdSpace:'legacy-physical'` states, so comparison with an original unmarked snapshot must account for the added namespace markers. Neither direction modifies its input or resurrects a live controller. This remains an **in-memory preview transformation**, not save/load integration, source-number certification, or canonical gameplay activation.

```js
const migration = M.create(registry);
const canonical = migration.translateMovementSnapshot(movementController.snapshot(),
  {direction:'toCanonical',allowUnmarkedLegacy:true,phaseConfig});
const physical = migration.translateMovementSnapshot(canonical,
  {direction:'toPhysical',phaseConfig});
```

Test using `node tests/leningrad-canonical-movement-snapshot-v352.test.js` and audit using `node tools/audit-leningrad-movement-snapshot-v352.js`.

## Explicit fail-closed boundary

States with missing/unmapped coordinates, duplicate or unsupported registry IDs, visual-only sea positions, unexpected combat/hex fields, nested unit data, or unknown draft properties are rejected. This is intentional: any future position-bearing field such as `retreatHex`, `attackFrom`, or pending battles must receive its own schema-aware migration before activation.

## Usage (non-production)

```js
const T = require('./terrain_tiles');
const P = require('./canonical_hex_projection');
const M = require('./canonical_state_migration');
const projection = P.project(board, c => T.formatHexNumber(c, T.numberStyle(board, {})));
const migrator = M.create(projection.record, {scenarioId:'leningrad'});
const candidate = migrator.translateState(state, {direction:'toCanonical'});
const original = migrator.translateState(candidate, {direction:'toPhysical'});
```

For a reproducible map/marker/history test, run:

```sh
node tests/leningrad-canonical-state-migration-v351.test.js
node tools/audit-leningrad-canonical-state-v351.js
```

## Activation blockers

This is a dependency-resolution step, **not save compatibility**. Historical numbers still derive from the current, not fully source-certified printed translation. The 11 water-only cells have not yet been composed as a separate rendering layer. Map data, phase/combat/retreat references, serialized payload versions, and production session restore must be migrated and verified together. The approved Leningrad deployment and shared renderer remain unchanged.
