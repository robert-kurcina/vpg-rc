# Shared SVG interaction guardrails — Checkpoint 38

All historical scenarios use the same `core/counter_visuals.js` and
`core/terrain_tiles.js` rendering paths. The author-supplied SVG artwork,
geometry, colors, NATO markings and source files remain unchanged.

- Each counter has a transparent **50 × 50 unit-space rectangle** with
  `data-interaction="counter-body"`, after the artwork and before the
  selection frame. Its parent `data-unit-id` dispatches the existing unit
  selection action; sub-artwork, glyphs and labels are not selectable or hit
  targets. Stack ordering and Shift-click logic remain with the existing app.
- Each hex terrain polygon has `data-interaction="hex-body"`. Map annotation,
  city lettering, grid, coastline, rivers and other overlays are not hit
  targets. Generic game click handlers accept only hex-body targets, so
  clicking through a label reaches the hex below.
- `core/svg_interaction.css` is imported by the generic playable browser and
  Battle for Moscow. Browser SVG text and artwork cannot be selected.
  The generated standalone map and counter SVG roots also contain native
  `user-select:none` styling.
- The original Oberlabs-compatible B4M browser uses canvas input with SVG
  *presentation-only* underlays. Its SVGs remain pointer-transparent; the
  canvas input is unchanged.
- Test: `python tests/svg-interaction-guardrails-v317.py` uses actual renderer
  markup in Chromium and checks event targets, non-selection and click through.
  This is a renderer fixture test, not full game-browser user-action parity.

Do not use SVG children such as text, NATO paths or terrain overlays for
selection. Do not add full-map transparent overlays above counters; such
an overlay would intercept counter clicks.
