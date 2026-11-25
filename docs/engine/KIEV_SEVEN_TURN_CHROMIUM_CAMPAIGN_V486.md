# Checkpoint 252 / v486 — Kiev seven-turn Chromium human-gateway acceptance

## Result

The experimental *Objective: Kiev* interface has completed one source-legal example campaign across **all seven turns**, using the original shared historical human decision gateway inside **real Chromium** and the published Kiev engine map/counters. The campaign was intentionally divided into four short independent browser sessions to avoid an earlier synchronous-browser execution limit. Each subsequent session loaded the exact previous `HistoricalBrowserPreview.save()` payload through `restore()`; no journal or state fields were synthesized or edited between sessions.

- **81 committed shared-human actions**, 7 turns, 7 housekeeping completions.
- **One source-authorized German ground move** on Turn 3, both declared and resolved through the human command catalogue.
- **Four source-scheduled reinforcement placements**: two German on Turn 3 and one Soviet each on Turns 5 and 6.
- **14 explicit no-battle declarations** (both actors on all seven turns), with the remaining movement/buildup opportunities mostly declined by the deterministic test operator.
- **Soviet terminal victory**, with the Axis controlling **2 of 16** cities, as adjudicated by the actual campaign rules and shown in the actual Chromium screenshot.
- All four saved-game boundaries round-tripped to identical snapshots; the aggregate audit cryptographically checks every saved envelope and the continuity of action counts and turn IDs.

This is a **phase-progression/end-to-end browser acceptance** of a deliberately simple, non-contested campaign, not proof of strategic completeness, historical opening-position fidelity or AI quality.

## Separate human-browser contested combat

An independent Chromium transaction, with the same shared Kiev engine but its own new game, commits an actual Turn 1 attack on Soviet hex `0205` by original German source counters `kiev-front-r01c01` and `kiev-front-r01c03`. It then selects the battle, commits original German `kiev-front-r03c01` ground air support, commits die **3**, and receives an actual common-CRT **Exchange (EX)** consequence. The authoritative human gateway offers nine validated results; the test chooses a source-valid result that reduces the German attacker and retreats the defender to `0405`. Combat air usage, unit strength, retreat and exact save/restore pass. The contested battle **is not falsely included** in the separate 81-action seven-turn run.

## Executable evidence

- `python tests/kiev-seven-turn-browser-v486.py --stage 1`
- `python tests/kiev-seven-turn-browser-v486.py --stage 2`
- `python tests/kiev-seven-turn-browser-v486.py --stage 3`
- `python tests/kiev-seven-turn-browser-v486.py --stage 4`
- `python tests/kiev-human-contested-browser-v486.py`
- `python tests/kiev-seven-turn-aggregate-v486.py`

Each stage is a separately launched Chromium process using the packaged `core/historical_engine_browser_bundle.js`, `core/historical_browser_app.js`, scenario configuration and actual engine-exported Kiev map. Local static files are inlined for browser test execution because HTTP localhost navigation is disallowed in this test environment; the shipping game files are unchanged.

Evidence:

- `rules/audit/kiev-seven-turn-v486-stage{1..4}-{save,evidence}.json`
- `rules/audit/kiev-human-contested-v486.json`
- `rules/audit/kiev-browser-seven-turn-v486.json`
- `rules/audit/visual/kiev-seven-turn-terminal-browser-v486.png` — actual Chromium renderer, not a generated picture

## Acceptance limits and further work

1. Opening allocation remains user-authored *source-legal illustrative*, not a fully certified historical deployment.
2. The seven-turn trace passes on optional battles and replacement decisions; a separate actual browser battle and earlier shared-engine replacement tests cover different branches but do **not** constitute a single contested seven-turn browser trace.
3. Computer strategy, nontrivial choice-tree exploration, historical roster reconciliation, touch ergonomics across all phases, and Oberlabs UI parity need separate qualification.
4. Kiev remains **experimental**; Kiev–Odessa remains **non-playable**. Project has four runnable historical interfaces, not four historically certified campaigns.

There are **no modifications to shared engine/gameplay code, historical rules, original map assets, approved exports, counters or CRT** in this checkpoint. Only audit/test and documentation files were added or updated.
