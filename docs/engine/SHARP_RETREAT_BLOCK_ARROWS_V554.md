# Checkpoint 320 / v554 — Sharp retreat arrows and contrasting destination outlines

## Source and scope

Retreat path geometry still comes exclusively from the current shared engine's exact, post-roll, validated consequence catalog. The presentation helper converts a trimmed legal segment into a seven-vertex, unrounded filled block arrow. No new route, movement cost or combat rule is inferred.

## Visual changes

- Solid light-blue `#72c9ff` for every arrow segment, from square tail through triangular point, with no stroke marker, rounded caps, or drop shadow.
- Tail half-width 5.2 map units, head half-width 12, head length 17 (on ~41-map-unit trimmed legs). Sharp perpendicular head shoulders.
- Cobalt `#0a58ca` destination hex outlines (5-unit base, 6-unit selected) and matching pulse. Support, reinforcement and resupply highlights retain the older dark-yellow style.
- Pre-existing wide invisible keyboard/touch arrow hit paths retained.

## Validation

- `node tests/historical-retreat-block-arrows-v554.test.js`: 34 shape assertions.
- `node tests/historical-retreat-map-v538.test.js`: 18 model assertions.
- `node tests/odessa-retreat-blue-style-v541.test.js`: 10 current-style assertions (historical file, updated for the superseding approved design).
- `node tests/odessa-source-city-recapture-v551.test.js`: 181 combat assertions.
- `python tests/odessa-source-city-recapture-browser-v554.py`: 50 live Chromium assertions, including valid map route click, destination color, seven distinct polygon vertices, combat Undo and Save/Restore.

## Evidence

- `rules/audit/visual/odessa-kovel-soviet-retreat-arrows-v554.png` — actual shared-browser engine render.
- `rules/audit/visual/kiev-odessa-sharp-retreat-detail-v554.png` — crop from that exact browser screenshot, enlarged for review.

No complete seven-turn Chromium rerun was attempted for this presentation-only change.
