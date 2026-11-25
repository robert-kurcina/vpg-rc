# Checkpoint 195 / v429 — Kiev city terrain and source river-side geometry

## Evidence and result

The source remains `maps/source/user-svg/kiev-odessa-main.svg` (SHA-256 `2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e`). The source-specific player aid `references/rules/kiev-player-aid.webp` distinguishes **City**, **Major City**, **River**, and **Major River** as separate terrain entries. The city category is not an assertion about a concealed Open/Forest/Swamp base layer.

**Cities:** Exactly 16 current Kiev city hexes match unique authored City/MAJOR CITY SVG symbols within 1.5 source pixels of the engine hex center: 15 City and Kiev (`1404`) as the sole Major City. Each now carries its source symbol ID as terrain evidence and as the existing shared `tileMarkers` combat marker. The map's prior Open *visual fallback* is retained, expressly **not** certified as a depicted underlying Open terrain tile. The other 149 source-explicit base-terrain cells retain their v428 classifications.

**Rivers:** The 14 definitive SVG source paths (10 ordinary-river, 4 Major River) were measured against all **442 actual finite internal Kiev hexsides** emitted by the shared renderer, not extended center boundaries. A side enters the diagnostic only when the source path centerline follows at least 90% of that finite side within 1.5 renderer pixels. Results are 72 ordinary-river sides and 10 Major River sides, **82 unique internal sides total**. Source geometry has a clear gap: the remaining incidental contacts have under 10% coverage, not intermediate ambiguous contacts. The original ten provisional scan-based entries are superseded rather than used as a second data registry.

## Authorization limits

This audit certifies SVG-to-hexside **geometric correspondence**, **not playable river combat or movement**. In the published Kiev player aid, an ordinary River costs no extra movement but reduces battle odds if all attackers cross one. A Major River instead adds movement cost (subject to railroad rules) and halves each crossing attacker's combat strength. The current universal `historical_combat_odds.js` / movement graph do not yet represent the major-river strength rule as a distinct, source-authorized edge. **Kiev's movement policy remains provisional** in `maps/movement-configs/graph-sources.json`. No river side in this audit is silently granted gameplay authority.

The Kiev–Odessa composite requires a separate extension-seam and river review. The 93 previously reconstructed internal Kiev railway links remain unchanged. The approved five PNG exports remain bit-for-bit unchanged; Kiev's SVG has only the class/data marker change needed to source-type the Kiev Major City, with no pixel change. No independent engine, renderer, or CRT was created.

## Reproduction

```sh
python tools/reconcile-kiev-city-river-v429.py
python tests/kiev-definitive-city-river-v429.test.py
node tests/kiev-definitive-city-river-v429.test.js
node scripts/export-campaign-maps.js
```

An intentional source change requires review of the SHA pin before running `--write`. The `tests` script also rejects a tampered source and a contradictory city classification. The source overlay `rules/audit/visual/kiev-source-river-hexsides-v429.png` is built from the actual engine-exported PNG with small edge rings; it is diagnostic artwork only.
