# Checkpoint 214 / v448 — Arduous player-facing Turn-3 replacement acceptance

## Source and scope

The supplied `references/rules/arduous-rules.pdf`, §12.0–12.4, authorizes restoration of an on-map reduced-strength unit during the owning player's Build-Up Phase using one available Replacement Step, with the appropriate source-defined communication restrictions. Unused replacement steps expire after the Build-Up Phase; they cannot be banked. This checkpoint **does not** change a game rule, map, source artwork, or renderer.

The previous seven-turn Chromium human-control trace (`rules/audit/arduous-human-browser-v425.json`) finished without ever performing a replacement, even though the source-backed headless contested campaign exercised them. This checkpoint adds direct **human browser** coverage of a legal replacement on a genuinely reduced source counter, instead of injecting a synthetic state.

## End-to-end browser proof

Script: `tests/arduous-human-replacement-v448.py`.

1. Load the actual Arduous native-preview HTML, the historical browser bundle and the approved shared-renderer map export into Chromium. Local HTTP navigation is blocked in this runtime, so the test loads the **original** files in-memory, not a replacement renderer.
2. Select the source-legal Turn-1 battle at `0305`, with German source faces `arduous-front-r02c02`, `arduous-front-r02c03`, and `arduous-front-r02c08`.
3. Commit a source-legal German air unit, commit an ordinary die roll of 4 producing `EX` using the shared CRT, and choose a legal retreat/advance consequence.
4. Finish the remaining phases without manufacturing any moves or casualties. Arrive in Soviet Build-Up on Turn 3 with the on-map Infantry Army `arduous-front-r03c06` reduced to 4 strength at hex `0504`.
5. Use the player-visible filter and **Replace** action to restore its printed 8-strength side. The action consumes exactly one replacement step and one campaign journal entry, retaining owner and position.
6. Save and restore; Undo restores the exact pre-replacement state and journal; replaying the same visible action produces the identical state and save. Verify this already-full-strength counter is no longer offered another restoration.
7. Finish Build-Up through the UI, verify transition to Soviet Special Movement, and verify the full Turn-3 replacement allowance was used with no step carried over.

## Results and boundaries

- **129** assertions passed in Chromium; no page errors or UI-action errors.
- One source-authenticated later-turn on-map restoration fully tested; the 4-to-8 strength change was verified against the actual source counter state.
- `rules/audit/arduous-human-replacement-v448.json` contains source PDF digest, phase trace, action and strength facts, browser check count, and limitations.
- `rules/audit/visual/arduous-turn3-soviet-replacement-v448.png` is an **actual browser screenshot** showing the supported action in the live UI, not a mockup.
- Not yet proven through the browser: off-map eliminated-unit rebuilds, restrictions on the Soviet 6th Mechanized Corps after elimination, all replacements on later turns, or the full 184-action contested trajectory.
- The canonical current source game opening remains a candidate due to the printed deployment marker mismatch. Kiev/Kiev–Odessa remain gated and unaffected.

## Regression/preservation

The approved v447 renderer, terrain artwork, maps, counter assets, combat table, campaign code, and other source/game logic remain unchanged. The longer headless contested seven-turn replay was attempted but **timed out** in the current execution budget; it is not counted as a passing regression in this checkpoint. Focused source-graph, Kiev rules and inventory, city-dash, and Arduous roster/victory regressions passed.
