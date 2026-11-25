# Shared historical unit-roster interface — v317 Checkpoint 28

All five catalog entries reference **one** `maps/rosters/loader.js` endpoint, which uses the universal `core/roster.js` schema, validation, source binding, composition, and selection functions. Kiev–Odessa inherits the Kiev units and applies the Odessa **eight-design** overlay; Odessa is never an independent game.

- `load(id)` returns records with `id`, `scenario`, `sourceKind`, `sourceKey`, `historicalUnitId`, `side`, `nationality`, `unitClass`, `artwork`, `characteristics`, `deployment`, `executable`, and `evidence`.
- `validate(units)` prevents duplicate IDs, missing display artwork, and falsely executable records. It does not certify rulebook completeness.
- `fromB4M()` maps 39 canonical playable IDs and source-verified mirrored faces, preserving their real gameplay attributes. The existing Oberlabs engine/UI remain unchanged until equivalence-tested migration.
- `fromPrintedPairs()` maps 73 **source-correlated printed identities**, which lack verified gameplay-roster binding, setup, and strengths. Synthetic IDs are explicitly prefixed `/print/`. These are *not* 73 playable units.
- `fromOverlay()` maps the eight source-supported Odessa designs, including single-sided cavalry and turn-two air support; their gameplay fields are intentionally incomplete.
- `compose()` combines Kiev and Odessa without mutating either input, rejects duplicate gameplay identifiers or duplicate artwork references, and does not double-count source print copies.

**Activation gate:** No historical unit can be marked `executable` until actual scenario roster, strength/state, deployment constraints, and any special abilities have been corroborated and the shared gameplay engine has been connected. Do not generate numbers or default deployments. Preserve original face colors and fonts, and the user-approved map configurations.

**Outstanding:** Integrate the shared roster loader with `core/engine.js` build/start interface; supply source-backed historical unit gameplay attributes; connect Oberlabs B4M through an equivalence-tested adapter, not a second implementation of the rules. Printed-pair source IDs do not automatically match historical game unit IDs.

## Runtime binding (Checkpoint 29)

`core/roster.js::bindExecutable(roster, rawUnits, scenario)` validates a roster before returning a deep copy of the canonical executable units; it never invents missing gameplay properties. `core/engine.js::build(gamePackage, verifiedRoster)` and `core/adapter.js::create(legacyEngine, gamePackage, seed, verifiedRoster)` both use this contract. Omitting the optional roster leaves original call sites unchanged.

The first verified path is Battle for Moscow: load `battle-for-moscow` via `maps/rosters/loader.js`, pass it as the fourth argument to `WargameAdapter.create(B4MEngine, package, seed, roster)`. All 39 source identities and source colors are verified; the 14-half-turn trace matches the unbound reference. Incomplete Arduous, Leningrad, Kiev and Kiev–Odessa rosters fail closed and must not be activated as executable scenarios. The browser bootstrap is not yet switched to the shared loader, and the generic engine does not yet supersede legacy B4M gameplay.
