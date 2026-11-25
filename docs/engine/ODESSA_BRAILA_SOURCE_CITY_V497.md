# Checkpoint 263 / v497 — Brăila city name and source-qualified Odessa city preflight

## Source and spelling

The original Objective: Odessa rulebook (§5) names the Romanian city as Braila, and the supplied composite source map marks the relevant city. The user directed use of the correct modern Romanian spelling **Brăila**. The authoritative **active game label**, `maps/odessa-extension.json` City marker and `city.name` at hostCell `1016`, candidate victory ledger, initial Axis control, and diagnostic tests now use `Brăila`. Original map scans, source SVG geometry, printed references, and historical audit snapshots remain unmodified; the old `Balti` adjudication survives only as historical provenance.

## Game checks

- Source-city ledger: 20 distinct registered cities, including Brăila (`1016`), Odessa (`1513`) and Nikolaev (`1811`).
- Source initial Axis cities: Lublin, Iasi, **Brăila**.
- Qualified victory evaluator applies the printed thresholds with conditional isolation explicitly **undetermined** until separately certified.
- Diagnostic land graph identifies 261 hexes, 714 physical connections, 100 impassable Sea/Coast crossings, 117 source railway links, 105 ordinary River and 22 Major River connections. It is **not** promoted for production gameplay.
- Historic source-ledger checksum was re-pinned to the updated source configuration; source coastline, railway routes, counters, rules, CRT and all four other game map exports remain unchanged.

## Tests

- `node tests/odessa-source-city-victory-v497.test.js`: 135 assertions.
- `node tests/odessa-source-land-city-graph-v497.test.js`: 1,785 assertions.
- `python tests/odessa-source-city-browser-v497.py`: 13 actual Chromium checks.
- Prior v493, v495, v496 source topology/rail tests pass with exact source pins after the naming-only amendment.

The source image and PDF files are not edited. The gameplay gate for the Kiev–Odessa expansion remains closed pending its separate historical movement, Fleet, cavalry, reinforcement, and victory-isolation acceptance.
