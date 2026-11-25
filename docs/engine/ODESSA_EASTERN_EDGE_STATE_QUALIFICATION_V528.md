# Checkpoint 294 / v528 — Eastern-edge state qualification (candidate only)

## Scope

Checkpoint 293 reconciled source-visible exterior reinforcement markings. This
checkpoint makes the **active** source-reconciled Soviet edge usable by a
**read-only, state-aware diagnostic**; it does not authorize the Kiev–Odessa
campaign or live replacement, reinforcement, or victory decisions.

`core/composite_eastern_communication_preflight.js` now exposes
`candidateEntries({units})`. It screens all 32 active Soviet exterior sides
across 16 candidate hexes for enemy occupancy and enemy ZOC, preserving the
source-pinned map geometry and retaining `certifiedForReinforcements: false`.

Important distinction: an *existing* Soviet unit at a communication-path origin
can begin in enemy ZOC under Kiev §12. New reinforcement **placement** cannot
inherit that origin exception. The test suite independently covers both cases.

`core/composite_eastern_communication_qualification.js` joins that entry
screening to source-ledger-pinned, Soviet-owned city-to-edge candidate routes.
At Turn 7, it can compute a **hypothetical** 20-city result using the isolated
city-count evaluator. It labels that result `projectedTurnSeven`, never actual
victory. The module deliberately does **not** expose a production
`communicated()` callback or a legal reinforcement action.

The v526 inherited Kiev-side route and v527 full-composite southern route remain
separate. The corrected version can find a southern communication path where the
older visualization-derived trace cannot.

## Regression coverage

- All 20 cities connected on a clear diagnostic board, with paths terminating at
  one of the 16 active composite boundary hexes.
- Occupied or enemy-ZOC candidate entries are screened, while Soviet units and
  non-ground Air Support markers do not create hostile ZOC.
- 20-city German victory, 19-city isolation draw/win, 18-city isolation draw/win,
  and 17-or-fewer Soviet victory are computed *hypothetically* only.
- A Turn-6 analysis does not produce an end-of-Turn-7 result.
- Changed SVG boundary geometry, altered city ledger, incorrect candidate-board
  status, invalid unit state, and invalid city control fail closed.
- Legacy v526 and active-composite v527 regressions continue to pass.

## Remains blocked

- Authorizing the 614 traversable candidate edges as the historical movement
  graph (including shoreline/river effects and source-priority disputes).
- Certifying Romanian territorial movement outside the four initial setup hexes.
- Resolving Soviet twelve-vs-eleven star presentation and 1309-vs-0706 marker.
- Binding approved communication and reinforcement sources into the live
  seven-turn Kiev–Odessa campaign, then completing human-browser acceptance.

No map, artwork, source rules, TEC, CRT, playable game configuration, or browser
presentation is changed by this checkpoint.
