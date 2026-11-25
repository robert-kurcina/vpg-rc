# Odessa Black Sea Fleet Support-window thumbnail correction — v542 / Checkpoint 308

## Defect and correction

The original `assets/support-counters/odessa-front-r01c01.png` and `odessa-front-r02c01.png` thumbnails were generated with `crop` rectangles starting at source-sheet x=5. Those rectangles included the vertically printed `ODESSA (front)` label on the left and omitted the final 15 source pixels on the right, clipping the printed Black Sea Fleet name and its red counter edge.

The **Support display crop** now starts at x=20 on the exact same Odessa original photographic front sheet (`assets/official-counters/source-sheets/counters-odessa-front.jpg`). The corrected bounds are:

| Face ID | Former display crop (x,y,w,h) | Corrected display crop (x,y,w,h) |
| --- | --- | --- |
| `odessa-front-r01c01` | `5,7,71,69` | `20,7,71,69` |
| `odessa-front-r02c01` | `5,76,71,70` | `20,76,71,70` |

The crop overrides live in `assets/support-counters/crop-overrides.json`, exclusively for thumbnail production. `scripts/build-support-counter-art.py` applies these overrides when deriving source-photo PNGs and regenerates `core/support_counter_art_bundle.js` from the resulting image bytes. There is no scaling, repainting, fabrication or changes to the actual counter source-sheet JPEGs. The original counter-face `crop` metadata stays untouched for gameplay identity and template rendering.

## Verification

- Pixel-for-pixel equality of the corrected cropped PNGs with the corresponding source JPEG rectangles, plus actual Chromium Support-window rendering at desktop and tablet sizes: **22 assertions** (`tests/odessa-fleet-support-crop-browser-v542.py`).
- Existing source-image/embedded bundle byte-equivalence audit: **31 assertions** (`tests/support-counter-embedded-art-v538.py`).
- Existing Support image URL and source-face availability contract: **39 assertions** (`tests/support-counter-url-contract-v516.py`).
- Existing validated retreat map model: **18 assertions**; accepted two-tone retreat style: **12 assertions**.
- Compared to packaged v541 checkpoint: only the two front Fleet PNG thumbnails changed among **22** Support PNGs; all **20** other Support PNGs remain byte-identical. The original Odessa front/back source sheets, map exports, source counter metadata, rules, CRT and two-tone retreat UI files remain unchanged.

## Actual-browser visual evidence

- `rules/audit/visual/odessa-fleet-support-crop-desktop-v542.png`
- `rules/audit/visual/odessa-fleet-support-crop-tablet-v542.png`

The tablet screenshot shows the standard height-constrained Support dock with internal scrolling, not the whole Fleet card at once. The Fleet card was verified visible and the image decoded in both environments.

## Scope and remaining work

This corrects photographic **Support thumbnail crop geometry only**. It does not change naval action legality, movement, combat, retreat, source setup, game journals, or historical certification. The planned Kiev–Odessa source-face selection, concealed mixing, live naval evacuation, comprehensive historical adjudication, and full seven-turn Chromium re-verification are not completed here.
