# Scenario opening integration (v358, Checkpoint 124)

`core/scenario_opening_bridge.js` is a **single shared implementation** that binds a validated, explicitly selected historical counter setup to the initial phase specified by a scenario's phase configuration. It has no scenario-name branches and does not change rendering. It accepts an explicit phase-controller factory selected by phase *kind*, not by game ID. All source-authored positions are validated by `core/scenario_starting_setup.js`.

## Contract

`create({map, setupSpec, counterConfig, inventory, allocation, placements, phaseConfig, movementProfile, phaseFactories})` returns a preview bridge with `snapshot()`, `firstPhase()`, `controller()`, `setupAudit()`. `snapshot()` contains `{cursor, actor, state}` and is detached from both supplied inputs and controller actions. `controller()` invokes the existing rules-specific controller for the **actual first configured phase**. No phase cursor is supplied by the caller or overwritten by a default. No generic combat or movement rule is invented.

For the current Leningrad fixture, the first phase is Turn 1 German combat (the German buildup and ordinary movement phase are skipped). A `Combat.create` adapter permits `commit` (complete declaration set), `select`, and independently certified terrain-based odds preview. Applying CRT consequences, resolving revealed counters, phase completion, Undo for combat, and phase transitions **remain blocked**. A separately configured first-movement negative-control test proves the shared movement controller accepts the same 19-counter setup and can move/Undo a verified route; this configuration is **not historical Leningrad's first turn**.

## Boundaries

- The allocation comes from `tests/fixtures/leningrad-source-setup-v357.js` **only for test and audit**. No official individual German/Soviet historical face-selection policy has been established.
- Five fixed Soviet rear source symbols appear in the approved map; their association with printed rulebook labels still conflicts for `1305` (rendered `1306`) and `1701` (rendered `1702`). The bridge reports those two discrepancies without shifting map geometry or units.
- All 19 starting ground units and printed strengths come from verified face inventory and marker constraints. Untried mechanized strength remains unknown until an independently source-backed reveal procedure is implemented.
- `historicalSetupAuthorized:false`, `productionGameActivated:false`; the bridge is **not** the game's live browser session manager or a complete multi-phase controller.
- All downstream phase controllers must independently enforce scenario rules. Existing source-specific combat-modifier implementation is *not yet generalized for all scenarios*. A shared adapter does not establish all-game gameplay-rule parity.

## Checks

Run `node tests/scenario-opening-bridge-v358.test.js`, `node tools/audit-scenario-opening-v358.js`, and the existing setup, combat, movement, phase, five-scenario, export and approved-visual regression suites. Never treat a test-only fixture as proof of a historically mandated face or setup location.
