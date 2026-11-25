# Dedicated Soviet Naval Operations Phase — v564

**Checkpoint 329 / v564 — dedicated Soviet Naval Operations Phase (DONE, user-approved adaptation).** Kiev–Odessa now has ten recurring phases, with voluntary Fleet relocation, ground port transport and evacuation after Soviet Special Movement and before Combat. One Fleet relocation and one transport per unit per phase; destination is committed before damage. Empty phase skips on entry; forced reactions remain immediate. Actual source opening evacuation, reduced survivor return, Undo and Save/Restore pass 65 Node and 46 Chromium assertions; seven-turn no-combat continuity (89 actions), two contested seven-turn Node runs (173 assertions each), and cross-game phase schedules pass. Existing Kiev–Odessa campaign saves are configuration-incompatible. This is an explicit adaptation of printed §15.1 and a timing convention for §15.3, not historical certification. Remaining P0: territorial exceptions, rare combat branches, uninterrupted contested browser campaign with naval actions. See `docs/engine/ODESSA_NAVAL_PHASE_V564.md`.

## Timing and limits

- The printed §15.1 places voluntary Fleet movement in Special Movement. This user-approved adaptation moves it to the immediately following dedicated phase; §15.3 evacuation is assigned the same phase.
- Voluntary Fleet relocation at most once per phase; each ground unit can transport once. The player may choose order, subject to sharing the Fleet port at declaration. Ground movement is not authorized here.
- No legal Fleet relocation or ground evacuation at phase entry: skip atomically in the preceding completion action. Pending damage must resolve before completion.
- Forced Fleet displacement, air attacks, combat support, and replacement/return retain their existing timings.
- AI baseline controller resolves committed naval dice and can choose naval transport and survivor reinforcement; strategic quality is not certified.
- Old Kiev–Odessa campaign saves bind the old phase configuration and are intentionally rejected; begin a new campaign. Other game configurations are unchanged.

## Verification boundary

Actual Chromium human Orders test reaches Turn 2 from the original opening with a damaged Coastal Army evacuation, restores pending and resolved saves, undoes commitment and returns the same source counter once. Node tests cover six damage rolls, port transport, one-operation limits and absent-Fleet skipping. Full uninterrupted contested browser campaign with naval actions remains outstanding.
