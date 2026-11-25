# Checkpoint 227 / v461 — Paged, source-validated combat consequences

## Verified behavior

The historical human UI previously offered a maximum of 128 source-validated combat consequences for one committed die. In a crowded Soviet four-attacker / German two-defender `EX` result, valid but unlisted results could not be selected through the normal browser controls. This was a **discovery/UI restriction**, not a change to the common Battle for Moscow CRT or combat transaction validator.

The shared `core/historical_campaign_action_catalog.js` now supports `discoverPostRoll({session,context,die,page})`. Each page exposes up to 128 independently verified source-legal actions, with deterministic order, an offset, and an explicit `hasNextPage` flag. An additional look-ahead successful validation—not just reaching exactly 128 entries—establishes whether a further page exists. Trial enumeration retains the 4,096-attempt safety budget and continues to mark the overall candidate set `exhaustive: false`.

`core/historical_campaign_human.js` caches each page of verified actions within the active pending die. Only actions that have been offered in a validated page are selectable. Paging does not call `session.execute` to commit anything; actual choices are submitted to the unchanged authoritative resolver. The committed die continues to bind the campaign save, and Undo and save/restore preserve the existing human-session contract. Page navigation itself is UI-local and resets to page one after restoring a pending die; the committed die is retained.

`core/historical_browser_app.js` and the existing Arduous and Leningrad human preview HTML add previous/next consequence controls. The interface exposes all actions on the current page, provides a loading message while validating more choices, and warns that the catalogue is not necessarily exhaustive.

## Evidence

- `python3 tests/arduous-postroll-paging-browser-v461.py`: **49 assertions** against original in-memory Chromium UI and shared engine. A source-legal four-attacker / two-defender Soviet attack at Arduous hex `0306` with committed die 2 produces `EX`. It displays **128 distinct verified actions on each of pages 1, 2, and 3**, for **384 unique actions**. Cross-page deduplication, return navigation, retained pending die and journal, rejected forged different-die action, third-page resolution, save/restore, and Undo all pass. Page-two validation took **5.73 seconds** in one measured run; this may vary by host. Evidence: `rules/audit/arduous-paged-consequences-v461.json`.
- `python3 tests/arduous-exchange-overflow-browser-v452.py`: the original 35-assertion crowded exchange regression still passes after updating only its now-obsolete warning-text expectation.
- `node tests/historical-human-decision-gateway-v401.test.js`: 37 assertions; no change to pending-die commitment, save integrity, or Undo.
- `node tests/historical-campaign-combat-decisions-v392.test.js`: 281 assertions; every listed combat consequence continues to use the authoritative source resolver.
- `node tests/historical-postcasualty-retreat-v393.test.js`: 155 assertions; post-loss retreat geometry preserved.
- `node tests/historical-joint-safe-retreat-v397.test.js`: 35 assertions; joint retreat validation preserved.
- `node tests/arduous-contested-seven-turn-v422.test.js`: the headless contested 184-action seven-turn test passes, with the established Soviet-victory terminal state. The full v460 Chromium 184-action replay was **not** rerun as part of this checkpoint.
- Additional Kiev early-combat, Arduous seven-turn smoke, single-battle search, and current city-dot regressions pass.

## Preservation

Compared directly with the complete v460 ZIP, exactly **seven existing files** changed: `core/historical_campaign_action_catalog.js`, `core/historical_campaign_human.js`, `core/historical_browser_app.js`, generated `core/historical_engine_browser_bundle.js`, the Arduous and Leningrad native preview HTML pages, and the obsolete-warning expectation in `tests/arduous-exchange-overflow-browser-v452.py`. All `maps/`, `exports/`, `assets/`, `supplied_assets/`, `references/`, and Battle for Moscow game files are unchanged.

## Limitations and further work

- This is **pagination over a bounded, deterministic candidate search**, not a proof that all legal attacker-casualty, defender-casualty, multi-defender retreat, advance, Fleet or other special choices are enumerated. The 4,096 trial budget can stop more complex cases; a missing option must not be silently claimed impossible. Arbitrarily large attacker sets remain guarded by the existing source safety checks.
- Later pages currently rescan earlier candidate proposals and may take several seconds on weaker devices. Validation is on the browser main thread; loading text is presented first, but this is not background processing or a performance guarantee. Incremental/cancellable enumeration and complete consequence reachability remain open.
- Browser parity was shown for this crowded Arduous `EX` test, not every result or every historical scenario. No scenario-specific rules or B4M CRT changes were made.
- Deferred study order remains: optional two-unit Battle for Moscow stacking is second-to-last, unified grand campaign last.
