# Checkpoint 312 / v546 — Support cards rendered by the source-derived SVG counter engine

## Diagnosis

The user-observed thin vertical lines bordering FK V and Romanian Air Corps Support thumbnails were printed counter-sheet grid/crop edges, not part of individual counters. The old Support Window in `core/support_window.js` displayed `<img>` elements sourced from 22 cropped counter-sheet PNGs; the browser's broader game was real, but these Support counters did **not** use the shared `WargameCounterVisuals.piece()` vector renderer. The previous v542 Fleet crop adjustment only worked around this for two front Fleet thumbnails.

## Correction

- `core/support_counter_vectors.js` now projects original, source-configured special counter faces (`air-support`, `air-marker`, `naval-marker`) through the identical `WargameCounterVisuals.piece()` engine and its exact compiled templates from `assets/official-counters/source-counters.svg`. The supported vector templates are `air`, two-aircraft `stuka`, and `fleet`.
- `core/historical_browser_app.js` supplies exact original source face IDs and printed transcription data for front/reverse; Support Window displays only the resulting generated SVG. No Support `<img>` or generated PNG bundle loads in the four current historical preview pages. Each `<svg>` exposes `data-source-face-id` and `data-vector-template` for diagnostics.
- Printed `FK I`, `FK VIII`, `FK IV`, `FK V`, `Rom I AK`, `Baltic Sea`, and `Black Sea`, as well as their value arrows, come from original counter-face transcriptions; the source-specific photographed face colors are retained. The Romanian REFIT reverse has source-based REFIT lettering over the standard SVG aircraft template; damaged Fleet reverse uses the existing `fleet` template's DAMAGED geometry. This is SVG/template reconstruction, **not** a claim of exact photographic pixel reproduction.
- Three source **visual** color transcription corrections avoid fields erroneously sampled from a black aircraft or sheet edge: `leningrad-front-r04c05` green `#8ba396`, two duplicated Odessa front Fleet faces red `#e5454d`. They are recorded in the per-face `supportVectorFieldColor` attribute. The previous observed sample is retained for provenance. This field is *presentation-only* and does not affect combat, nationality, or stacking.
- The source-sheet JPGs and derived PNG crops are retained for provenance only; they are no longer used by active Support panels. Old versioned tests that specifically assert bitmap embedding/crop URLs are obsolete; the v546 SVG tests replace that contract. Existing Support-targeting player interactions are unchanged.

## Verification

| Qualification | Outcome |
| --- | --- |
| `tests/support-counter-vector-v546.test.js` | 229 Node assertions, 34 original special faces across source configurations |
| `tests/support-counter-vector-browser-v546.py` | 37 Chromium assertions, including Leningrad, Arduous, Kiev, Kiev–Odessa, and iPad Support dock |
| `tests/support-target-map-browser-v514.py` | 78 Chromium assertions; legal targeting, confirmation, Undo/Save/Restore remain valid |
| `tests/odessa-mixed-selected-replay-v545.test.js` | 98 Node assertions; unchanged mixed/selected seven-turn journal |
| `tests/odessa-mixed-selected-browser-stages-v545.py` | 81 Chromium assertions; five authenticated saves, Turn 3 and Turn 6 Orders/Undo |
| `tests/odessa-concealed-source-mix-v543.test.js` | 155 Node assertions |
| `tests/historical-retreat-map-v538.test.js` | 18 Node assertions |
| `tests/odessa-retreat-blue-style-v541.test.js` | 12 Node style assertions |

Actual Chromium screenshots:

- `rules/audit/visual/leningrad-support-original-svg-browser-v546.png`
- `rules/audit/visual/odessa-support-original-svg-browser-v546.png`
- `rules/audit/visual/odessa-support-original-svg-tablet-v546.png`

## Boundaries

This is a shared UI presentation correction. It does not update the original source counter SVG, photographic counter sheets, ground counter art, map geometry, CRT, combat rules, Fleet action authority, deployment rules, or approved double-blue retreat arrows. The previously noted uninterrupted mixed-start seven-turn browser performance limitation and Odessa naval evacuation phase authority remain unresolved.
