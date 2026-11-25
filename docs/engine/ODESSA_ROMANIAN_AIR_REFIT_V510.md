# Checkpoint 276 / v510 — Odessa Romanian Air Support, Turn 2 arrival and REFIT

## Original source

`references/rules/odessa-rules.pdf`, page 1 §§6.0(6), page 2 §§10.5 and 11.0:

- One Romanian Air Support marker enters the reinforcement schedule on Game Turn 2.
- It provides the ordinary air shift, but cannot support combat on consecutive turns.
- After support, its counter is placed on the printed **REFIT** reverse as a reminder.
- The REFIT marker returns to its usable side following the Axis Combat Phase in which it refits.

The front photograph (`assets/official-counters/source-sheets/counters-odessa-front.jpg`,
`odessa-front-r01c07`) reads **Rom I AK; aircraft silhouette; 1; right arrow**.
The paired reverse photo (`odessa-back-r01c02`) reads **Rom I AK; REFIT**.
The counter-sheet and PDF SHA-256 hashes are pinned in
`maps/combat-configs/kiev-odessa-romanian-air-candidate-v510.json`.

## Implementation

Extend **one shared** `core/historical_air_support.js` — no Odessa-only air
runtime, no scenario-name branches:

- A marker may optionally have `cooldownTurns` and `refitFaceId`. Legacy German
  photographed air markers retain their original three-property definitions.
- The first-turn gate remains generic. The Odessa candidate registers
  `firstTurn:2`, `shiftRating:1`, `cooldownTurns:1` and the paired REFIT face.
- A source-registered reverse REFIT is required. Normal air markers cannot use
  this extension without matched photo metadata.
- The optional `requireRosterFaceBinding` policy requires the linked source
  roster's first available turn, ownership, front and back faces, and
  `explicit-pdf` evidence to match. Missing/tampered roster metadata fails.
- A committed Turn-2 shift consumes the marker only for Turn 2; Turn 3 is REFIT;
  Turn 4 is available. This is **not** a fixed even-turn schedule: if Turn 4
  is unused it remains available on Turn 5. Any subsequent committed use
  imposes its own next-turn REFIT.
- The `airUse` journal is immutable and replayable; malformed entries, unknown
  marker faces, use before arrival, and impossible consecutive-turn use are
  rejected on restore/availability.
- The photographed original German FK IV/FK V remain usable on consecutive
  game turns, preserving their baseline semantics.

## Candidate scope

The optional policy
`maps/combat-configs/kiev-odessa-romanian-air-candidate-v510.json` is **diagnostic
ground-support only**. It does *not* enable the fifth game, authorize
source-uncertified movement, implement its entire opening force schedule, add
Romanian support to the live browser, or implement §15 Fleet air attacks.

The game-specific data lives in the JSON profile, never in a second renderer or
scenario-ID switch. Only source-backed counter validation and a generic
one-turn cooldown were added to the common air-support implementation.

## Verification

`node tests/odessa-romanian-air-refit-v510.test.js` covers the photographed
faces, source PDF checksum, 1/2/3/4/5/6/7 turn availability, strict REFIT,
non-fixed cadence, German continued availability, immutable state,
JSON restore, invalid ledger, bad registered faces, and missing/altered source
roster. Historical Kiev and Leningrad air/Fleet/campaign regressions remain
passing. All five map SVG/PNG exports and the approved TEC are unchanged.
