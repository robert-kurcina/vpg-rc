# Checkpoint 261 / v495 — Kiev–Odessa source-route railway qualification

## Scope

This checkpoint reconstructs **source-traced railway connectivity evidence** from the existing full-composite Kiev–Odessa shared-engine map, using the original user-SVG registered rail polylines. It remains a **read-only candidate**. No change is made to playable-game authorization, historical rules, the common B4M CRT, original SVG, composed map, renderer, game counters, or source railway art.

## Method and falsification criteria

`core/composite_source_rail_audit.js` traces consecutive registered SVG-route points that lie within **3 source pixels** of the grid's source-registered hex centers. It recognizes source-authored off-map rail stubs only at route endpoints; interior points outside the center tolerance are rejected rather than silently discarded. Every accepted consecutive pair must be a **reciprocal physical neighbor** and may not touch Sea or cross any explicitly authored Coast hexside. Repeated source path IDs, invalid points, nonadjacent route segments, and nonreciprocal rail annotations also fail closed.

The trace uses exact registered route points already used by the actual shared-engine renderer, with IDs (`path863`–`path886`) occurring in `maps/source/user-svg/kiev-odessa-main.svg`. This checks geometry; it is not an independent field survey of the railway, and does not mean all combat/movement rules have been verified.

`rules/audit/odessa-source-railway-trace-v495.json` pins the original SVG and both map input SHA-256 hashes, records every rail pair with source path IDs and review coordinates, and is deterministic from the packaged data. It does not register those pairs as executable movement edges.

## Results

| Measure | Result |
| --- | ---: |
| Source-registered railway paths | 24 |
| Path vertices | 156 |
| Vertices matched to centers | 141 |
| Permitted source endpoint stubs | 15 |
| Distinct traced railway connections | **117** |
| Existing reciprocal rail annotations | 42 |
| Traced edges corroborated by annotation | 40 |
| Traced edges missing from annotations | **77** |
| Annotations without a matching source-traced route | **2** |
| Rail source links crossing Sea or Coast | **0** |

Two existing annotated hexsides lack a matching path trace:

- `1106:1107`
- `1106:1205`

The registered route geometry instead contains `1106:1206` and `1206:1107`, and separately `1206:1205`. Those two mismatches must be reviewed before a rail-link ledger can be approved. The incomplete 42-side annotation list must **not** be treated as the entire railway network. Conversely, missing annotations are not grounds to invent new source paths; the 117 connections are independently traced from the already-registered actual source paths.

## Browser review

The existing `tools/odessa-movement-review/index.html` now offers two additional modes, displayed over the **unchanged engine-rendered** Kiev–Odessa PNG:

- **Source-traced railway links (117)**: links to actual source path IDs, showing whether each edge already had a matching side annotation.
- **Unmatched rail annotations (2)**: those two hexside cases listed for explicit review; never presumed legal.

The original seam and impassable-Coast review modes remain available, and the original 100 Sea/Coast blocked connections remain unchanged.

## Acceptance and limitations

- New source audit: `node tests/odessa-source-railway-v495.test.js` — **640 assertions**.
- New actual Chromium review: `python tests/odessa-source-rail-browser-v495.py` — **21 checks**.
- Existing `node tests/odessa-composite-candidate-v493.test.js` — **2,231 assertions**.
- Kiev production graph, Romanian Turn 1, and reinforcement-border focused regressions passed.

**Still blocked:** Kiev–Odessa playable campaign setup, source-certified railway reconciliation, Odessa-specific Fleet/port/cavalry/combat/victory rules, and a complete campaign acceptance run. The historical five-map shared renderer, source map assets, shared CRT, and established impassable Sea/Coast semantics must be preserved.
