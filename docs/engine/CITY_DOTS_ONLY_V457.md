# Checkpoint 223 / v457 — remove the thick City-hex outline

The heavy solid black perimeter introduced at v454 has been removed. The user-approved **24 symmetric black dots** per City hex introduced at v456 remain at precisely the same locations: six vertices, six side midpoints, and twelve quarter points.

The **ordinary grid lines** remain unchanged. In the shared engine, `cityBorderMarkup` now emits only the 24 circles per City, and the separate `cityBorderSolidWidth` presentation setting has been retired. The optional `supplied_assets/flat/city-hex-highlight.svg` has the same dot-only treatment. The browser engine bundle was rebuilt from source, not patched by hand.

## Exact map comparison against v456

The five generated SVGs are exactly identical to v456 after stripping the 73 extra `<polygon class="city-hex-border" …/>` elements from the v456 SVGs. The **1,752 city-dot `<circle>` elements** are byte-for-byte identical; all other SVG content and map geometry are identical. The five PNG maps have been exported from the actual shared engine.

## Validation

`node tests/city-dots-only-v457.test.js` validates each of the 24 positions per City, including the geometric quarter and midpoint constraints. Scenario rules, the shared B4M CRT, counters, map source records, rail/river paths, and reinforcements are unchanged. Arduous German captured-city replacement remains the active gameplay test. The optional Battle for Moscow stacking variant remains second-to-last priority; unified campaign exploration remains last.
