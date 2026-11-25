# v292 — Authoritative sea hexes and universal map presentation

Source: `maps/source/user-svg/kiev-odessa-main.svg`, copied verbatim from the revised `kiev-odessa-main(2).svg`.

- The source's Sea layer has 33 `<use>` instances, but two overlapping pairs: 31 distinct hex centers. They are now registered as 31 *new* non-traversable sea cells (261 composite cells: 230 land + 31 sea). Exact source IDs and residuals are in `v292SourceSeaAudit`.
- Sea cells are solid coast-water cyan (`waterColor`) without bitmap textures or sea polygons. No decorative waterBody sea-region polygons are rendered for the authored sea hexes.
- Shared grid rendering excludes all sides belonging to sea cells and land-facing sides adjacent to sea. Both shared-map and independent registration grid paths enforce this.
- Number position offsets: X=-5 px, Y=+5 px. White numeral knockout stroke alpha .25; backplate alpha .25 if enabled.
- Crosses have a 25%-opacity white rectangular backing. Fixed infantry/mechanized/cavalry symbol fills use the Soviet star red `#c83b45`.
- Both faction reinforcement strokes are doubled from 10 px to 20 px in `core/factions.js` (universal setting).
- Generic gameplay engine treats `terrain:sea` as non-playable and disallows placement/movement into sea.
- Source-registered v291 railway polylines and 36 deployments remain unchanged.

Validation: `tests/svg-sea-style-v292.test.js`, `tests/svg-rail-deployments-v291.test.js`, `tests/official-counters.test.js` pass. Shared exporter renders all five maps with zero map validation errors. Earlier v287-v290 era tests and the older all-map verifier retain assertions for superseded Odessa cell counts, coastal edges, and city positions; they are historical tests, not v292 acceptance tests.
