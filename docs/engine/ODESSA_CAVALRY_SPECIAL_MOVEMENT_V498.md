# Checkpoint 264 / v498 — Kiev–Odessa cavalry Special Movement candidate

## Original source

`references/rules/odessa-rules.pdf`, printed page 1, §9.4.3 states that **Soviet and Romanian cavalry** can move during both friendly movement phases. During Special Movement they may expend only **half** of their printed allowance, and may enter enemy zones of control (EZOCs) normally. The preceding §9.4 text prohibits ordinary friendly infantry **starting** the Special Movement Phase in an EZOC.

The photographed Odessa counter-sheet metadata registers two Soviet cavalry identities (2–4) and one Romanian cavalry identity (3–4), but class-specific gameplay identity binding remains provisional. This checkpoint tests the explicit cavalry class on the composite board, **not** a live Odessa campaign.

## Shared-engine change

`core/movement_rules.js` now accepts optional, validated lists under:

- `halfSpecialMovementClasses.german/soviet`: unit classes allowed to move on half allowance in their Special Movement Phase.
- `specialMoveFromEZOCClasses.german/soviet`: a subset of the above allowed to **begin** Special Movement in an EZOC.

These lists are empty/absent for existing scenarios; no automatic cavalry inference occurs. The flags are validated as unique class names and reject inconsistent full-and-half movement grants and unlicensed EZOC exceptions. Infantry remains restricted, and Soviet rail-only movement remains infantry-only. Entering an EZOC still ends movement unless already at the last destination.

`maps/movement-configs/kiev-odessa-cavalry-candidate-v498.json` opts in **cavalry** for both sides; Axis Romanian cavalry uses internal side `german` plus `nationality: romanian`. This is a diagnostic profile and does **not** register a production graph or bypass source-status gates.

The shared browser bundle is rebuilt from the same source module; there is still only one engine.

## Verification and non-authorization

The new test `tests/odessa-cavalry-special-movement-v498.test.js` evaluates the authentic 261-hex composite candidate with 117 reconciled rail links and all 100 Sea/Coast ground barriers. It checks half-MP rounding, normal-phase full MP, both-side cavalry eligibility in initial EZOC, infantry non-eligibility, entry into EZOC and prohibition on crossing through it, rail-only prohibition, shortest-cost legal routing, source counter identities/hashes, invalid-profile rejection and failure of the production graph authorization gate.

No main-map or historical source artwork changes. The active Kiev game keeps its original movement profile. **Kiev–Odessa remains non-playable** pending its actual starting forces, §9.4.4 Romanian Home Army/Bessarabia restrictions, §9.4.5 Hungarian territory exclusion, Fleet/port mechanics, reinforcement policy, isolation victory calculation and real browser campaign acceptance.
