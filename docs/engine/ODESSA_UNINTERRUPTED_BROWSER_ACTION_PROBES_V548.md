# Checkpoint 314 / v548 — uninterrupted Kiev–Odessa Chromium campaign

## Verified change

The original source-mixed Soviet Mechanized Corps and selectable 49 Mountain German Turn-3 reserve now complete one uninterrupted, seven-turn contested human-browser campaign through the shared engine. This is the **same documented experimental scenario**, not a newly certified historical setup or a reimplementation of the game rules.

The Chromium browser actually opens the source-configured game, uses its visible deployment Mix, German face dropdown and Begin Turn 1 controls, commits an FK IV-supported Turn-1 combat Exchange (d6=3), uses the real Turn-3 Orders button to place 49 Mtn, places all six scheduled reinforcements, completes every housekeeping transition, computes the Turn-7 terminal result, and authenticates Save/Restore and Undo. The terminal view renders the original shared-engine map, 42 actual source-faced ground counters, and SVG Support counters. Other phase transactions use the same public human browser action interface. **148 Chromium assertions PASS**, with a reproducible terminal screenshot and complete authenticated campaign save.

## Root cause and implementation

The original legal-action catalog tests candidate actions by calling `session.execute()`. Even though their output is discarded, `execute()` creates a full journal entry, serializes a snapshot and computes its SHA-256 hash for *each candidate*, including hundreds of human movement destinations. The source route search and source rule-validation still need to run for every action.

The shared campaign session now exposes a boolean `canExecute(input)` probe. It calls the identical `normalizedAction()` and `machine.step()` code on the identical deep-cloned private session state used by `execute()`, but **does not hash or write a journal for that throwaway attempt**. The action catalog uses this probe when present; legacy session stubs without it retain their original `execute()` trial path. The public commit path is unchanged: it performs the same authoritative adjudication *and still creates SHA-256 journal records*. Bad actions return `false` from the probe and are still rejected by the original action executor. No new action is deemed legal by heuristics.

The shared browser engine bundle was rebuilt from the amended source modules. This optimization benefits every scenario using the common catalog, not only Kiev–Odessa.

## Evidence

- `node tests/historical-campaign-readonly-probe-v548.test.js` — **154 assertions passed**: two distinct historical scenario contexts, legal/illegal candidate probes, equality with authoritative `execute()` outcomes, no state/journal mutation after any probe, and authenticated replay after committed actions.
- `python3 tests/odessa-mixed-selected-seven-turn-browser-v548.py` — **148 Chromium assertions passed**: source-mixed/full selected opening, contested EX, six source reinforcements, all seven turns, 42 source counters, Undo, full save and terminal replay. No staged save injection.
- `rules/audit/visual/odessa-mixed-selected-seven-turn-browser-v548.png` — screenshot of the actual browser after Turn 7.
- `rules/audit/saves/odessa-mixed-selected-seven-turn-browser-v548.json` — authenticated real campaign journal and pending human state, not a synthetic fixture.
- One local browser timing profile: Turn-1 Soviet special movement refresh decreased from approximately 2.19s to 1.33s; Soviet regular movement from 2.31s to 1.28s. These are **environment-specific measurements**, not a guaranteed device-independent benchmark.

## Retained constraints

The original source assets, maps, counter templates, shared Combat Results Table, phase order, visual design, Support SVG rendering and accepted dark/light-blue retreat arrows are unchanged. Existing tested phase legality, save envelope format/version, SHA-256 integrity and Undo remain in force. No new server, browser mockup or scenario-specific duplicate renderer.

## Outstanding coverage

This one successful seven-turn browser path does **not** exercise every possible legal movement, city-control event, combat result, terrain/national boundary, strategic AI, nor the original Odessa §15.3 naval evacuation. The rules' evacuation **phase authority is still undetermined**; the action remains intentionally gated. The historical fifth-game certification and broad adversarial/regression matrix remain WIP.
