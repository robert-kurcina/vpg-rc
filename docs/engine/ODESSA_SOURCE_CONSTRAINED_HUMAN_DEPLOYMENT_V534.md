# Checkpoint 300 / v534 — Kiev–Odessa source-constrained human starting deployment

## Implemented

The existing historical browser now exposes **Return to deployment** before any committed game action. It opens an interactive, real-map editor with original photographed counter vectors and a live source-legal destination outline. A player can select a ground counter, choose a legal empty hex, or exchange the positions of two deployed counters; mouse, touch-style click and keyboard-activated source counters share the same atomic editor. The edited position becomes the **ordinary shared campaign opening** on **Begin Turn 1**. No game-specific alternative combat, movement, reinforcement, or campaign controller was created.

- The original **36 source ground identities + separate, fixed Black Sea Fleet** are preserved. Every starting source face and its reverse pairing are inherited, rather than recreated or resampled.
- The source-approved **11 of 12 Soviet frontline star selection** is now a playable choice; the user-approved `1111` remains a source-listed star. The UI shows the unused star. Soviet Armies cannot begin adjacent to another friendly Army, including the fixed/rear/coastal ones.
- All seven Polish starting infantry crosses must be occupied by one infantry each, with three Panzer Corps in three distinct authorized crosses and no illegal three-counter stack. Four Romanian-approved initial crosses can host the three German and four Romanian starting units, subject to the two-unit/one-Army stack ceiling. These four crosses **do not certify the political territory** used later for movement rules.
- Fixed Soviet rear units preserve the **printed `1309` mechanized position**, despite the uncorrected source-art discrepancy at `0706`. Soviet coastal Army and Fleet remain at Odessa `1513`.
- A source-bound scenario configuration declares the regions, groups, distinct-hex requirements, adjacency restriction, support marker and an immutable SHA-256 opening fingerprint. The new **scenario-agnostic** `core/historical_source_setup_editor.js` interprets those constraints, validates *every candidate move/swap*, and changes only `hex`/`openingHex` in a cloned pre-game state.
- Deployment-only JSON saves and combined deployment+campaign journals carry a checksum and undergo independent setup-rule validation on load. Invalid saves or moves leave the live setup/game unchanged. Original plain historical human saves still restore against the original candidate opening, and Undo still uses the existing journal.
- Starting the editor switches to the Play tab and hides the non-actionable Air/Fleet Support window, restoring it automatically on beginning combat. This preserves a usable desktop and tablet map while deploying.
- Existing shareable browser controls and approved combined map/counter artwork are retained. All exported source maps, terrain tiles, printed counter art, CRT and in-game phase/rules data remain unchanged.

## Verification

- `node tests/odessa-source-setup-editor-v534.test.js` — **108 assertions**, including source fingerprint, lawful ground placement and source-face preservation, Navy/Fleet separation, 11-of-12 stars, forbidden stacking and adjacency, country setup restrictions, atomic rollback, save/restore, and hostile save-payload changes.
- `python tests/odessa-source-setup-browser-v534.py` — **54 Chromium assertions**: actual setup controls and shared-map clicks, highlighted legal destinations, source-denied moves, Panzer swaps, original counters rendered, deployment save/restore, real UI **Begin Turn 1**, combat choice/Undo, full custom game save/restore, rejection of mid-game redeployment, and pre-v534 save compatibility. Screenshot `rules/audit/visual/odessa-source-constrained-deployment-browser-v534.png` is captured from the actual Chromium shared game UI.
- Current v533 Turn 2 Chromium: **47 assertions**; v532 Turn 1 Chromium: **30 assertions** (changed old screenshots to viewport captures to avoid full-page capture overhead); v531 original browser opening: **44 assertions**. New v534 code does not modify their game rules.
- Additional shared-engine/source regressions: v531 original opening (82), v531 movement (56), v532 Soviet first-turn buildup (36), v533 source buildup (50), v533 seven-turn *no-combat* phase continuity (21 checks/82 actions), v522 setup preflight (49), v525 Romania subset (56), and v521 Odessa victory evaluator (4,814).

## Critical limits / still P0

1. This is **source-constrained position editing**, not a complete free selection of all original starting **counter faces**. It retains the audited 36 starting ground identities; changing the three Romanian-region German infantry *source-face selection* from the broader original Kiev pool is not implemented. The original ten concealed Mechanized Corps are not newly randomized or mixed by the Kiev–Odessa editor; their displayed face state remains unchanged. The fixed Fleet is not a movable ground setup counter.
2. The browser is **experimentally playable in tested phases**, not historical setup or full campaign certified. Romanian political boundaries, the 12 drawn stars versus 11 permitted units, rear decorative marker mismatch, and other published-source ambiguities remain explicitly visible or fail closed where they affect unverified movement.
3. A complete **seven-turn contested Chromium session**, later-turn arrivals, naval evacuation timing and endgame communication acceptance remain unverified. The 82-action test is **no-combat** and cannot substitute for battle, losses, cross-seam movement, city capture and naval action coverage.
4. The source SHA-256 checksum protects against accidental mismatch/corruption but is not a remote adversarial anti-cheat system; the user controls local browser files.

## Next priority

Verify original Kiev Turn 3, Turn 5 and Turn 6 reinforcements and one **real multi-turn contested Chromium** path from this editable opening, with recorded combat, losses, a Kiev–Odessa seam move, Undo/save and a city-control transition. Keep naval evacuation disabled until its phase authorization is tied to an actual printed rule interpretation. Avoid revisiting the settled Kiev `1201`–`1202` railway.
