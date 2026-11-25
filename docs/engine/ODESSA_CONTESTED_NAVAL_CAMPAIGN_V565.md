# Checkpoint 330 / v565 — contested naval campaign browser acceptance

**Checkpoint 330 / v565 — continuous contested Kiev–Odessa browser campaign with naval operations (DONE, scripted acceptance).** Actual Chromium completed all seven turns with original mixed Soviet identities, selected German infantry, Turn 1 EX, damaged Coastal Army evacuation and Turn 2 return, three Romanian cavalry movements and Chisinau capture, six scheduled reinforcements, terminal evaluation, Undo and exact full journal replay: 201 assertions passed. The first test run correctly rejected an occupied Turn 5 reinforcement destination; the passing run deliberately uses another legal naval return hex. Existing territorial restriction/lifecycle (103), naval phase (65), shared CRT (301) and cross-game phase schedule tests passed; browser bundle verified (59 modules). No production engine, map, rule or artwork changes. P0 remaining: uncertified country labels outside the 19 adjudicated Bessarabia hexes, rare combat branches, and broader adversarial campaign qualification. See `docs/engine/ODESSA_CONTESTED_NAVAL_CAMPAIGN_V565.md`.

## Reproduction

`python tests/odessa-contested-naval-seven-turn-browser-v565.py`

This is a scripted browser campaign, not exhaustive combat or strategic AI certification. The legal return destination deliberately avoids scheduled entry hexes 1601 and 1701. The first run demonstrated that a conflicting scheduled placement is rejected; it did not establish an engine defect. Actual browser evidence and save journal are retained in rules/audit.
