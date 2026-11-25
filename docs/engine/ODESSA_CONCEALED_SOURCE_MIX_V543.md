# Checkpoint 309 / v543 — Kiev–Odessa source-constrained concealed Soviet Mechanized Corps mix

## Original printed source and scope

`references/rules/kiev-rules.pdf` §6.0 step 2 instructs the player to turn all ten Soviet Mechanized Corps onto their untried fronts and mix them, without revealing strength. `references/rules/odessa-rules.pdf` §6.0 inherits Kiev setup with expansion additions: four of the untried Soviet Mechanized Corps begin at fixed source-approved rear positions, and six are placed on frontline stars with the other Soviet ground forces. This revision implements only the concealed ten-counter identity shuffle, **not** alternative German initial infantry or scheduled reinforcement pool substitutions.

## Implementation

- `games/kiev-odessa/experimental-preview/setup-policy-v534.json` configures one `concealedMix` group including `sovietFrontMechanized` and `sovietFixedMechanized`, exactly ten original Soviet Mechanized Corps. The generic `core/historical_source_setup_editor.js` accepts only bijections of this set.
- The shared historical browser `core/historical_browser_app.js` presents **Mix 10 concealed Corps** / **Remix 10 concealed Corps** in the actual interactive editor. It uses `crypto.getRandomValues` Fisher–Yates and unbiased rejection sampling; the browser does not invent new counter identities or alter source artwork.
- The editor tracks **slot-to-source-face** permutation separately from approved hex placements. Before commitment, source-approved unit slots retain their setup-region constraints and all ten visible photo fronts remain untried. At campaign commit, the actual unit IDs are the physical source-face IDs and keep their original reverse-face pair, strength status and photographed identity. Every recorded `openingHex` matches its physical opening position.
- New editor save version **2** carries `identityAssignments` and `concealedMixed` in its checked payload; older version-1 editor saves restore as the original unmixed setup. The integrity checksum is not an adversarial secrecy mechanism; ordinary players are not assumed to inspect local memory or game saves.
- An unchanged original sample campaign may still begin without mixing for backwards-compatible experimental play. The UI identifies it as **unmixed sample identity order**, not source-compliant concealed setup. Mixing is optional for the current experimental preview; it should be required for later historical-certification mode.
- The normal shared `Campaign` and `Human` modules handle mixed game starts, post-start actions, saved sessions, replay and Undo. No second controller or scenario-dependent rendering code.

## Verification

- `node tests/odessa-concealed-source-mix-v543.test.js`: **155** assertions, including all ten source faces, print pairing, actual source ID re-keying, fixed/rear identity exchange, legal later placement, deterministic save, forged/duplicate/foreign-face rejection, version-1 compatibility, actual Turn-1 campaign action/Undo and replay.
- `python3 tests/odessa-concealed-source-mix-browser-v543.py`: **45** assertions using the real shared map, source-photo SVG counters, displayed Mix button, render, v2 save/load, tamper rejection, live campaign, Undo and Save/Restore.
- Preserved passing suites: v534 editor **108 Node** and **54 Chromium**, v537 seven-turn contested **166 Node**, v541 retreat two-tone CSS **12** assertions. v541 broader contested seam/capture regression timed out and is **unverified** for this revision.
- Browser screenshot: `rules/audit/visual/odessa-concealed-10-corps-mix-browser-v543.png` (actual browser, no generated map or UI mockup).

## Remaining P0 work

Original German infantry source-face pool changes; phase authority for ground-unit naval evacuation and actual evacuation/return actions in Kiev–Odessa gameplay; country-border restrictions; full seven-turn mixed-setup contested browser acceptance; remaining unusual post-roll cases; historical certification. The fixed Black Sea Fleet port, approved two-tone retreat arrows, source photos, maps, CRT and shared rule configuration are unchanged.
