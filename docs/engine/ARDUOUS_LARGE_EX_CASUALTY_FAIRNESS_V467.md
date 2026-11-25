# Checkpoint 233 / v467 — Large EX casualty-search fairness

## Finding

The previous shared post-roll consequence catalogue validated casualty-and-retreat branches **depth first**. In a four-attacker / two-defender Arduous EX battle with genuine photographed counter faces and source-certified hexsides, the validator exhausted the existing 4,096-attempt safety budget after accepting 2,669 unique actions across 21 pages (25 distinct casualty families). The final attacker-loss subset paired with the **second** German defender-loss choice was absent. The authoritative engine independently accepted that specific choice, including its complete two-defender retreat paths.

This is a discovery/UI completeness defect, **not** a flaw in the common CRT or the executable combat result. The combat positions are a deliberately synthetic source-valid stress fixture, not the scenario's actual opening deployment.

## Change

`core/historical_campaign_action_catalog.js` now rotates one bounded generator step at a time across casualty-loss branches for EX results with **at least four attackers and two defenders**. Smaller engagements retain their previous enumeration order. Every offered option still passes the same authoritative `session.execute` validation; the committed die is immutable. Existing page-size (128) and global attempt-budget (4,096) limits remain. The browser bundle is regenerated from the source module.

This avoids depth-first starvation of later loss distributions without creating a second rules engine or allowing invalid casualties. It does **not** make general EX consequence enumeration exhaustive: thousands of valid retreat permutations may still remain outside the trial budget, and choices are ordered differently in these larger cases.

## Evidence

- `node tests/arduous-large-ex-fairness-v467.test.js --write-audit`: **536 assertions**. The source-pinned fixture verifies the hexsides, photographed faces, shared CRT EX, independently constructs the previously omitted legal casualty/retreat choice, validates Undo and save/restore, and confirms the option is discoverable. Four pages already contain **26 distinct casualty families**.
- `node tests/arduous-large-ex-fairness-v467.test.js --full --write-audit`: optional slower full-budget run passes **2,602 assertions**. At 4,096 attempted validations, the revised catalogue includes 2,560 distinct legal options across 20 pages and **26 casualty families**, including both alternatives for the final all-four-attacker loss subset. The limit is still reached; selection is better distributed, not exhaustive.
- `node tests/arduous-stacked-postroll-oracle-v466.test.js`: independently generated bounded 54-EX/18-DRL choice sets still match exactly (93 assertions).
- `node tests/historical-postroll-cursor-v464.test.js`: resumable page cursor retains bounded-step behavior (24 assertions).
- `python3 tests/arduous-postroll-paging-browser-v461.py`: the 3-page Chromium result still offers 384 distinct, executable validated options; save, committed die, Undo, and tamper resistance remain intact (49 assertions).
- `node tests/historical-fleet-ignore-retreat-catalog-v465.test.js`: Fleet no-retreat DR/DRL/EX source choices still pass (121 assertions).
- `python3 tests/arduous-cancellable-postroll-browser-v464.py`: Chromium cancel/resume remains functional (**54 assertions**).
- `node tests/arduous-contested-seven-turn-v422.test.js`: the **184-action, seven-turn headless campaign** completes with the established Soviet victory.
- `node tests/historical-joint-safe-retreat-v397.test.js`, `node tests/historical-joint-order-retreat-v395.test.js`: 35 and 30 assertions, respectively.
- `node tests/kiev-first-turn-combat-v442.test.js`: 45 assertions; Kiev live gameplay remains gated.
- `node tests/city-dots-only-v457.test.js`: 5,376 accepted visual assertions.

One legacy cross-game human-decision test exceeded its execution window in a combined run and is **not** counted as passed. The complete 184-action Chromium campaign was not rerun.

## Preservation and next work

The original counter faces, five registered map exports, v463 City dots, scenario configurations, historical CRT, and authoritative combat resolver remain unchanged. A future more complete consequence-selection mechanism must preserve source verification and avoid making the browser unresponsive. The existing 4,096 validation ceiling remains explicitly documented as a limit. Battle for Moscow optional two-counter stacking study stays second-to-last priority; the unified campaign study is absolute last.
