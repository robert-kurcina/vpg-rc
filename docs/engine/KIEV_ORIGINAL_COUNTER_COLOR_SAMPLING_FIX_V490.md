# Checkpoint 256 / v490 — Objective: Kiev counter-sheet color sampling correction

## Source authority and correction

The user re-supplied the original *Objective: Kiev* counter-sheet JPEGs, which are byte-identical to the archived originals:

- Front: `counters-kiev-front.jpg`, SHA-256 `9db4bc6382f174017cb23f9c907369a25e173143a29e292b656b8f48ddfc4724`.
- Reverse: `counters-kiev-back.jpg`, SHA-256 `533165e074c4c6a2774811053347d19615eb85acce69987192301c403dcefeea`.

Previous `maps/counter-configs/kiev.json` metadata incorrectly registered seven face background colors because image sampling selected NATO graphics, lettering, or other non-field pixels. These were **not** intentionally darker source counter variants, gameplay status or reduced-strength shading.

| Printed source face | Former erroneous field | Corrected source field |
|---|---|---|
| front r01c03, German Panzer Corps 48 | `#485c51` | `#8ba195` |
| front r02c03, German Infantry Corps 54 | `#4b5b51` | `#8ba195` |
| front r03c03, Game Turn marker | `#4a5b51` | `#8ba195` |
| front r04c02, Soviet Mechanized Corps | `#95bf91` | `#d7a477` |
| front r04c03, Soviet Mechanized Corps | `#745332` | `#d7a477` |
| front r05c03, Soviet Mechanized Corps | `#745332` | `#d7a477` |
| reverse r04c02, Soviet Infantry Army 40 | `#c0bccd` | `#f8a19a` |

The corrected RGB values are validated against the **original JPG** with per-face unobstructed field patches, rather than inferred from nationality. That last distinction matters: the source intentionally uses different colors for Romanian, Hungarian, Slovak, Italian, German and Soviet classes, as well as front versus reverse faces. This patch does **not** apply a generic faction color palette.

## Technical scope

- Corrects only the seven `observedFieldColor` values in `maps/counter-configs/kiev.json`.
- Regenerates `core/historical_engine_browser_bundle.js` from the exact shared CommonJS code and corrected source JSON; no new renderer or game code.
- Original sheet JPEGs, counter template SVGs, combat values, printed labels, game phases, map exports, shared CRT and movement data are unchanged.
- `tests/kiev-source-counter-colors-v490.py` performs original sheet SHA and sampled-pixel checks and writes `rules/audit/kiev-counter-color-source-verification-v490.json`.
- `tests/kiev-counter-color-browser-v490.py` renders projected source faces through `core/historical_counter_face_projection.js` and the actual shared `core/counter_visuals.js`, then checks source colors in Chromium. The screenshot is **actual renderer output**, not image generation.

## Qualification

This is a presentation-data correction only. The historical front/reverse rules and separate Kiev experimental-play qualification are unchanged. The next scenario priority remains completing broader Kiev play acceptance and Kiev–Odessa integration, not unifying national palette colors.
