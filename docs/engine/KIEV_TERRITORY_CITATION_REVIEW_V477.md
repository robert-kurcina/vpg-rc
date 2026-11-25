# Checkpoint 243 / v477 — Kiev Romanian territory evidence-traceable review

## Problem and scope

The Objective: Kiev combat profile requires the **complete source-certified Romanian country-territory mask** for printed rules §10.8. The original source records identify **four Romanian and seven Polish initial setup locations** on the standalone 165-hex map, but these points are **not** a political boundary. The checkpoint-236 review workbench could classify all remaining 154 hexes as a manual draft, but could not attach evidence on a per-hex basis. Consequently, a complete-looking draft could not be audited against the source that supposedly supported each label.

Checkpoint 243 adds **citation traceability to manual territory labels**, without inferring any country's border or activating Kiev. The underlying original approved shared-renderer SVG remains intact. No historical source claim is created by user-supplied notes; notes may be incorrect, contradictory, or placeholders. Independent source review is required before any real mask could be certified.

## Changes

- `core/historical_territory_review.js`: Version 2 draft exports store a `citations` dictionary keyed by manually labeled hostCell. New immutable `cite`, `clearCitation`, `citation`, `evidenceStats` operations track evidence locators. Citations must be nonblank text of 1–500 characters, and the model rejects control characters, unknown hexes, source-pinned immutable setup hexes, and references detached from manual labels.
- A change from Romanian to Outside (or vice versa) **clears any old citation**; clearing the classification also clears its citation. Choosing the same classification preserves existing attribution. This prevents reusing evidence for a conclusion it never supported.
- Version-2 JSON checksum covers the complete citation map. A recomputed checksum still **does not** certify that the locator or historical interpretation is correct. Old version-1 source-matched draft files are accepted and migrated as **uncited** version-2 proposals rather than guessed evidence.
- `tools/territory-review/index.html`, `app.js`: evidence source-locator field, attach/clear controls, cited/uncited coverage, and a `Locate next unreviewed hex` control. Navigation is ordered by pixel distance to known printed Romanian setup markers **only as a review convenience** and never auto-classifies any hex or implies a border. The map is unchanged `exports/kiev.svg`; the hit overlay is diagnostic.
- Browser test evidence is a **real Chromium render** of the packaged game-engine map SVG, not a generated or web-searched screenshot. The browser test's hypothetical locator explicitly states `TEST ONLY` and does not purport to be documentary evidence.

## Verification

- `node tests/kiev-territory-citations-v477.test.js --write-audit`: **87 assertions** including all 11 source pins, immutable labels, citation truncation/invalid rejection, v1-to-v2 import, v2 roundtrip, checksum enforcement, clearing outdated evidence on label reversal, and explicit rejection of live game authorization even with 154 labels and 154 citations.
- `python3 tests/kiev-territory-citations-browser-v477.py`: **48 Chromium assertions**, including actual unchanged game-engine map, mouse/keyboard/touch review, draft download and import, keyboard labeling, nearest-unreviewed navigation without labeling, citation roundtrip, reversal behavior, and v1 migration. Screenshot: `rules/audit/visual/kiev-territory-citations-browser-v477.png`.
- Prior v470 territory Node and Chromium tests remain compatible. Kiev source geometry, original source rulebook, production graph policy, Kiev combat policy, shared CRT, and map exports have **not been changed**.

## Limits and next priority

The source status is **4 Romanian plus 7 Polish original markers**, **154 unclassified** unless a reviewer manually supplies proposals. The new citation fields are optional in draft preparation; the workbench reports missing citations. A full draft plus 154 typed citations remains **unapproved and non-playable** because this code is not an independent geographic adjudicator.

The next development step is to obtain/review an original authoritative Romanian national-border layer or sufficiently clear boundary data, register each affected hostCell against that evidence, independently adjudicate the boundary, and only then evaluate promotion of `maps/combat-configs/kiev.json` and Kiev's separate candidate movement graph. A real seven-turn human-browser campaign remains outstanding. Do not substitute original placement markers or a hypothetical source annotation for the country mask. Kiev–Odessa remains blocked. Other historical games and their baseline AI are unaffected.
