# Universal scenario contract (Checkpoint 33)

`maps/scenarios/registry.json` declares the **same 14 configuration domains** for every game. `core/scenario.js` validates those descriptors in Node and the browser. All game modes use one roster contract (`core/roster.js`) and will use one rules/action API and one presentation shell when those integrations are implemented.

The domain entries are **source mappings and migration states**, not executable rule definitions. `baseline-source` means a B4M reference exists; it does NOT mean the universal engine consumes that property yet. `source-bound-non-executable` means an asset or roster reference is available without complete gameplay rules. `unmapped` and `pending-source-mapping` must not inherit defaults from another game. Only Battle for Moscow remains executable through the validated Oberlabs path.

The fourteen domains: players (including turn order), phases (including extra phases), roster, deployment, victory (VP/conditions), map, weather, terrain, CRT, microrules, solo AI, presentation, turns, and logistics. Configuration uses **registered typed rule modules**, not arbitrary executable code embedded in JSON. Game-specific exceptions should eventually be modules selected by descriptors, not copies of an entire rules engine.

Kiev–Odessa composes Kiev plus an Odessa overlay. No implicit inheritance for unknown rules; source-authorized override order must be recorded during v318+ migration.

## Remaining integration

1. Implement verified executable descriptors for each domain with source evidence and tests; the generic registry does not fabricate them.
2. Route both human interaction and solo AI through one legal-action/commit/resolve/pending-choice API, preserving Oberlabs B4M semantics.
3. Generate the phase controls, reference tabs and terrain chart from the active descriptors; use the already-approved map/counter visual engine.
4. Preserve the single shared CRT outcome matrix while allowing game-specific odds modifiers and roll/visibility policies.
5. Reject unverified historical scenarios at runtime until their required rules and setup data are complete.
