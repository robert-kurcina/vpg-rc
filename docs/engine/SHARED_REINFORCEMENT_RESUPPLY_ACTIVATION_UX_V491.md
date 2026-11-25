# Checkpoint 257 / v491 — Reinforcement, resupply and phase-activation map UX

## User decisions

1. Match the Oberlabs convention: show a small circled checkmark in the **upper-right corner of a counter only after it has completed an action in the current phase**.
2. Kiev exterior hex `0301` must show the universal dark-blue German reinforcement border on its top and upper-right hexsides, continuing the existing upper-left segment.
3. During reinforcement placement, highlight **currently legal entry destinations**. Resupply must highlight the hexes containing reduced units that can legally receive replacements. In a stack with two eligible units, target the top counter by default. To repair the other counter, clicking a stacked counter cycles the upper counter; Shift-clicking the hex also cycles the stack. The hex tooltip describes the behavior.

## Architecture

- `core/counter_phase_activation.js` is a shared read-only adapter from authoritative current-phase action records, with no gameplay flag added. `core/counter_visuals.js` draws a small pointer-inert circled checkmark after completed combat/movement/buildup actions. Both the historical browser and the native B4M browser consume it. Unresolved battles/pending moves are not prematurely marked.
- `maps/kiev.json` has the additional `0301:N` and `0301:NE` dark-blue exterior visual edges. The actual Kiev shared-engine SVG/PNG export was regenerated; the existing Kiev–Odessa perimeter already included those edges. Original source SVG, all other map exports and source rules remain unchanged.
- `core/historical_buildup_map_ux.js` is pure, scenario-agnostic projection of the **authoritative human legal-action catalogue**. It neither declares new legal actions nor modifies movement, stacking or replacements. Three non-overlapping modes are provided: reinforcement placement (blue), restoration of reduced on-map units (amber), and rebuilding eliminated units (green).
- The historical controller adds a counter/slot selector and uses actual hex polygons aligned to the shared map. Clicking a highlighted hex invokes the exact corresponding legal action. With two eligible repair targets in a stack, the upper unit is the default; clicking a counter, or Shift-clicking its hex, swaps visual top-of-stack ordering. The source state is not changed by swapping. A hover/title tooltip and persistent mobile guidance describe the repair-target rule.
- `core/native_browser_view.js` also highlights B4M's legal reinforcement and replacement destinations (the historical B4M stacking limit of one remains unchanged). It continues to invoke the normal `WargameSession` action gateway.

## Verified browser transactions

- Objective: Kiev actual Chromium Turn-2 German buildup: two scheduled reinforcement slots, ten source-legal highlighted destinations for the default Slovak slot, alternate Hungarian selection, actual map-click reinforcement placement, phase-activation checkmark and Undo.
- Actual Chromium stacking: an existing multi-counter hex cycles which counter appears on top when a counter or Shift-clicked hex is used. The engine snapshot remains identical.
- Actual Chromium Turn-1 air-supported German Exchange: leaves a Soviet infantry unit reduced. During Turn-2 Soviet buildup its communicating hex `0405` is highlighted amber. Clicking it restores the unit by a real source-legal `apply-replacement` transaction. Undo restores both reduction and highlight.
- `tests/historical-buildup-map-ux-v491.test.js` additionally checks the two-eligible-reduced-counter case, default top-unit selection and reordering, exhausted allowance, excluded targets, multiple reinforcement slots, and independent rebuild mode.

## Limits

The double-eligible resupply case was verified against the pure shared UI projection with a constructed two-counter stack, not through an independently certified historical two-reduced-unit combat position. The browser tests validate stacking input against a real multi-counter position and the full repair transaction against an actual reduced Soviet unit. This distinction is intentional.

The UI stack order is not part of the rules engine or signed campaign save; a fresh browser/session restore derives the display order from the authoritative source-unit list. Saving a game never changes legal units, national stacking or allowances. Prior archived Kiev campaign saves created against a different Kiev map fingerprint correctly require source-matched restoration and are not reclassified as newly passing.

## Acceptance and source preservation

- The original photographed Kiev counter-face source colors, B4M CRT, gameplay rules, all five original source map SVGs, and the three other map exports are protected.
- The Kiev–Odessa composite border path is unchanged; no duplicate reinforcement segments were added.
- No image-generator or web-search artwork is used; verification images are actual shared-engine browser renders.
- Kiev remains an experimental runnable campaign; Kiev–Odessa remains the outstanding non-playable configuration.
