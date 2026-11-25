# Checkpoint 272 / v506 — TEC single-hex engine specimens

The Kiev / Kiev–Odessa Terrain Effects Chart no longer uses clipped crops from the
full exported map PNGs. Each sample image is now rendered as a **single isolated
hex** through the **same shared game engine** used by the historical maps.

## Why this change

The prior crop-based chart specimens had several presentation defects:

- clipped hex outlines and inconsistent framing,
- river / major-river examples that did not clearly show full stroke width,
- a `Star / Cross` sample that showed only the Soviet star,
- a Romanian specimen that could hide the orange inset outline,
- unnecessary in-hex coordinate numbers and City / Major City text labels.

## What the new specimen pipeline does

For each TEC row, the build now creates a one-hex synthetic board and renders it
through `core/terrain_tiles.js` + `core/presentation.js` using the same approved
terrain textures, city-border artwork, marker glyphs and territorial outline
styles as the full map engine.

This keeps the chart grounded in the real engine while avoiding crop artefacts.

## Resulting specimen conventions

- `Open`, `Forest`, `Swamp`: plain terrain-only engine renders.
- `City`, `Major City`: city marker / city hex emphasis without city-name text.
- `River`, `Major River`: unclipped single-side examples showing full thickness.
- `Railway / Railroad`: a clean rail exemplar.
- `Star / Cross`: both deployment markers shown together in one hex.
- `Romania / Romanian setup`: plain open hex with the orange inset dashed border.
- `Bessarabia (mauve)`: plain open hex with the mauve inset dashed border.

## Scope

This is a **presentation-only TEC improvement**. No gameplay rules, movement
ledgers, region assignments, CRT logic, or map geometry were changed. Kiev–Odessa
remains non-playable pending other source-certified work.
