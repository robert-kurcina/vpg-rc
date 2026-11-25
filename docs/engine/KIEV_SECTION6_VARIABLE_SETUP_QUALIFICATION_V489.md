# Checkpoint 255 / v489 — Objective: Kiev §6 variable setup qualification

## Corrected acceptance question

The original supplied *Objective: Kiev Draft Rules v1.0*, printed p. 2, §6.0 steps 2–9, describes **player-controlled deployment decisions**, not a single, predetermined counter-ID-to-hex historical starting allocation. Earlier checkpoint wording implying that one historically exact initial allocation must be recovered before Kiev can progress is therefore too strict and unsupported by this source.

Step 2 requires shuffling ten concealed Soviet Mechanized Corps. Step 3 fixes six *positions by type* (two Soviet Armies and four concealed Corps) but not which individual photographed IDs occupy them. Step 4 requires four Soviet Armies and six Mechanized Corps on ten front-line stars, with Armies nonadjacent. Steps 7 and 8 require three German infantry plus one Romanian in four Romanian crosses, and seven German infantry plus three Panzer in seven Polish crosses, with one unit at each and one extra unit at three Polish crosses. The source says where groups deploy; it does **not** mandate a single canonical original face identity per permitted position.

Source: `references/rules/kiev-rules.pdf` p. 2, PDF SHA-256 `d55e8f0e567d1f8c7907c4fc8368954ec0e5fa8d6fe9e8e71c61acf9bb3c3756`.

## Implemented

- Updated `maps/setup/kiev.json` status and historical notes to acknowledge §6 player choice while explicitly retaining separate experimental map/gameplay limits; the generic `historicalSetupAuthorized` flag remains false, since a unique historical position cannot be established by §6 alone.
- Rebuilt the **same authoritative browser-engine bundle** from unchanged shared sources plus revised setup metadata. No separate Kiev engine or rule path.
- Clarified the Kiev player's setup screen: the supplied 30-counter position is a **rules-legal illustrative preset**, not a compulsory historical opening. Players may select alternative rule-conforming positions, shuffle the concealed Corps, and begin the experimental campaign.
- Added `tests/kiev-rulebook-setup-qualification-v489.test.js`: exhaustive positional *class* checks of 24 Romanian permutations, 35 Polish choices of doubled crosses, and 210 Soviet 4-Army combinations, using the authoritative shared setup validator. Of the Soviet arrangements, 61 are allowed and 149 rejected due to Army separation. The test also verifies rejection of wrong-region, unoccupied marker, missing unit and over-occupancy cases, and creation of a real alternative source deployment (271 assertions).
- Added `tests/kiev-variable-setup-browser-v489.py`: an authentic Chromium run of the shipped human/deployment controller with the approved shared-engine map and counters, demonstrating alternate Romanian, Polish and Soviet placements, invalid-action atomicity, concealed mixing, Turn-1 activation and save/restore (26 checks).

## What this qualifies and does not qualify

**Qualified:** The source-identified §6 placement mechanism supports different legal, player-chosen configurations rather than one supposedly missing historical order. The fixed hex classes, counter groups, non-adjacency and required concealed mixing are exercised. An alternative setup can enter the real experimental Kiev campaign.

**Not claimed:** Historical precision of all printed-coordinate associations, all possible substitute counter identities, strategic AI, general combat-branch exhaustion, a uniquely correct historical arrangement, or Kiev–Odessa playability. Kiev remains explicitly experimental. Source-map and counter artwork, all five exported engine maps, historical rulebook, the common B4M CRT and other scenario configs are unchanged.

## Reproduction

From the packaged project root:

```bash
node tests/kiev-rulebook-setup-qualification-v489.test.js
python tests/kiev-variable-setup-browser-v489.py
```

Evidence: `rules/audit/kiev-rulebook-setup-qualification-v489.json`, `rules/audit/visual/kiev-variable-setup-browser-v489.png` (actual engine/browser render).
