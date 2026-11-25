# Checkpoint 303 / v537 — Kiev–Odessa contested seven-turn browser acceptance

## Implemented

The **existing historical campaign engine**, shared human action gateway, standard B4M CRT and unchanged map/counter renderers now have a complete, recorded contested seven-turn experimental acceptance path. This is no parallel simulation, alternative CRT, or synthetic map.

1. Open the existing source-bound Kiev–Odessa experimental campaign with the original 36 ground counters and separate Black Sea Fleet.
2. Use original German Panzer counters `kiev-front-r01c01` and `kiev-front-r01c03` to attack `0205`; commit original FK IV Air Support and an actual d6 result of 3. The shared CRT yields **EX** and the casualty-selection transaction reduces the first Panzer counter to its original photographed reverse face. Save and restore a **pending post-roll die** before selecting the consequence.
3. Commit a real ground movement from the existing catalog through the shared movement journal.
4. In Turn 2, place the source-faced Slovak `kiev-front-r02c07` and Hungarian `kiev-front-r04c08`. In Turn 3 place German `kiev-front-r01c07` and Italian `kiev-front-r04c01` (German turn-3 entry is tested through the **visible player Orders button**, not just an engine-only API). In Turn 5 place Soviet `kiev-front-r04c05`; Turn 6 `kiev-front-r04c06`. The source-reconciled experimental boundary and original nationality/stack rules apply to each.
5. Finish every mandatory phase and each housekeeping through Turn 7. All 42 ground counter identities remain on the map in this specific test, and terminal source-scored evaluation is computed. Later-turn saves, Undo of two reinforcement placements, final Save/Restore of the **full campaign journal**, and undoing terminal housekeeping all work.

## Shared human action catalog performance fix

`core/historical_campaign_human.js` now reuses the **authoritative validated legal-action catalog** for the lifetime of one immutable human decision wrapper. Previously, `choose()` would recompute the entire movement/combat candidate graph after the same source list had been computed for `view()`; browser `refresh()` also requested another view. All actions still go through the existing authoritative transaction, and each committed action/Undo/Restore constructs a fresh decision wrapper and source catalog. Post-roll pagination remains separately immutable.

`tests/historical-human-catalog-cache-v537.test.js` instruments authoritative catalog discovery to confirm: repeated reads and choosing a displayed action result in one discovery; a fresh decision requires a fresh discovery; returned view mutation does not affect cached content; stale choices remain rejected; Undo and Save/Restore recreate correct catalogs. No scenario-ID or map special casing is introduced.

## Verification and scope

Commands from the project root:

```sh
node tests/odessa-contested-seven-turn-scheduled-arrivals-v537.test.js
node tests/historical-human-catalog-cache-v537.test.js
python tests/odessa-contested-seven-turn-browser-v537.py
python tests/odessa-contested-terminal-render-v537.py
```

- 166 Node assertions for the contested seven-turn engine: source-correct combat and six timed arrivals, negative placement tests, nationality, source counter identity, full journal replay, terminal Undo and all seven housekeepings.
- 18 cache-specific Node assertions for legal catalog reuse and invalidation.
- 137 Chromium assertions (baseline test) for the real shipped browser, map export, artwork projection, human commands, combat die, move, turn-specific placement, visible Orders button, Undo and Save/Restore.
- Browser evidence: `rules/audit/visual/odessa-contested-seven-turn-browser-v537.png`. The independent **source-save-restored** 9-assertion Chromium test takes a clean map-only screenshot at `rules/audit/visual/odessa-contested-seven-turn-map-v537.png` with all 42 original counters. The playable 93-action human-session save is at `rules/audit/saves/odessa-contested-seven-turn-v537.json` and may be loaded into the unchanged game UI. Offline tests replace network fetches with the **same source JSON** and the approved shared map PNG; no graphic has been generated or reillustrated.
- The combat, map geometry, scenario source rules, counter palette, damage bar, photographed faces, source PDF files and B4M CRT are unchanged from v536.

## Not yet complete

The acceptance path tests one particular battlefield course, not arbitrary human decisions: it does **not** exercise a move across the original Kiev/extended Odessa seam, changed ownership of a source city, naval evacuation/transport/return transaction, alternative German source-face inventory allocation, concealed mixing, or every contested retreat/port/displacement case. Romanian territorial masks remain intentionally fail-closed where unknown. Seven-turn *experimental* operation is evidenced; historical certification and adversarial branch coverage remain WIP. Do not present the source-reconciled additional composite edges as fully certified historical geography.
