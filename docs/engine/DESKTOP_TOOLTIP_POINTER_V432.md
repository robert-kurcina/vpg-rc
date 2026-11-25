# Checkpoint 198 / v432 — adaptive terrain-tooltip pointer

## Change and scope

The shared desktop terrain reference (Battle for Moscow, Arduous Beginning, Target: Leningrad) has a small triangular notch that visually attaches the reference panel to the pointer location at the time the dwell completes. This is **presentation-only**: no game state, map registration, combat/CRT, movement source, renderer, counters, or settings persistence was altered.

The notch is a separate, `aria-hidden` and `pointer-events: none` layer. A separate element was required because the existing tooltip clips its contents to prevent overflow on short screens; a pseudoelement protruding outside that clipped panel would disappear. The new pointer uses two overlaid CSS triangles with the **same fill and border colors** as the existing tooltip, with a roughly 8 px tip and a 16 px base.

## Behavior

- The panel and notch are placed **once per hex hover**. Pointer jitter within that hex does not reposition either. The notch aims at the initial cursor anchor, not at rapidly changing pixel coordinates.
- The panel prefers to appear to the **right** of the cursor, flipping to the **left** where required. If neither horizontal orientation fits, it uses **below** or **above** the cursor. The notch changes edge to match. In a very small desktop viewport, placement prefers the least overflowing direction and clamps the panel fully into the viewport.
- The notch tip stays about **9–10 px** from the initial cursor location along its approach axis, while the panel remains ~18 px away. Its contact point slides along the selected panel edge, with a protected margin from rounded corners.
- The notch is hidden with the reference on Escape, pointerdown/drag, wheel or scroll, context menu, map exit, tab switch, visibility loss, blur, resize, and a Settings toggle change; it never captures map clicks. The tooltip delay remains **380 ms initially** / **190 ms between hexes**. No separate Settings toggle was introduced.
- Touch/iPad devices remain excluded by the existing desktop-hover policy, and both panel and notch are additionally suppressed through CSS in coarse-pointer/hoverless media.

## Acceptance and verification

- `node tests/tooltip-pointer-v432.test.js`: 486 geometric assertions on four orientations, screen margins, notch alignment and corner/edge conditions.
- `python tests/tooltip-pointer-browser-v432.py`: actual-game Chromium pages for B4M, Arduous, Leningrad, small 380 × 800 desktop viewport and simulated iPad. Checks the corresponding four notch orientations, no cursor jitter drift, noninteractive arrow, cancellation, viewport bounds, Settings and touch suppression; no browser page errors in the three normal desktop games.
- `node tests/tooltip-ux-v431.test.js`: 584 certified hexside and source-effect assertions continue to pass.
- `python tests/tooltip-ux-browser-v431.py`: previous tooltip interaction checks passed on B4M, Arduous, Leningrad and touch-simulated iPad (the previous screenshot was restored unchanged afterward for provenance).
- `rules/audit/visual/arduous-terrain-notch-hover-v432.png`: **real Chromium mouse hover** on source hex `0305` of Arduous, from the actual game renderer, not image-generation or an illustrative mock.

### Not covered

Physical iPad Safari and macOS Safari are not tested in this headless Chromium runner; narrow desktop tests use synthetic pointer coordinates delivered to a real map element so that every arrow orientation can be exercised even when no corresponding visible hex lies at that pixel.
