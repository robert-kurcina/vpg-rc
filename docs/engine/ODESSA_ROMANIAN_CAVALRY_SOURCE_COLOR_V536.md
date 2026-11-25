# Checkpoint 302 / v536 — Romanian Cavalry Corps original source field at hex 1010

## Observed defect and photographic evidence

The counter in hex `1010` of the actual combined Kiev–Odessa browser is `kiev-odessa/romanian-cavalry-corps`, nationality `romanian`, current printed-reduced face `odessa-back-r01c01`, original face-pair `odessa-front-r01c08` / `odessa-back-r01c01`, printed `Rom; XXX; cavalry; 3-4`. The screenshot showed a **white** main face with the standard red reduced strip. This was not an intended Romanian palette variation: the `observedFieldColor` was wrongly recorded as `#ffffff` after sampling outside the true light-blue field. The second, duplicate original Romanian cavalry reverse (`odessa-back-r02c01`) was also mistakenly recorded as `#383838`, likely due to a dark printed mark.

The user's original Odessa reverse counter-sheet `assets/official-counters/source-sheets/counters-odessa-back.jpg` is authoritative. Its SHA-256 is `74de9f736f15abd39be33c351df09a977c9cca697ceac281230a7207f78de969` and is unchanged. Uniform, unobstructed field sampling shows:

| Original reverse face | Incorrect metadata | Correct source sample | Original JPG patch (x0,y0,x1,y1) |
|---|---|---|---|
| `odessa-back-r01c01` | `#ffffff` | `#c8d7ee` | `(52,12,65,18)` |
| `odessa-back-r02c01` | `#383838` | `#c5d4e2` | `(55,82,67,88)` |

The replacement colors are the measured median RGB of their respective clean background patches, **not** a national-color guess or a default blue faction override. Both source face records now remain pale blue as actually printed. Only those two `observedFieldColor` entries were changed in each of `maps/counter-configs/odessa-extension.json` and `maps/counter-configs/kiev-odessa-experimental-v531.json`; the same shared Node/browser source projection is used for actual play. The browser engine bundle was rebuilt from the shared modules and verified byte-for-byte unchanged; the original browser already loads the corrected scenario counter configuration at runtime, so no renderer or browser-bundle code changes were needed.

## Damage and rules scope

The existing shared `core/counter_visuals.js` v535 contrast rule is **unchanged**: the printed-reduced Romanian pale-blue counter retains the **red** vertical left status bar; red/salmon source counters still use a **white** status bar. Source counter SVG, original JPEGs, source face IDs, stacking, nationality, combat/reduction rules, movement, CRT, approved terrain/map exports and UX remain unchanged.

## Verified acceptance

- `node tests/odessa-romanian-cavalry-palette-v536.test.js`: **48 assertions** (original JPG hash, source/composite colors and pairing, actual initial unit at hex 1010, projected render face, red stripe)
- `python tests/odessa-romanian-cavalry-palette-browser-v536.py`: **24 assertions** (source JPG pixels + original full shared-engine Chromium page at hex 1010, computed SVG fill `rgb(200, 215, 238)`, red reduction stripe, no JavaScript errors)
- Source photographic evidence: `assets/official-counters/source-sheets/counters-odessa-back.jpg`
- Live shared-engine browser evidence: `rules/audit/visual/odessa-romanian-cavalry-1010-map-context-v536.png` and focused `rules/audit/visual/odessa-romanian-cavalry-1010-browser-v536.png`
- Existing tests retained: v535 204 Node/25 browser, v492 Kiev reduced source 38 Node, v490 original Kiev source 142 Python, v534 source setup 108 Node/54 browser, v524 source starting state 58, v523 source roster 46, and official counter template tests

Unfinished development priorities remain unchanged: seven-turn *contested* multi-turn acceptance, original face-pool choices and concealed mixing, and source-authorized live evacuation. Do not substitute generic nationality colors for source-specific photographed faces.
