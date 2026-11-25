# Battle for Moscow — proposed optional two-unit stacking

Status: author approval required; no production activation. Historical one-unit mode is unchanged.

Use the existing `stacking-capacity-v1` (two friendly ground units) and `stacked-battle-v1` (two defenders) only after the following Moscow-specific choices are approved. Historical initial placement, roster, weather, CRT, seven turns, victory, replacement budgets and supply remain unchanged. Both factions have the same capacity; no temporary overstacking. Configuration is fixed at new mission initialization, with historical saves interpreted as single-stack only. Preserve existing setup swaps and empty-only reinforcement entry initially; ordinary movement and retreat may end on friendly occupied hexes if capacity and all other rules permit. Both eligible attackers in one hex may attack; apply terrain shifts once to combined defending strength. One attack per defending hex. One eligible advancing unit, not automatic movement of both.

| CRT result | Proposed stacked effect |
|---|---|
| NE | No effect |
| AL | Attacker selects one eligible attacker to lose a step |
| DE | Both defenders eliminated |
| DR | Both retreat unless eligible Stand Fast is chosen |
| DRL | Defender selects one step loss; survivors retreat |
| EX | Defender selects one step loss; attacker matches combat-strength loss with existing Moscow exchange priority/choice; survivors retreat |

**Stand Fast:** on DR in a Major City, an eligible full-strength defender may lose one step to hold the whole surviving stack, or the defending player may choose normal retreat. This is an explicit variant rule, not the printed historical rule. If no eligible full-strength defender exists, normal retreat. Other results do not invoke this option. Each surviving retreating unit needs a legal route, with capacity evaluated jointly; eliminate units unable to retreat under the existing Moscow radial/ZOC rules. Keep Moscow minimum odds (1:1 Standard, 1:2 Advanced), never replace illegal known-strength attacks with automatic NE. Explicit player choices must use the defending or attacking faction as appropriate; AI uses same legal choices. Preserve committed dice and journal on Undo/Redo and saves.

## Verified source constraints

- `core/engine.js` validates stacked combat plus `defender-holds-on-retreat-v1` only if `singleDefenderOnly: true`. That opt-out is insufficient for the proposed stacked city defense. `combatPreview` hardcodes `cityHold:false` for stacked defenders; `resolveStackedAttack` has no city hold branch.
- Existing stacked resolver sums defender power, resolves DE for all, DRL/EX loss allocation and separate retreat assignments, but uses a Kiev-oriented retreat preference and its own Exchange calculation. Verify strength-loss matching and post-loss routes under Moscow rules, not assume exact parity.
- `declareCombat` currently allows below-minimum odds when `stackedBattle(g)` is true; this is not appropriate for the proposed Moscow variant. Do not enable the module without explicit strict-odds policy.
- Native Moscow UI, session and AI need explicit multi-defender choice support. Native profile projection currently protects source special rules from modification; use a validated separately selected variant, not edits to historical source files.

Author approval needed for the proposed result allocation, same-hex attacks, and Stand Fast. No claim of a playable variant. Historical Stand Fast adjudication remains a separate decision.
