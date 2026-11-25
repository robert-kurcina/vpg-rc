# v535 / Checkpoint 301 — white reduction stripe on red counters

## Request and implementation

The authored vertical left-edge `status_reduced` shape was visually difficult to distinguish when rendered red against a red counter. Shared `core/counter_visuals.js` now selects a white `#ffffff` stripe for a red-family **visible counter face** (including scarlet and salmon historical source colors). All non-red counter fields retain the original source-red `#ff0000` stripe. Full/untried counters still hide the stripe; reduced/damaged status is still determined solely by the original unit data.

`core/official_counter_templates.js` is regenerated from the **unchanged source SVG** using `scripts/import-official-counters.py`. The importer makes only the stripe's fill a named substitution (`@@color_reduced_bar@@`); its exact original path geometry, position, 50×50 proportions, and all other template styles match v534. This works for all five shared templates (army-2, army-3, air, stuka, fleet) without scenario-specific renderer branches or a second damage-rule implementation. If source colors require an exception, `counter.colors.reducedBar` can explicitly override the presentation fill.

**No counter step-loss rules, source-counter face pairings, CRT, map geometry, exports, unit identities, or scenario state were modified.** Original source counter sheets remain intact and retain their verified SHA-256.

## Verification

- `node tests/red-counter-damage-bar-v535.test.js`: 204 assertions, five templates, source red/ochre/green/blue/brown/violet cases, hidden full-state stripe, explicit override, and original Kiev front/reverse face matching.
- `python tests/red-counter-damage-bar-browser-v535.py`: 25 Chromium assertions for actual shared official SVG counter rendering, computed SVG fill/visibility and photographed/source-transcribed Kiev field colors. Evidence: `rules/audit/visual/shared-counter-red-damage-white-bar-v535.png` (browser renderer screenshot, not generated art).
- Existing `node tests/official-counters.test.js` and `node tests/kiev-counter-damage-and-buildup-visual-v492.test.js` pass; Kiev palette Chromium passes 19 checks.
- Kiev–Odessa v534 source-constrained setup editor: 108 Node assertions and 54 live Chromium assertions pass unchanged.
- Byte-for-byte template comparison against checkpoint 300 confirms that the only change in each of the five imported SVG templates is replacing `fill:#ff0000` on the reduced-state bar with `fill:@@color_reduced_bar@@`.

## Limitations and remaining work

Red-family is a strictly presentation-only hue classification of the **displayed source field**, not player nationality. It deliberately retains red stripes on ochre and neutral backgrounds; user-authored source palettes outside these recognized shades can be overridden per counter. The existing Kiev–Odessa contested seven-turn acceptance, face-pool selection, concealed mixing, and naval authorization work remains incomplete and unaffected by this change.
