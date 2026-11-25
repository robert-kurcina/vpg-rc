# Checkpoint 266 / v500 — Odessa annexation lifecycle and territorial retreat safety (non-live)

## Source and exact limitations

The authoritative `references/rules/odessa-rules.pdf` (printed page 1, §§9.4.4–9.4.5) requires the source-identified Romanian Home Army to remain within Romania until Bessarabia is free of Soviet units; after annexation, the Home Army can use Bessarabia even if Soviets later re-enter. The Home Army may attack across the Russo-Romanian border but may never **Advance After Combat** across it. Hungarian units are forbidden from entering Romania or Bessarabia. Source-backed face IDs and the opt-in territorial policy remain those of v499.

The original **261-hex combined map does not possess an independently certified, exhaustive Romania/Bessarabia/outside country mask**. This checkpoint **does not** classify the actual border, register the combined campaign graph for play, alter printed sources, assert full human/AI correctness, or permit an Odessa game to start. Region labels in the new test are explicitly synthetic. The map adapter still strips arbitrary country labels from map inputs; an actual source-approved territory registration mechanism remains a prerequisite.

## New shared-engine behavior

1. `core/territorial_state_transition.js` commits an immutable `territory.bessarabiaAnnexed` flag and emits a single `bessarabia-annexed` event. It preserves unrelated state, never unsets a true flag, and rejects unverified region coverage or malformed state rather than guessing. Other historical profiles remain unaffected.
2. `core/movement_binding.js` now accepts and propagates committed `state.territory` through normal movement and rule-aware route searches. `core/historical_movement_actions.js` uses that status in legal-action checks and commits the post-movement annexation result atomically. `core/historical_campaign_action_catalog.js` passes the same flag to human/AI path enumeration, preventing an inconsistency where a legal post-annexation route would be omitted while an actual move succeeded.
3. `core/historical_combat_consequences.js` commits annexation after losses/retreats/advances and Fleet displacement, and checks national territory on each leg of the existing safe-retreat fallback. Combat declarations still may cross the border when otherwise permitted.
4. Both `core/historical_forced_retreat.js` and `core/historical_retreat_options.js` apply identical nationality/Home Army restrictions on **every retreat hex** (including required overstack extensions). Before enumeration, they demand a complete source-certified territory mask. Incomplete geography or uncertain source counter identity raises a qualification error rather than being treated as an eliminated unit or an absence of retreat options.
5. `core/historical_campaign_session.js` invokes the same transition on committed unit-location/roster changes, including reinforcement and replacement, while retaining the existing replay-verified save and Undo machinery. The actual Odessa campaign cannot be initialized without its certified map and counter roster, so **Odessa end-to-end save/restore remains unaccepted**; only the generic functionality and synthetic deterministic transition replay have been tested.

## Verification

- `node tests/odessa-territorial-lifecycle-v500.test.js`: **45 assertions** on the original PDF hash, pure annexation and permanent re-entry behavior, direct movement, route discovery, per-leg retreat restrictions, fail-closed ambiguous identity/geography, a forged source-map label, and deterministic synthetic Undo/reapplication. The last case **does not** claim an authentic Odessa campaign save/restore run.
- Existing v499 **57 assertions** and v498 **169 assertions** pass unchanged.
- Leningrad v379/v380/v381/v395/v397/v398 forced/safe/overstack/ordered retreat tests pass, including three historical synthetic-topology harnesses updated only to resolve the new shared module import.
- Historical campaign continuation (v387), combat decisions (v392), buildup (v388), post-casualty decisions (v393), path catalogue (v391), and actual shared map Odessa City **13-check Chromium** test (v497) pass; other tests are documented in the checkpoint log. The much larger Fleet-choice catalogue (v465) exceeded the execution limit and is **unverified** in this checkpoint.
- All five shared-engine SVG/PNG map exports, source SVG, original source PDFs, printed counter metadata, CRT, and gameplay profiles remain byte-identical to checkpoint 265. Browser bundle regenerated from one shared source implementation.

## Remaining blocking tasks (in priority order)

1. Source-certify the complete combined-map country mask from the printed boundary/tints, with a reproducible evidence ledger; explicitly register that approval in the common movement binder. Until then, movement and retreat restrictions fail closed.
2. Source-bind all Odessa initial counter identities (especially the actual Home Army) and verify setup/reinforcement rules, port/Fleet interactions, and isolation-sensitive victory conditions.
3. Run actual combined-map forced-retreat and annexation transactions and verify save/restore and Undo across movement, combat, replacement, Fleet, and turn change. The current synthetic tests cannot substitute for this acceptance.
4. Complete source-driven single-player and human/AI vs AI seven-turn campaigns. Shared B4M CRT is unchanged. Four of five interfaces remain runnable (Kiev experimental); **Kiev–Odessa is NOT playable**.
