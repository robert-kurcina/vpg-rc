# Checkpoint 258 / v492 — Source red damage band and bounded resupply highlighting

## User-reported defects

1. The Soviet reduced 4–4 counter at Kiev `0405` showed its printed reverse values but **not** the red vertical damage band defined by the user's original `counters-temp(1).svg`.
2. German counters in unrelated stacks received amber counter-frame outlines in Soviet resupply.
3. Non-action hex `0101` appeared to have an amber hex outline while the cursor hovered over it, visually indistinguishable from legal repair guidance.

## Root causes and changes

- `core/historical_counter_face_projection.js` always set projected vector state `strength:'full'`. It correctly selected the reduced *printed face*, but accidentally suppressed the existing `status_reduced` path in the official SVG template. The projector now sets `strength:'reduced'` for **`strengthStatus:'printed-reduced'` only** and supplies that same transcribed source face in both template-state slots, preserving the actual historical face's 4–4 printed values. Untried and revealed-one-step mechanized faces are not treated as a new two-step loss.
- `core/historical_browser_app.js` previously marked the top of **every** two-unit stack during repair mode. It now marks only the **eligible legal-action repair target** in a hex containing more than one eligible unit, using `BuildupMap.actionAtHex` and current on-map stack order. The indicator never changes game state; source actions and stack swapping are preserved.
- A generic `.hex-hit:hover` rule used the same amber color as the resupply indicator. A phase-scoped `buildup-map-active` guard now suppresses this visual cue on any non-actionable hex while the buildup map controls are visible. Legal reinforcement, repair and rebuild highlights retain their existing distinct blue, amber and green colors.

The original `assets/official-counters/source-counters.svg` (SHA-256 `a45fd59ebc50fac41686289e41d387d83474f81b0b7da25fe37107ce132ad51b`) and original scanned source sheets are **unchanged**. The source-authored bright red `status_reduced` path is rendered, not substituted with invented artwork.

## Verification

- `node tests/kiev-counter-damage-and-buildup-visual-v492.test.js`: 38 assertions (source fingerprint, full vs. reduced vs. revealed-one-step, correct reverse digits and red-band visibility, bounded stack highlight).
- `python tests/kiev-buildup-map-browser-v492.py`: 54 checks, including real Kiev Turn 1 EX, Soviet Turn 2 0405 repair, displayed SVG red path, removal after repair, Undo, no unrelated German outline, no false amber at hovered 0101, and legal blue reinforcement map highlights.
- `python tests/kiev-counter-color-browser-v490.py`: 19 checks; updated the earlier test expectation to reflect the authored red band on the sole printed-reduced unit. It now writes a distinct v492 screenshot to avoid overwriting the historical v490 screenshot.
- Existing source-counter, Kiev setup, source-palette, phase activation, Romanian Turn 1, reinforcement border, and shared buildup tests pass. Original game maps, CRT, combat rules, and all five source engine SVG/PNG exports remain unchanged.

### Visual evidence

- `rules/audit/visual/kiev-resupply-map-browser-v492.png`: actual Chromium browser screenshot on the existing shared-engine Kiev map.
- `rules/audit/visual/kiev-reduced-source-band-detail-v492.png`: unmodified crop (scaled nearest-neighbor) from that Chromium screenshot, showing the source red vertical band.
- `rules/audit/visual/kiev-buildup-map-browser-v492.png`: actual Chromium reinforcement-placement screenshot.
- `rules/audit/visual/kiev-source-counter-palette-damage-browser-v492.png`: actual Chromium source-vector field-color and red-band verification screenshot.

## Scope and limitations

This is a **rendering/UX** correction. No rules, combat results, board geometry, unit strength, repair costs or entitlements are changed. It does not certify Kiev–Odessa or new AI capabilities; Kiev remains an experimental runnable human campaign.
