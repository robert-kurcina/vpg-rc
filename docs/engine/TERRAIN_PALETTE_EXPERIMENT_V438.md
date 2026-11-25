# Checkpoint 204 / v438 — Terrain palette experiment

This checkpoint is a **visual-only terrain palette experiment**. It does not alter terrain typing, movement, combat, railways, rivers, cities, setup, counter art, or the shared B4M CRT.

## Requested palette targets

- Open: `#dcd4c9ff`
- Forest: `#727f61ff`
- Swamp: `#616f6fff`

The user supplied `dcd4c9f` for Open; this was normalized to the opaque eight-digit CSS color `#dcd4c9ff`.

## Scope of change

Updated the shared renderer fallback palette in:

- `core/terrain_tiles.js`
- `core/historical_engine_browser_bundle.js`

Then regenerated all five campaign SVG and PNG exports through the existing shared exporter.

## Validation

- `node scripts/export-campaign-maps.js exports --png --width=1800` completed successfully for all five maps.
- No map geometry/export errors were reported.
- The legacy `scripts/verify-campaign-maps.js` PNG-hash guard is expected to fail in this checkpoint because all exported map images intentionally changed appearance.
- Gameplay data and source-reviewed geography were not modified.

## Resulting export SHA-256 values

See `rules/audit/terrain-palette-v438.json` and `exports/manifest.json`.
