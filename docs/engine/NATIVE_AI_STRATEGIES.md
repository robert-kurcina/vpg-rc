# Shared native AI strategies — Checkpoint 135 (v369)

## Separation of responsibilities

`core/native_session_ai.js` is the **single shared** AI action proposer for the opt-in `generic-hex-v1` session. It receives only the validated policy JSON and the scenario built by `WargameCore`. Neither strategy imports or executes `legacy/engine.js`. Every committed action uses `WargameSession.legal/execute`; history, dice, Undo, and saves are unchanged.

- `deterministic-baseline` is the existing Checkpoint 134 policy, retained unchanged.
- `objective-guard-v1` is a new **opt-in** strategy implemented by generic rules, with settings in `games/battle-for-moscow/native-preview/ai-config-objective.json`. The native preview browser allows the user to select either profile.

The new policy reads **control victory objectives from scenario predicates**, not from a hardcoded game name or map coordinate. If a friendly-controlled objective hex is unoccupied, and a replacement action can legally enter it, the AI selects that action before ordinary unit restoration. During movement it does not voluntarily move a unit **out of** a friendly-controlled victory objective. These are strategy preferences, **not game rules**. They never authorize an illegal entry or require an action absent from shared legality.

## Evidence and limitations

- Three identical post-German first-turn states (seeds 1, 17, 1941) were compared to the legacy Soviet `fortress` strategic policy. The legacy policy and new objective guard both placed Soviet `s13` into Moscow as the first replacement; the baseline initially restored `s10`. After each Soviet side-turn, objective-guard vs. legacy still differed on 12–15 unit positions. The evidence **does not** prove full strategy equality, superiority, or search strength.
- Four full seven-turn objective-guard campaigns replayed the AI's selected actions through legacy **rule execution** with 1,080 matching action states, 107 resolved battles, 504 movements, 138 replacements, four Shock placements, 56 Undo checks and 40 save checks. This establishes tested **action-effect parity**, not choice parity.
- Chromium DOM integration with source JS and actual JSON (fetch mocked) passed both strategy selections. The environment's installed Chromium rejects local HTTP navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; hosted browser acceptance remains open.
- Rules, map rendering, initial deployment, and the established B4M production engine selector were not changed.

## Independent tests

`tests/b4m-native-strategic-comparison-v369.test.js`, `tests/b4m-native-objective-ai-campaign-v369.test.js`, `scripts/verify-native-ai-browser-v369.py`.

The remaining AI tasks are stronger policy/doctrine comparison across *evolving independent states* (not just initial shared states), competitiveness and adjudicated score, full human UX and AI side-turn/Undo controls, and hosted-browser verification. The established legacy runtime remains active until those gates pass.
