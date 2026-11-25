# Checkpoint 236 / v470 — Source-anchored Kiev Romanian territory review workbench

## Reason for this checkpoint

Objective: Kiev **§10.8**, original user-supplied `references/rules/kiev-rules.pdf`, printed page 5, restricts Soviet Turn-1 attacks on Axis counters **in Romanian territory** to Soviet units *originally deployed* at `0708`, `0808`, or `1110`. The shared combat controller already tracks original setup hexes and has the source-neutral enforcement hook, but the live Kiev map does not have a complete authorized Romania-country mask. A full map mask **cannot** be inferred from the four Romanian deployment crosses alone. In particular, Romania is not equivalent to `0709,0809,0910,1010` for every possible target after movement.

The source-registered Kiev map currently has **165 cells**. Section §6.0(7–8) supplies positive markers for four Romanian-start hexes and negative markers for seven Polish-start hexes; the **remaining 154 cells are left explicitly unclassified** in the new review tool. This is a limited increase over v444, which had only recorded the four positive markers for territory evidence. It is **not** a resolution of the country boundary and does not assume that every unclassified cell plausibly belongs to Romania.

## What was delivered

- `tools/territory-review/index.html` and `app.js` — a static, browser-only, responsive diagnostic using the **existing unchanged** `exports/kiev.svg` as its actual engine-rendered map, with a translucent source-aligned selection overlay. The original map scan is independently available in a collapsible reference. On narrow touchscreens the larger map scrolls rather than shrinking all 165 touch targets into an unusable miniature.
- `core/historical_territory_review.js` — a *scenario-neutral* state/controller for a source-pinned manual region annotation. The source markers are derived from the setup groups in `maps/setup/kiev.json`; 4 Romanian and 7 Polish positions are immutable. Every other cell starts `unreviewed`; selection explicitly labels `romanian`, `outside` or returns to `unreviewed`.
- `tools/territory-review/kiev.json` — data-only scenario binding: actual map ID, source PDF digest and setup marker-group references. No scenario-ID branch or second map/terrain renderer was introduced.
- `index.html` and `games/kiev/setup-preview/index.html` now link to the review workbench. The Kiev gameplay setup preview itself is unchanged apart from its navigation link.
- The portable sync SHA-256 module is reused for checksum-validated review draft export/import. Imported drafts must match all source fingerprints and cannot edit the original printed setup markers, even if their digest is recomputed. This prevents accidental state drift, **not** malicious file forgery or historical-evidence falsification.

**Every export is explicitly an `UNAPPROVED-CANDIDATE-NOT-GAMEPLAY-POLICY`.** Even if all 154 unknown cells are manually labeled, its coverage is `draft-complete-pending-independent-source-approval` and `gameplayAuthorized: false`. It cannot be submitted as the combat policy's `targetRegionEvidence.coverage: complete`; there is no automatic promotion path. A reviewed classification still requires authoritative country-boundary evidence and separate approval. No production or player-mode Kiev action consumes this draft.

## Tests and verified scope

- `node tests/kiev-territory-review-v470.test.js --write-audit` — **57** assertions: printed source pins, 165-cell coverage, 4+7+154 statuses, immutable source anchors, duplicate/invalid input rejection, reset, manual full-draft roundtrip, digest rejection, source-pin rejection even with a recomputed digest, unchanged protected original source files and map exports, and a still-closed actual `MapGraph.build(kiev)` gate.
- `python3 tests/kiev-territory-review-browser-v470.py` — **34** real Chromium assertions, using the packaged HTML and original source/module/SVG bytes: aligned source-marker overlay, user pointer/keyboard actions, immutable source markers, actual draft download and import, tamper feedback, two manual selections, mobile one-column layout, scrollable larger touch map and an unforced touch tap. Screenshot: `rules/audit/visual/kiev-territory-review-browser-v470.png`.
- Relevant regression suites also passed: v469 original Kiev setup page **40 Chromium** and Node **21**; v468 Kiev deployment **100**; v437 Kiev initial allocation **180**; v442 Kiev early combat **45**; v443 Kiev immutable combat origin **100**; v444 territory evidence **27**; v433 Kiev isolated movement graph **2,949**; v410 Kiev victory **192**; Arduous large EX **536**; Arduous stacked post-roll **93**; shared movement **28**; city dots **5,376**; and package-layout validation.

The mobile Chromium test is **not** a physical iPad Safari test. No live gameplay scenario, end-to-end Kiev campaign, border history, artificial intelligence or source-country adjudication was certified in this checkpoint.

## Next executable work

1. Obtain and review a historically reliable, hex-registered Romania border for the **entire standalone Kiev board**; use the diagnostic manual classifications only as candidate work product, with explicit source evidence and approval. Do not infer the border from the setup crosses.
2. Complete the separate Kiev combat/buildup special-rules profile and independent campaign test coverage, then certify the source-reviewed graph and §10.8 restriction together before enabling actual Kiev play.
3. Complete a seven-turn Kiev campaign with real browser controls and baseline AI tests. Only after Kiev is independently playable, complete the Kiev–Odessa expansion.

Protected original map geometry, approved no-drop-shadow map exports and City dots, official counter art, shared CRT and prior playable game engines remain byte-identical to checkpoint 235. No combined campaign or optional B4M stacking work was started.
