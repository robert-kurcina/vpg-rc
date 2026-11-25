# Checkpoint 317 / v551 — inherited Kiev city source identity and contested recapture

## Cause and scope

The live combined Kiev–Odessa experiment admitted an attack on Kovel (`0502`) as a legal combat declaration, but post-roll discovery threw `Unverified city marker identity`. The authoritative composite cell overrides had replaced 15 inherited Kiev `city` markers without carrying their already source-pinned `sourceSvgId` fields. The `source-typed-v1` shared combat geography correctly refuses such incomplete city evidence. The defect was in map composition, not the combat results table.

The original Kiev map records the IDs, and each original city has unique `sourceTerrainEvidence` (`layer=city`, exactly one `sourceSvgIds[]`, and SHA-256 of the authoritative user SVG). The IDs are present in `maps/source/user-svg/kiev-odessa-main.svg`. The full composite contains 16 inherited Kiev cities and four Odessa cities: 15 of the inherited markers lacked the ID, while the remaining inherited marker was already complete.

## Change

`maps/composer.js` preserves an inherited ID **only** when the old/new city names and marker kinds agree, the source evidence references that exact unique SVG use, the source evidence is a city registration, and its SHA-256 equals the composite's authoritative SVG hash. An inconsistent name, altered SHA-256, or missing evidence cannot authorize an ID. No fallback marker ID is invented and no special-case combat rule is added.

The source-generated `maps/kiev-odessa-composite-experimental-v531.json` was regenerated. A structural audit confirms the **only** cell-data changes are 15 additional verified city marker `sourceSvgId` fields; terrain, hex coordinates, river/rail edges, coastline, territory regions, and city names remain identical. The experimental source-graph registry and source-scope map/ledger digests were updated deliberately, and the shared Chromium CommonJS bundle was rebuilt. Committed-action journals still use the original authoritative engine, and the shared CRT, retreat validator, counter templates, original SVG, photographs, and all five map exports are unchanged.

**Compatibility consequence:** old signed campaign saves from the earlier source fingerprint are not accepted by the new source-gated runtime. This is intentional anti-tamper behavior. The included v551 capture/recapture save was created with the new fingerprint. Existing deployment-editor save compatibility has not been separately requalified for this source update.

## Actual combat qualification

`node tests/odessa-source-city-recapture-v551.test.js --write-audit` — **181 assertions**:

- Validates the 20 original named city SVG identifiers, 15 exact inherited restorations, and the immutable authoritative SVG checksum. Negative tests reject forged hashes, mismatched city names, and a modified map fingerprint.
- Uses the real 261-hex experimental map and source-photographed counter identities, not an injected combat outcome or synthetic starting position.
- Original German infantry `kiev-front-r02c03` at `0402` attacks original one-step Soviet Mechanized Corps `kiev-front-r05c02` at Kovel `0502`. All six committed dice are enumerated using the shared **Battle for Moscow CRT**, producing `DR`, `EX`, `EX`, `NE`, `NE`, `AL` for this particular attack. Every catalogue consequence is executed, Undo-verified, and Save/Restore-replayed.
- For die 2 Exchange (EX), the one-step Mechanized is **eliminated** and the German Infantry is reduced to its original source reverse `3–4`. The attacker may decline advance (Kovel remains Soviet) or advance into Kovel; completing German combat gives Kovel to Germany.
- An original Soviet Infantry Army (`kiev-front-r03c05`) counterattacks the same German defender in Soviet Turn-1 combat. Die 1 gives Defender Retreat (DR); the defender retreats `0502 → 0601 → 0701` and the Army advances into Kovel. Completing Soviet combat returns Kovel to Soviet control, persisting into Turn 2. A forged impossible retreat is rejected without changing game state.

`python3 tests/odessa-source-city-recapture-browser-v551.py` — **45 Chromium assertions** using the genuine browser game, including committed dice through the visible combat control, an Orders-button EX advance, source-rendered map and counters, the approved double-blue retreat-arrow overlay, map arrow selection on the divergent second leg, actual retreat confirmation, two city-control notices, Undo, and authenticated Save/Restore. Captures:

- `rules/audit/visual/odessa-kovel-capture-browser-v551.png`
- `rules/audit/visual/odessa-kovel-soviet-retreat-arrows-v551.png`
- `rules/audit/visual/odessa-kovel-recapture-browser-v551.png`

A reproducible authenticated save is in `rules/audit/saves/odessa-kovel-recapture-browser-v551.json`.

## Regression and limits

Previously verified seven-turn **Node** campaign suites still pass (166 + 166 assertions), as do source graph, opening, setup/mixing, one-step counter gallery, read-only action probe, standalone Kiev recapture, and accepted retreat-style suites. A broader uninterrupted v549-style Chromium campaign reached Turn 3 and Chisinau capture but timed out before Turns 4–7 in this run. That longer browser test is **not claimed as passing** for v551. Its older visual/save fixtures were restored unchanged.

**167 protected source, artwork, map-export, rule, and renderer files are byte-identical to v550.** Source audit: `rules/audit/odessa-source-city-v551-preservation.json`.

The Kiev–Odessa graph remains explicitly experimental. This is not national-territory certification, exhaustive battles or reinforcements under every opening, or live naval evacuation authorization. Work remains on the Romanian/Home Army source territory mask, the source-defined evacuation phase, and additional adversarial combat cases.
