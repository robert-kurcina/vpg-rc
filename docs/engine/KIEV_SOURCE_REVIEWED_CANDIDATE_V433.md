# Checkpoint 199 / v433 — Objective: Kiev isolated, source-pinned movement-geometry candidate

## Outcome

The existing source-audited Objective: Kiev artwork has been converted into a **diagnostic candidate movement board** through the **same generic `source_reviewed_movement_graph.js` builder** already used for The Arduous Beginning. All 165 cells and 442 reciprocal physical edges are represented, including 93 railway connections, 72 ordinary River edges and 10 Major River edges. The 149 hexes with explicit Open/Forest/Swamp SVG symbols retain their terrain. The other 16 cells display user-authored City (15) or Major City (1) overlays; they now have those source-defined types **in the candidate gameplay graph** without asserting nonexistent underlying base symbols or altering rendered Open visual fallbacks.

This checkpoint **does not activate Objective: Kiev as a playable game**. `maps/movement-configs/graph-sources.json` retains `status: "provisional"` for Kiev; `core/map_movement_graph.js` refuses it, as do standard campaign entry points. Kiev–Odessa is likewise gated. The candidate must not be mistaken for a certified setup, a complete campaign, or an approved map export.

## Sources and semantics

- Authoritative source vector: `maps/source/user-svg/kiev-odessa-main.svg`, SHA-256 `2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e`.
- Terrain evidence: `rules/audit/kiev-definitive-terrain-v428.json`, 149 explicit base terrain, and its source pin in `maps/kiev.json`.
- City, River and Major River geometry: `rules/audit/kiev-definitive-city-river-v429.json`, including actual source SVG IDs and ≥90% finite-hexside overlap for each of the 82 classified water sides. Incidental point contacts do not become gameplay rivers.
- Railway source registration: `rules/audit/kiev-rail-reconstruction-v427.json`, source-reconciled 93 connected center/hexside links and zero unresolved geometry crossings.
- `references/rules/kiev-player-aid.webp` Terrain Effects Chart: City and Major City are distinct terrain types; both cost 1 MP; Major City gives a defender combat-column reduction, ordinary City does not. Major River has its own crossing cost and per-unit combat-strength modifier. This is not a claim that base terrain under the city symbol is Open.

The `authoredSourceVectors` field in the old map also retains the SHA of an earlier temporary SVG. For this **candidate only**, the generic builder uses the separately pinned `map.definitiveTerrainAudit.sourceSvgSha256` and verifies all 165 cell source-evidence records. It does not overwrite historical provenance or silently treat the older temporary SVG as definitive.

## Implementation

- `core/source_reviewed_movement_graph.js`: optional, source-agnostic `definitive-city-layer-v1` evidence branch. Checks source SHA, canonical map fingerprint, **additional** city-layer/marker/source-evidence fingerprint, all explicit terrain statuses, exact City/Major City SVG marker IDs, rail registrations and physical edge counts. Ordinary existing source-reviewed graphs use their unchanged default branch.
- `maps/movement-configs/source-reviewed-edge-ledgers.json`: added only one **unactivated** Kiev source ledger. Original Arduous ledger remains unmodified.
- `maps/movement-configs/kiev-source-reviewed-candidate-v433.json`: explicitly `diagnostic-only-not-gameplay` policy, separate from the live graph-source authorization registry.
- `tools/rebuild-kiev-source-reviewed-candidate-v433.js`: deterministic generator/checker from the pinned source SVG and previous independent source audits; run `node tools/rebuild-kiev-source-reviewed-candidate-v433.js` to check, `--write` to rebuild.
- `rules/audit/kiev-source-reviewed-candidate-v433.json`: generated provenance, counts, hash pins and known limitations.
- `tests/kiev-source-reviewed-candidate-v433.test.js`: proof of source and graph match, correct City/Major City interpretation, full enumeration of reciprocal edges, **bidirectional movement-cost adjudication on all 442 hexsides**, insufficient-MP rejection, geometry and city-marker tamper rejection, and confirmation that `MapGraph.build(kiev)` remains blocked.
- Browser historical engine bundle regenerated from the exact authoritative shared modules; no Kiev-specific gameplay renderer or duplicate movement engine.

## Checks

- New: `node tests/kiev-source-reviewed-candidate-v433.test.js` — **2,949 assertions passed**.
- Generator: `node tools/rebuild-kiev-source-reviewed-candidate-v433.js` — SHA and output reproduction passed.
- Existing: 20 related Node suites passed (Kiev source/rails/terrain/rules/CRT, Arduous & Leningrad movement, tooltip UX, source authorization), plus the Kiev terrain and river Python source audits.
- Browser: `python tests/tooltip-pointer-browser-v432.py` — five real Chromium cases passed against the regenerated bundle.
- Package layout: `python tools/check-package-layout-v417.py` — passed.

## Remaining prerequisites for playability

1. Source-certify Kiev's initial German/Soviet setup and reserve/reinforcement inventory; no `maps/setup/kiev.json` exists yet, and the existing roster source is not a committed deployment.
2. Validate buildup, nationality stacking, Soviet concealment, first-turn combat opening and late-turn replacements in the shared campaign, with historical rules and actual browser controls.
3. Approve promotion of the source-reviewed graph from *diagnostic* to *live* **only when the full scenario opening and all required interaction paths are source-backed and tested**.
4. Reconcile and validate the Kiev–Odessa combined map seam/topology separately. The 165-cell candidate is **not** a certification of the expansion.

This is an additive geography qualification. Map JSON, source SVG, exported map PNG/SVG, approved no-drop-shadow renderer, counter assets and the shared Oberlabs B4M CRT remain unchanged.
