# v291 — Exact SVG rail polylines and deployment geometry

Authoritative input: `maps/source/user-svg/kiev-odessa-main.svg` (the user's revised `(1)` SVG). The full source SHA256 and each imported instance are recorded in `maps/odessa-extension.json` (`v291SourceImportAudit`).

- Replaces 24 Kiev–Odessa railway routes with exact source vertex polylines (156 registered vertices). The existing shared JavaScript railway drawer still draws track, halo and ties. **Only** the authoritative composite suppresses cubic curve interpolation; all other game maps retain their established railway presentation.
- Removes obsolete composite railway perimeter/port connectors and suppressed center adjacency drawing, which were not grounded in the new SVG.
- Replaces all previous Kiev–Odessa deployment markers from the SVG's 36 `<use>` elements: German crosses 14, Soviet stars 14, fixed mechanized 4, fixed infantry 3, fixed cavalry 1. Symbol definitions map to existing universal engine glyphs; positions snap to the calibrated host hex centers. Maximum imported symbol center discrepancy: 2.611 engine px.
- Preserves existing city names, textures, rivers, coast, entry borders, and standard number placement, without adding an SVG-only renderer.
- `tests/svg-rail-deployments-v291.test.js` validates all 24 railways are polyline-rendered, all 36 deployment source identities are present, no legacy rail exit is composited, and the existing shared renderer remains operative.

These are **visual railway routes**. They are not automatically certified movement/rail transport connectivity rules. No rule-data edges were fabricated.
