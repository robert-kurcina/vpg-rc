# Checkpoint 218 / v452 — Arduous German elimination-to-rebuild Chromium acceptance

## Authoritative inputs

- `references/rules/arduous-rules.pdf`, §§10.0, 12.0–12.4 (German replacement Turn 4, western black edge, German infantry rebuild at one step, controlled communicating-city alternative).
- `maps/setup/arduous.json` and `tests/fixtures/arduous-source-setup-v419.js`: a **candidate but source-validated** initial allocation, not a unique historical unit-to-hex prescription.
- `maps/buildup-configs/arduous.json`: one German replacement step starting on Turn 4; western entry hexes `0105`–`0110`.
- Original photographed German infantry `arduous-front-r02c07`, reduced reverse `arduous-back-r02c02`.
- Project-authorized **same exact B4M CRT** used across all historical scenarios; we did not change its results.

## Fully player-facing browser acceptance (168 checks)

`tests/arduous-human-german-rebuild-v452.py` uses the actual shared game-engine/browser bundle and all visible Chromium controls; no state edit, synthetic casualty, or direct application of headless replacement methods.

1. Turn 1 German Combat: declare a source-legal multi-unit attack against Soviet `0305` with photographed Air Corps support, commit the die `4`, and select an authoritative **EX** casualty option that reduces German infantry `arduous-front-r02c07` at `0306`.
2. Turn 1 Soviet Combat: declare a source-legal counterattack against German `0306`, using three existing mechanized counters, commit die `2`, and choose authoritative **EX** defender loss against the already reduced German source counter. The counter disappears from the live board as a real combat casualty.
3. Progress through original scenario phases using only visible legal pass actions to German Turn 4 Build-Up. The off-map counter remains an eligible previously deployed unit.
4. The browser offers a west-edge `0105` reentry; choosing it returns `arduous-front-r02c07` on reduced photographed reverse `arduous-back-r02c02`, spends one German replacement step, and records `replacement-rebuilt` in the campaign journal.
5. Save/restore, Undo and reselect reproduce exact original and rebuilt states/journals. No page errors.

## Corrected shared post-roll action catalog (35 more Chromium checks)

The separate `tests/arduous-exchange-overflow-browser-v452.py` reproduces an actual source-valid Soviet attack with **four attackers against two German defenders** at `0306`. A die of `2` produces **EX**. Previously the catalogue raised `combat-result-choice-limit-exceeded`, aborting the committed die with no consequence choice. v452 bounds accepted valid choices at **128**, returns a clearly **non-exhaustive** catalogue, and lets the player commit one actual validated consequence instead of trapping the game. The human pending-die gateway caches the same authoritative options during UI refresh, and the UI explicitly informs the player that more legal choices may exist. Each offered choice is still checked using `session.execute` against the source-configured shared engine.

**Limitation:** this is a fail-safe bounded subset, *not full choice completeness*. Some other legal exchange casualty/retreat combinations may be omitted. A later gameplay task should enable access to all valid source alternatives without combinatorial explosion. The `exhaustive:false` contract remains unchanged.

## Regression and preservation

- New real browser acceptance: **168** and **35** assertions, respectively.
- Older real browser Soviet Turn-3 on-map replacement (v448): **129 passed**; Soviet off-map eligible Mechanized rebuild (v450): **149 passed**.
- Independent German western communication oracle: **1,644 passed**; 6th Mechanized restriction: **23 passed**; human save/restore: **37 passed**; shared combat decision catalog: **281 passed**; mixed eight-turn persistent combat: **63 passed**; approved city dashed-border style: **533 passed**.
- Compared with the original full v451 project archive, all **316** of the unchanged protected files remain SHA-256 identical; **four** intentionally modified shared files: `core/historical_campaign_action_catalog.js`, `core/historical_campaign_human.js`, `core/historical_browser_app.js`, and the regenerated `core/historical_engine_browser_bundle.js`. None of the gameplay configs, rules PDFs, CRT, five map exports or art assets changed.
- Both second-to-last optional B4M stacking and absolute-last unified campaign studies remain deferred.

## Outstanding

Actual player-controlled capture of a city followed by a German replacement at that **captured, west-communicating city** is not yet certified. Neither the 184-action contested browser campaign nor complete post-roll consequence selection is claimed. Kiev and Kiev–Odessa remain separately gated.
