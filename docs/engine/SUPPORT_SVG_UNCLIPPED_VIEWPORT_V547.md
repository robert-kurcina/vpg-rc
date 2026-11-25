# Checkpoint 313 / v547 — Full-bound Support SVG counter presentation

## Fault and evidence

The v546 replacement removed source-sheet photo crops, but inadvertently introduced a **new SVG viewport crop**. `WargameSupportCounterVectors.render()` declared `viewBox="0 0 50 50"` even though the original, unchanged `WargameCounterVisuals.piece()` artwork extends beyond the 50-unit nominal tile for source shadows, outlines, and a selection frame. The Support thumbnail's CSS also used `overflow:hidden` in a 52px square.

A real Chromium inspection of the live Kiev–Odessa browser measured the untransformed shared counter group at approximately **x = −0.90 to 51.42 and y = −0.90 to 51.70**, outside the previous 0–50 viewBox. Its painted DOM bounds extended past the viewport's right/bottom edges. The user-observed truncation was therefore real, notwithstanding that the counter content itself was vector.

## Correction

- Only the **Support adapter** SVG viewport is expanded to `viewBox="-3 -3 56 56"`, including the original SVG shadow and outlines with margin; the official templates and `WargameCounterVisuals.piece()` are untouched.
- The Support card's counter holder and embedded SVG are now both 62×62 CSS pixels (formerly 52×52). The holder no longer clips its child, and the extra gray box background is removed. The Support card column layout follows the same 62px footprint on desktop and touch.
- The **rounded corners and original source shadows are authored in the supplied SVG templates**, not screenshot clips. They are preserved rather than silently flattened, squared, or reconstructed.
- Original Support SVG face IDs, printed colors, attack silhouettes, printed arrows, REFIT/damaged states, legality, targeting, phase timing, CRT, retreat styling, map artwork, and project source files are unchanged.

## Verification

| Test | Result |
| --- | --- |
| `tests/support-counter-vector-v546.test.js` (updated to the bleed-aware viewport contract) | 229 Node assertions pass |
| `tests/support-counter-vector-browser-v546.py` (updated to the 62px footprint) | 37 Chromium assertions pass |
| `tests/support-vector-full-bounds-browser-v547.py` | 29 Chromium geometry/render assertions pass across Leningrad, Kiev–Odessa, and tablet |
| `tests/support-target-map-browser-v514.py` | 78 Chromium Support-targeting assertions pass |
| `tests/historical-retreat-map-v538.test.js` | 18 Node assertions pass |
| `tests/odessa-retreat-blue-style-v541.test.js` | 12 Node assertions pass |
| Additional narrow touch review at 320px, 375px, 768px | Every SVG thumbnail and its details fit within its Support card |

The new browser test queries the **real shared SVG counter group's rendered geometry**, verifies it is completely inside the new viewBox with a safety margin, checks `overflow: visible`, and produces these actual browser screenshots:

- `rules/audit/visual/leningrad-support-uncropped-svg-v547.png`
- `rules/audit/visual/kiev-odessa-support-uncropped-svg-v547.png`
- `rules/audit/visual/kiev-odessa-support-uncropped-svg-tablet-v547.png`

This is a presentation fix only; it does not qualify unresolved naval evacuation or the uninterrupted mixed-start seven-turn Chromium campaign.
