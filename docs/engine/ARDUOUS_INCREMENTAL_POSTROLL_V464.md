# Checkpoint 230 / v464 — Incremental and cancellable post-roll consequence paging

## Problem and scope

The checkpoint-227/v461 human combat interface let players reach validated consequences beyond the first 128, but loading a later page synchronously revalidated earlier pages. With crowded `EX` outcomes, even the second page could block the browser main thread for several seconds. The committed die, selected battle, and game state must remain unchanged throughout discovery.

## Shared-engine implementation

- `core/historical_campaign_action_catalog.js` now exposes `createPostRollPager`. Its generator yields after each authoritative candidate transaction check and after source casualty/retreat preview stages. A single pending die owns one cursor, which stores source-validated candidates in deterministic order and resumes from its previous position.
- The existing `discoverPostRoll({session,context,die,page})` remains supported as a one-shot wrapper for existing clients. Both paths rely on the **same historical campaign transaction** and post-casualty/retreat rules. Neither commits the die, changes the map, or supplies an alternative CRT.
- `core/historical_campaign_human.js` caches the cursor in its in-memory pending-die session and exposes `preparePage(page,steps)`. A bounded call returns progress or a completed verified page. Choices remain selectable only after being offered by a validated page. A restored save rebuilds the derived cursor from the authoritative saved pending die, retaining the established v401 save format.
- `core/historical_browser_app.js` runs page checks in batches of at most 24 iterator steps, yielding an event-loop turn between batches. The Arduous and Leningrad browser controls now provide **Cancel search**. Cancellation stops additional validation at the next cooperative boundary; it does not change the committed die or campaign. Re-requesting the page resumes the same in-memory cursor.
- The original **128 choices per page** and **4,096 attempted transaction safety limit** remain. Reaching the work budget stops further discovery and reports an explicitly non-exhaustive result; it does not authorize a false choice. `exhaustive: false` continues to reflect incomplete rules-option enumeration.

## Actual browser evidence

`python3 tests/arduous-cancellable-postroll-browser-v464.py` passes **54 assertions** using Chromium and the real Arduous browser controls. A source-valid four-Soviet-attacker/two-German-defender `EX` at `0306` with a real committed die of 2:

- Exposes 128 validated choices on each of three pages (**384 distinct** across pages, no duplicates).
- Shows incrementing progress during the second-page search and offers the Cancel control.
- Cancels after a genuine progress update; current page, committed die, journal, and save all remain identical.
- Resumes and reaches subsequent pages, and a third-page choice commits through the authoritative resolver.
- Rejects a forged different-die choice, preserves save/restore and Undo, and reports no browser page errors.

See `rules/audit/arduous-paged-consequences-v464.json` and the actual Chromium screenshot `rules/audit/visual/arduous-postroll-page-three-v464.png`. In one run, resumed page-two validation took **2.22 seconds**; this is a measurement, not a device-wide latency guarantee. The original v461 historical audit and screenshot are preserved separately.

## Additional regressions

- `node tests/historical-postroll-cursor-v464.test.js` — **24** source-bound cursor assertions, including bounded progress, deterministic order, replay equivalence, immutability, unavailable-page rejection, source authenticity and save/restore.
- `node tests/historical-campaign-combat-decisions-v392.test.js` — **281** assertions.
- `node tests/historical-human-decision-gateway-v401.test.js` — **37** assertions.
- `node tests/historical-postcasualty-retreat-v393.test.js` — **155** assertions.
- `node tests/historical-joint-safe-retreat-v397.test.js` — **35** assertions.
- `node tests/historical-postcombat-fleet-choices-v394.test.js` — **1,264** assertions.
- `node tests/historical-fleet-forced-displacement-v384.test.js` — **768** assertions.
- `node tests/historical-air-sea-support-v385.test.js` — **163** assertions.
- `node tests/human-lazy-combat-plans-v425.test.js` — passes.
- `python3 tests/arduous-exchange-overflow-browser-v452.py` — **35** assertions.
- `python3 tests/arduous-postroll-paging-browser-v461.py` — **49** assertions (with historical evidence preserved after rerun).
- `node tests/arduous-contested-seven-turn-v422.test.js` — **184** actions and seven-turn Soviet victory in a successful standalone rerun; one earlier combined timeout was inconclusive.
- `node tests/kiev-first-turn-combat-v442.test.js` — **45** assertions, Kiev live gate remains closed.
- `node tests/city-dots-only-v457.test.js` — **5,376** assertions and accepted 24-dot city geometry.

## Technical limitations and next work

- The generator yields between individual checks, **not during** a synchronous authoritative transaction or retreat enumeration. An individual unusually expensive source check can still block the main thread briefly. Work remains on worst-case latency and cancellation under large branching.
- Cancellation pauses the in-memory cursor; closing a tab or restoring a save reconstructs its transient derived progress. No asynchronous background service, worker, BFF, or network call was added.
- Exhaustiveness of legal `EX`, retreat, Fleet, and other source consequence branches remains **unproven**. The 4,096-attempt safety budget remains explicit; missing choices cannot be assumed illegal.
- One crowded Arduous `EX` and a source Leningrad result were directly tested. This does not certify all possible battles or all scenarios. The full 184-action **Chromium** contested trace was not rerun in this checkpoint; the 184-action headless campaign was.
- The accepted v463 city dots, all five actual-engine map exports, shared CRT, counter artwork, and scenario configurations are not modified. The two lowest priorities remain the optional B4M stacking study and, last, the unified grand-campaign study.
