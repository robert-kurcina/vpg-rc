# Checkpoint 310 / v544 — Original German 6–4 Infantry reserve-face selection

## Source and limits

- `references/rules/kiev-rules.pdf` §6.0 steps 6–8: one 6–4 German Infantry Corps is assigned to the Game Turn 3 reinforcement track; three German Infantry Corps are initially deployed in Romanian setup hexes, and seven German Infantry Corps plus three Panzer Corps are initially deployed among Polish crosses. All initial German units begin full-strength.
- `references/rules/odessa-rules.pdf` §6.0 steps 6–7 retains the one Turn 3 6–4 German Infantry reinforcement and three initial German infantry in Romania, adding Romanian forces. The Kiev 49 Mtn source face is photographed as a 6–4 `mountain-infantry` face; the shared rule policy already permits both printed infantry kinds in that reinforcement slot.
- The initial experimental sample holds original 29 (source `kiev-front-r01c07`) for Turn 3. Seven deployed 6–4 faces can exchange with it: 30, 34, 52, 54, 55, 51, and 49 Mtn. Three original 8–4 German infantry faces remain in the opening and are **not** eligible to become the Turn 3 reinforcement. This does not authorize source-restricted Polish/Romanian geographic movement outside the already certified setup crosses.

## Implementation

- Scenario data: `games/kiev-odessa/experimental-preview/setup-policy-v534.json` adds the `infantryFaceSelection` profile (source game, source group counts, source face kinds, permitted values, identity and owner constraints). No source counter sheet, map SVG, combat rule, or CRT edits.
- Reusable editor: `core/historical_source_setup_editor.js` validates photographed front/back identities and their original pairings against `maps/counter-configs/kiev-odessa-experimental-v531.json`, verifies opening groups and the original Turn 3 allocation, and exposes `selectInfantryReserve(slot)` and `selectedAllocation()`. It allows the source-approved 6–4 physical counter to be held for Turn 3 while original reserve 29 is deployed in that slot, with **no fabricated unit**. Different choices change the physical source-face identity, not the setup position or army classification. All other starting ground units are unchanged.
- Real campaign handoff: the shared browser uses the same editor for deployment, commits the physical counter identity, and passes the **swapped reinforcement allocation** to the unchanged historical campaign and buildup modules. When source 49 Mtn is selected for Turn 3, the shared engine correctly admits that source face at the scheduled phase.
- UI: a responsive, keyboard-accessible `Turn 3 German infantry reinforcement (6–4)` select inside the real deployment panel. The source photographed 49 Mtn counter is included as a legal option, and 8–4 faces are excluded. The ten Soviet concealed Mechanized identities can still be mixed independently.
- Deployment save version **3** records a nondefault reserve choice and its checksum; unmodified sample saves retain version 2. Legacy version-1 and -2 setups remain readable. A played campaign save embeds the checked setup and an unmodified human action journal. Even self-recomputed checksums cannot authorize an 8–4, Romanian, Soviet, or other unqualified source face.
- No special code for a scenario ID was added to the shared engine. The common source editor consumes configuration constraints and photo face records.

## Verified regression evidence

- `node tests/odessa-german-infantry-face-selection-v544.test.js`: **383** assertions covering every eligible 6–4 source face, photographed paired backs, roster count, starting positions, source Turn 3 allocation, actual campaign creation, Undo, Save/Restore, the Soviet mixing coexistence, original v2 saves, and invalid/source-tampered choices.
- `node tests/odessa-german-infantry-selected-seven-turn-v544.test.js`: **166** assertions of a real contested seven-turn **Node engine** run, beginning with a Turn 1 B4M Exchange, reaching six scheduled reinforcements, admitting **49 Mtn** as the real Turn 3 German arrival, and ending with correct terminal evaluation.
- `python3 tests/odessa-german-infantry-face-selection-browser-v544.py`: **37** actual Chromium checks covering the visible select control, source-photo rendered setup, Soviet Mix interaction, v3 deployment save, invalid load, Turn 1 campaign action, campaign Save/Restore, Undo, and tablet-width controls. Actual map screenshot: `rules/audit/visual/odessa-german-6-4-face-reserve-browser-v544.png`.
- Historical 108-node/54-browser deployment, 155-node/45-browser concealed mixing, and 166-node seven-turn engine regressions are retained and rechecked.

## Still open

- Source-adjudicated country-wide Romanian border/territory restrictions and unresolved 1309/0706 and 11/12 star artwork disagreements.
- Live, source-authorized Soviet naval ground evacuation and return; unusual combat consequence branches; complete seven-turn **Chromium** replay from an actual concealed mixed and face-swapped setup; final historical certification.
- Approved double-blue retreat arrows, current Fleet thumbnail crop, all original photographed counter sheets and map art, and the common B4M CRT remain unchanged.
