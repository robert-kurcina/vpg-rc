# Checkpoint 206 / v440 — Swamp tile adjustment

After review of v439, the Swamp bitmap was adjusted again to make the requested slate-gray shift more visible in rendered maps.

## Scope

- Open remains `supplied_assets/flat/terrain-open-v439.png`
- Forest remains `supplied_assets/flat/terrain-forest-v439.png`
- Swamp now uses `supplied_assets/flat/terrain-swamp-v440.png`

The original `terrain-swamp.png` file is preserved unchanged.

## Technical change

The shared presentation layer now maps terrain texture variants per terrain kind instead of using one suffix for all recolored tiles. This lets Swamp advance independently without disturbing the accepted Open and Forest variants.

## Validation

- All five campaign maps regenerated successfully.
- Shared presentation texture routing updated.
- Focused export and Kiev movement regressions passed.

This remains a visual experiment and does not alter terrain rules or map data.
