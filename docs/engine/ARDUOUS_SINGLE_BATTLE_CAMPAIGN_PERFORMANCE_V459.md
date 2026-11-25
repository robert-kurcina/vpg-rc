# Checkpoint 225 / v459 — Contested Arduous campaign search optimization

## Verified issue

The earlier 184-action Arduous contested campaign regression timed out in the current runtime. The deterministic test controller called `Catalog.discover` at each action, which performed two- and three-battle combinatorial plan discovery even under a policy of `maxCombatsPerPhase: 1`. The combined-plan enumeration is not used by a single-battle test run.

## Targeted change

`core/historical_campaign_autoplay.js` calls `Catalog.discover({session,context,enumerateCombinedPlans:p.maxCombatsPerPhase>1})`. This reuses the established shared action-catalogue control introduced for human sessions. The source-validated individual battle proposal set, committed dice, combat/retreat consequences, and scenario rules are not changed. When `maxCombatsPerPhase` exceeds 1, multi-battle plan enumeration remains enabled.

The generated `core/historical_engine_browser_bundle.js` is rebuilt from the same source module. This does not modify the human browser's choice path.

## Tests and evidence

- `node tests/arduous-contested-seven-turn-v422.test.js --write-v459-audit`: **184 legal actions through seven turns**, including **14 battles**, **27 ground moves**, **7 reinforcements**, **6 replacements**, **7 air choices**, **4 advances**, **4 retreats**, seven housekeeping phases, Turn-3 and terminal save/restore, and terminal Soviet victory. One measured current-runtime run completed in **33.57 s**; repeat runs also completed. See `rules/audit/arduous-contested-seven-turn-v459.json` for state/journal hashes and recorded outcomes.
- `node tests/arduous-single-battle-search-v459.test.js`: **18 assertions**. At the exact same source-valid opening combat declaration, both eager and lazy catalogues supply the same **82 individual proposals** and the same command set. The eagerly enumerated catalogue still supports two-battle choices; the seeded controller chooses the same individual battle from the lazy catalogue. Commit and save/undo boundaries are unchanged.
- Previous `historical-autoplay-contract-v399`, `human-lazy-combat-plans-v425`, `arduous-seven-turn-smoke-v419`, and Kiev early-combat tests passed.

## Limitations and independent review

- The optimization has been validated for the single-battle policy. It does **not** accelerate full multi-battle catalogue enumeration.
- This is a **headless deterministic action-controller regression**, not the full 184-action contested human/Chromium browser trace. Browser acceptance remains open.
- The 128-choice capped post-roll `EX` list remains non-exhaustive and is not corrected by this change.
- The old v422 source audit's state and journal hashes **differ** from the new v459 audit, after many intervening checkpoints. The older reference is not a like-for-like control for this code change; no claim of hash identity is made. All current test actions validate under the current source-configured game engine.
- The longer Leningrad multi-seed autoplay suite did not finish within its execution window and is **not** counted as passed. Shorter cross-scenario contracts and the unchanged multi-battle decision selection were verified instead.
- The accepted v457 dots-only City styling, five official map exports, original counter assets, scenario configurations, and the one shared B4M CRT are unchanged.
