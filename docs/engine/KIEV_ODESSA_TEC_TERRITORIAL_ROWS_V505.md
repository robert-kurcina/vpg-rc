# Checkpoint 271 / v505 — Terrain Effects Chart: Romania + Bessarabia

## Scope and user direction

The user requested a new mauve Bessarabia Terrain Effects Chart (TEC) entry, and for both Bessarabia and Romania territorial rows to be **the final two rows** of the chart. This checkpoint changes only the Kiev/Kiev–Odessa rule-reference presentation and specimen generation, not gameplay, map features, regional membership, or the shared engine.

## Evidence and semantic scope

- `references/rules/kiev-rules.pdf` §10.8: original Turn 1 combat restriction for four orange-marked Romanian setup hexes, `0709`, `0809`, `0910`, `1010`, and three Soviet eligible original positions `0708`, `0808`, `1110`.
- `references/rules/odessa-rules.pdf` §9.4.4: Romanian Home Army is restricted to Romania until Bessarabia is emptied of Soviet units. When that happens, Bessarabia is annexed and Home Army access to it persists after later Soviet re-entry. The Home Army may attack but may not Advance After Combat across the Russo-Romanian border.
- `references/rules/odessa-rules.pdf` §9.4.5: Hungarian units may never enter Romania or Bessarabia, in addition to the existing Romanian/Hungarian stacking exclusion inherited from Kiev §8.1.
- `maps/registry.json`/`maps/odessa-extension.json`: the mauve setup-region display uses exactly 19 user-adjudicated Bessarabian host cells. The orange Kiev markers are *four original starting hexes*, **not** the complete Romania territory boundary.

**Important:** The original chart was Kiev-specific. This is a source-scoped *Odessa supplement* to the Kiev TEC. The base Kiev gameplay status and historical four-hex combat rule are preserved separately from Odessa-only movement rules. Orange and mauve outlines do **not** supersede land, water, rail, river, swamp, or forest TEC rules; they add neither a new terrain cost nor a combat odds shift. The remaining political region classification is still incomplete and the combined campaign remains non-playable.

## Implemented presentation

- The 9 existing base terrain/feature rows remain in their original order.
- Penultimate row: orange `Romania / Romanian setup`, explicitly separating Kiev §10.8 and Odessa §§9.4.4–9.4.5.
- Final row: mauve `Bessarabia (mauve)`, listing the annexation trigger, persistent Home Army expansion, Hungarian prohibition, combat boundary consequence, and underlying terrain precedence.
- A new `sampleMap: "kiev-odessa"` field allows the same chart to show a source-derived Bessarabian hex crop from the genuine shared-engine `exports/kiev-odessa.png` instead of inventing an icon. The sample is `hostCell 1212`; the mauve outline is visible in the 88×82 PNG. Existing Kiev samples remain Kiev-derived.
- Distinct responsive orange/mauve border markers appear on desktop and mobile; navigation from the shared map viewer identifies the Kiev + Odessa scope.
- The specimen crop builder now avoids changing accepted PNG bytes when the actual pixels have not changed, preventing no-op compressor drift.

## Verification

- `node tests/kiev-odessa-tec-territory-v505.test.js`
- `python3 tests/kiev-odessa-tec-browser-v505.py` (actual Chromium TEC rendering, desktop and 390px mobile)
- `python3 scripts/build-kiev-terrain-chart-art.py` (actual engine-export specimen, idempotent)
- `python3 tests/checkpoint-package-v505.py <archive>` (against checkpoint 270)

The only authorized modifications to existing archive contents are chart JSON, HTML, crop script, map-viewer TEC link label, and the three planning/status documents. The new specimen, tests, source audit, and technical note are additional files. All five SVG/PNG map exports, the original scan/SVG/PDF sources, game configs, movement code, shared CRT, and main browser engine bundle remain byte-identical to checkpoint 270.
