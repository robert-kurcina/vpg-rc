# Checkpoint 249 / v483 — Kiev Terrain Effects Chart targeted sample imagery

## Summary

The Kiev Terrain Effects Chart still uses only actual shared-engine Kiev map art, but its sample selection and crop framing are now tuned to show a **single intended feature more clearly per row**.

This corrects the prior issue where some valid sample hexes also displayed distracting neighboring features (for example, city plus nearby river clutter).

## Changes

- Added optional per-row `sampleScale` support to `scripts/build-kiev-terrain-chart-art.py`.
  - The builder now crops a smaller source region for selected rows, then scales it back to the fixed 88×82 chart sample size.
  - This preserves real engine-rendered art and avoids redrawing.
- Updated `maps/presentation/kiev-terrain-effects.json` sample choices:
  - `city` → `1602`
  - `major-river` → `1505`
  - `romanian` → `0910`
- Added targeted crop scales for cluttered rows:
  - `city` → `0.68`
  - `major-city` → `0.68`
  - `deployment` → `0.72`
  - `romanian` → `0.74`
- Regenerated the chart art PNGs in `assets/terrain-chart/kiev/`.

## Result

The chart now better demonstrates the intended feature in each row while remaining grounded in the approved Kiev engine export.

Examples:

- **City** now uses a standalone city hex with no intrinsic tile-edge features.
- **Major River** now uses an isolated Major River exemplar rather than a rail-overlap sample.
- **Romanian setup hex** now uses `0910`, which shows the orange outline and Axis setup marker without rail or city clutter.

## Verification

- `node tests/kiev-terrain-effects-chart-v483.test.js`
  - **148 assertions passed**.
- `python tests/kiev-terrain-effects-chart-browser-v483.py`
  - **22 Chromium checks passed**.

## Scope

No gameplay rules changed.

- The Romanian Turn 1 convention from checkpoint 246 remains unchanged.
- The railway-above-outline rendering rule from checkpoint 248 remains unchanged.
- Kiev still remains gated by provisional movement-graph authorization.
