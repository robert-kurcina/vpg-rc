# Checkpoint 321 · v555 — Longer retreat arrows, inset destination border

## Presentation delta

- Shared `WargameHistoricalRetreatMapUX.segment` reduces default endpoint trim from **12** to **5** map coordinates. Each ordinary two-point leg becomes **14 map coordinates longer** in total. This does not change the engine-supplied route or the position of any counter.
- The existing seven-vertex `blockArrowPoints` SVG polygon is unchanged: solid light blue `#72c9ff`, sharp shoulders and a pointed head, no outlines/shadows.
- An additional pointer-inert SVG polygon is drawn inside each authoritative destination hex: light blue `#72c9ff`, stroke width **1.5 screen pixels**, with inset calibrated to approximately **4.8 map units at the hex apothem**. Original cobalt `#0a58ca` border and pulse remain the outside treatment.
- Inset targets cannot capture pointer events; all retreat actions still come exclusively from the unchanged authoritative combat consequence catalogue. Source maps, combat rules, counter sources and the shared CRT remain untouched.

## Verification

- `node tests/historical-retreat-block-arrows-v555.test.js`: **38** assertions; checks longer trim and unchanged block geometry.
- `node tests/historical-retreat-map-v538.test.js`: **18** assertions; explicitly validates the prior 12-unit trim remains supported as a caller override.
- `node tests/odessa-retreat-blue-style-v541.test.js`: **10** assertions.
- `node tests/odessa-source-city-recapture-v551.test.js`: **181** assertions.
- `python tests/odessa-source-city-recapture-browser-v555.py`: **54** Chromium assertions; validates routes, two borders, actual colors/geometry, source combat, route click, pending Save/Restore, capture/recapture and Undo.

## Screenshots

- `rules/audit/visual/odessa-kovel-soviet-retreat-arrows-v555.png` — actual Chromium browser render.
- `rules/audit/visual/kiev-odessa-long-retreat-arrows-detail-v555.png` — crop of that same actual browser render, enlarged for visual inspection; not an invented map or image-generation mockup.

## Scope

This is presentation-only; it does not certify unverified territorial, naval evacuation or uncommon combat cases. Existing v554 evidence is preserved.
