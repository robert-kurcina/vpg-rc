# Checkpoint 299 / v533 — Kiev–Odessa Turn 2 live experimental Buildup

## Source authority and limits

- Original `references/rules/kiev-rules.pdf` §§11–12: Turn 2 Axis Slovak 3–4 and Hungarian 4–4, Soviet two replacement steps, eligible replacement-only Soviet Army; scheduled later arrivals on their printed turns, no Turn 1 Soviet buildup resources.
- `references/rules/odessa-rules.pdf` §11: Romanian Rom I AK Air Support marker arrives Turn 2; subsequent REFIT rule remains the existing combat-policy restriction. Odessa §§12.2 and 15.3: Fleet-port replacement exception, with evacuation phase still **not** authorized.
- Counter faces are identified by the original counter-sheet source transcriptions and exact paired reverse faces. The Fleet is a separate marker, not a 37th ground unit.
- Combined exterior entry is the active composite 32-side/16-hex Soviet and 50-side/23-hex Axis boundary. It is pinned to source geometry but retains **EXPERIMENTAL**, not historically certified, gameplay status.

## Shared implementation

- `core/historical_buildup_phase.js` uses an opt-in, source-fingerprinted composite entry boundary and explicit six-unit Odessa runtime-ID/face-ID aliases. It validates initial city control, replacement reserves and original Rom I AK source face and REFIT pairing. Existing Kiev and other games retain the standard source policy path.
- `core/historical_campaign_action_catalog.js` now includes the replacement-only Soviet reserve in player-visible legal placements, not merely internal engine transactions.
- `core/historical_browser_app.js` loads the full experimental `buildupPolicy`, `buildupAllocation` and `housekeepingPolicy` into the **existing** historical campaign controller, not a Kiev–Odessa-specific controller.
- `games/kiev-odessa/experimental-preview/config.json` and `maps/buildup-configs/kiev-odessa-experimental-v533.json` bind the source schedule; `games/kiev-odessa/experimental-preview/allocation-v533.json` binds original counter faces. Original maps and SVG exports remain unchanged.

## Verified transactions

1. Run normal Turn 1 to Turn 2 German Buildup; illegal early reinforcement rejected.
2. Admit original Slovak and Hungarian units at legal Axis edge hexes; source nationality and stacking preserved. Repeated placement rejected. Missed Turn 2 slots forfeited.
3. Finish German Buildup: Romanian original air marker arrives in Turn 2 and is now available for relevant air decisions.
4. Reach Turn 2 Soviet Buildup: apply one source-paired Coastal Army replacement at the Fleet port (using a deliberately reduced synthetic fixture), and legally admit the original Kiev replacement-only Soviet Army in reduced form at southern exterior hex `1914`.
5. Undo and Save/Restore reconstruct source-faced counters and all journal actions exactly.
6. The actual Chromium browser executes and renders the two German placements and the Soviet reserve replacement.
7. A separate 82-action **zero-combat, no-placement** shared-engine test reaches Turn 7 terminal housekeeping and a Soviet win with initial three Axis cities unchanged. This is a **phase-continuity smoke test**, not competitive/historical acceptance, not the seven-turn contested browser test, and not an adversarial AI run.

## Remaining P0

- Interactive player-selectable 37-counter starting setup (currently one valid example).
- A continuous seven-turn **contested Chromium/human** game, including at least one Kiev–Odessa seam movement, actual combat effects, all original scheduled arrivals and city-control changes.
- Live naval transportation/evacuation phase permission; original source §15.3 does not expressly establish a phase. No silent workaround.
- Romanian political territory mask and Hungarian/Home Army restrictions: unreviewed country territory remains disallowed rather than guessed.
- Historic isolation connectivity and original-source setup artwork discrepancies need later qualification; a derived `1201`–`1202` rail mismatch is nonblocking.

## Reproducible tests

- `node tests/odessa-turn-two-source-buildup-v533.test.js`
- `python tests/odessa-turn-two-browser-v533.py` (offline Chromium with approved real engine/map/counter art)
- `node tests/odessa-seven-turn-phase-continuity-v533.test.js`
- Existing v531/v532, Kiev and cross-scenario regressions.
