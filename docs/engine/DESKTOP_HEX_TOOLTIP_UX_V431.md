# Checkpoint 197 / v431 — desktop hex tooltip UX, certified source hexsides

## Goal and constraints

In a hex-and-counter game, mouse hover is a short reference action, **not** another persistent panel. It must not cover mobile play areas, override click/drag selection, adjudicate a move, change game state, or infer river/rail edges from a visual stroke. Shared rendering/rules remain unchanged and all five games retain one shared engine and B4M CRT.

## Interaction policy

- On a non-touch fine-pointer desktop, a **380 ms dwell** opens a tooltip; transitions to another hex use **190 ms** if a tooltip was open. Moving within the same hex leaves the panel stable and avoids redraw/reposition jitter. Nothing appears on immediate mouse movement.
- Pointerdown, pointercancel, map/document scrolling, wheel, context menu, leaving the map, browser blur, or an inactive tab hide a tooltip and clear its pending timer. Escape also dismisses the tooltip without preventing other game keyboard handling and suppresses repeat hover on the same hex until exit/reentry.
- `pointer-events: none` ensures the tooltip itself cannot intercept counters, map interactions, or hit targets. Position prefers right/below the pointer, falls back left/above, and clamps to the viewport. Presentation uses a compact header, readable line items, labelled effects and a muted disclaimer without relying on color alone.
- `Settings → Map display → Terrain and effects on desktop hover` stays on by default and persists through the existing display-settings storage. No saved-campaign data or renderer geometry changes. Touch pointers and `navigator.maxTouchPoints > 0` disable hover, including emulated iPad. Hybrid machines with nonzero touch points deliberately do not show it, even when a mouse is attached (conservative desktop-only policy).

## Source and rules fidelity

`core/terrain_tooltips.js` remains read-only. Its `describe` function presents the map hostCell ID, city name from source-registered marker where available, source terrain, base entry movement cost from the underlying source terrain (City markers do not silently override it), scenario-configured defending terrain effect expressed as a change to **attacking** odds columns, and extra modifiers labelled with their conditions. Fortification effects are conditional; they are not silently added to the base terrain effect. Ordinary River column shift is conditional on every attacker crossing the river. Major River per-unit reduction is shown only if the source profile explicitly defines `majorRiverAttackMultiplier = 0.5`; `+1 MP off rail` is shown only when configured. Source statuses containing provisional/candidate/unverified flags are identified as such.

The B4M shared-native browser uses its source-authored `cell.tileEdges`. The Arduous and Leningrad browser obtains the **same certified board** via the existing `core/movement_binding.js` (`E.MovementReference` browser export) and translates each verified adjacent edge to **both** directions using `HexTerrainTiles.neighbor` and the original map geometry. Every supplied edge must be verified, source-hex-valid and reciprocal; otherwise the auxiliary tooltip binding fails rather than guess. Authoritative gameplay remains in the source-bound movement adapter; this is only a derived view. Counts from the certified boards:

| Game | Certified rail links | Certified ordinary river links | Certified Major River links |
| --- | ---: | ---: | ---: |
| Arduous Beginning | 85 | 45 | 0 |
| Target: Leningrad | 80 | 69 | 0 |

This is distinct from the number of decorative/visually authored side segments: a drawn river is not automatically a certified crossing. No Kiev topology gate was opened and Kiev–Odessa remains unfinished.

## Acceptance

- `node tests/tooltip-ux-v431.test.js` — 584 source-derived rules, reciprocal geometry and fail-closed checks.
- `node tests/desktop-terrain-effects-v430.test.js` — 14 adapted baseline checks.
- `python tests/tooltip-ux-browser-v431.py` — actual project HTML and shared engine in Chromium (Arduous, Leningrad, B4M), plus touch-emulated iPad. Passed hover delay, stable position, Escape suppress, cancellation, settings, unmodified serialized game state, viewport bounds and zero page errors. Test uses an in-memory source/asset shim (same method as existing browser acceptance) because localhost browsing is blocked in this runner.
- The same browser test uses a **real mouse hover** over Arduous source `0305`, verifies Rail NE/NW and River NE/SE, and saves `rules/audit/visual/arduous-terrain-hexside-hover-v431.png` from the actual game renderer. It is not an image-generated map or mock.
- Selected Kiev Major River, Arduous verified graph, combat, source rivers, counter geometry, movement search and Kiev rail regressions passed. Source map JSONs, ten SVG/PNG exports, shared CRT and artwork have byte-identical SHA-256s to checkpoint 196 input.

### Known limitations

- Static tooltips are a reference aid, not an action-specific movement-cost/combat-result preview. ZOC, weather, counter class, stacking, attack composition, and scenario phase can change legality or outcome.
- Touch devices intentionally do **not** show these floating tooltips. A later mobile-first rule reference can use a non-overlay on-demand panel if needed.
- The existing `scripts/verify-campaign-maps.js` compares current approved exports against a much older v373 no-shadow candidate digest. Its `arduous: unreviewed SVG change` failure is preexisting: checkpoint 196 and this checkpoint have byte-identical Arduous SVG/PNG and manifest; the candidate audit is stale, not a newly generated map change.
- Physical iPad Safari and all possible combined input-mode/hardware combinations are not verified by Chromium emulation.
