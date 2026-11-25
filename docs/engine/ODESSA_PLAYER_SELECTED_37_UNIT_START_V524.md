# Checkpoint 290 / v524 — Source-bound Kiev–Odessa starting-state candidate

## Scope and authority

Implements a **diagnostic-only player-selected starting-state allocator** under Odessa §6 and Kiev §6. Its purpose is to turn the previously identified source faces into deterministic, inspectable runtime candidate IDs and legal setup choices. It is not a game activation, historical starting roster, or a map/counter-art modification.

The module `core/composite_starting_state_candidate.js` consumes the existing:

- combined 261-hex shared-engine map, the unmodified original Kiev map, and Odessa extension;
- verified §6 setup policy (`maps/setup-configs/kiev-odessa-source-setup-v522.json`);
- source-face binding policy (`maps/setup-configs/kiev-odessa-source-face-bindings-v523.json`);
- original Kiev source-face inventory and the original source-photographed Kiev/Odessa counter-face metadata;
- an explicit caller-supplied Kiev face allocation, Kiev face-to-hex positions, and seven supplementary Odessa design-to-hex positions.

The underlying binder checks SHA-256 digests of both supplied rule PDFs and the original counter sheet faces. No runtime counter identity is guessed from a scan or generated artwork.

## Candidate inventory

| On-board initial group | Count | Source |
|---|---:|---|
| German Panzer Corps in Poland | 3 | Kiev printed counters |
| German Infantry Corps in Poland | 7 | Kiev printed counters |
| German Infantry Corps in Romania | 3 | Player-selected Kiev printed counters |
| Romanian 3rd Army | 1 | Kiev Rom 3 photographed front/reverse |
| Romanian Home, 4th Army and Cavalry Corps | 3 | Odessa supplementary counters |
| Soviet frontline Armies | 4 | Kiev printed counters |
| Soviet frontline Mechanized Corps | 6 | Kiev printed counters, concealed/untried face flag |
| Soviet fixed rear Armies | 2 | Kiev printed counters |
| Soviet fixed rear Mechanized Corps | 4 | Kiev printed counters, exact §6 rear positions |
| Soviet rear and frontline Cavalry Corps | 2 | Odessa supplementary counters |
| Soviet Coastal Army and Black Sea Fleet | 2 | Odessa counters, both initially at Odessa `1513` |
| **Total initially on the board** | **37** | **17 Axis / 20 Soviet** |

The additional **seven original Kiev off-map ground counters** remain on their respective scheduled or replacement-only tracks: two Hungarian/Slovak Turn 2, one German/Italian Turn 3, two Soviet Army Turn 5/6, and one Soviet replacement-only Army. The original German FK IV/FK V Air Support counters and Romanian Rom I AK (Turn 2) are represented separately from the on-map ground roster.

All original Kiev on-board counters receive stable diagnostic IDs of the form `kiev/<front-face-id>`, retaining the photographed counter-face identity and paired reverse; Odessa pieces keep their existing namespaced IDs. The test fixture is an explicit **synthetic player choice**, never a default historical setup.

## Checked legality

- The seven original Polish black-cross hexes must each receive a unit, with three legal two-unit stacks and no double Panzer stack.
- The Soviet rear counters must occupy exactly `0406`, `0705`, `0803`, `1007`, `1106`, `1215`, `1309`, in their prescribed classes.
- Four Soviet Infantry Armies, six Mechanized Corps and one Cavalry Corps occupy **eleven distinct** approved frontline star positions; no two Soviet Armies are adjacent, including fixed rear or Coastal Armies.
- The Fleet and Coastal Army begin together at Odessa `1513`, with the Fleet stacking freely.
- Three German Infantry Corps and four Romanian ground units begin in Romania. Each proposed country hex is checked against explicit territorial evidence; *unknown* positions are staged as **unverified**, never authorized for historical movement or setup.
- Normal Kiev §8.1 stacking applies to all occupied initial hexes: max two combat units, max one Army, no opposing-side stack; Fleet marker stacks for free.
- No duplicated Kiev face ID, supplement design or illegal starting placement is accepted.

## Remaining **blocking** issues

1. **12 visible frontline Soviet stars vs. 11 units mandated by §6**: sample source-legal choices select eleven and report the one unoccupied marker; the candidate does not delete or suppress any user-approved star, including `1111`.
2. **`1309` vs. `0706` fixed-mechanized artwork**: §6 and original Kiev identify `1309`; the combined map visual disagreement is not edited.
3. **Romania political-territory mask**: all seven candidate Axis/Romanian setup positions still lack verified `sourceTerritory: romania`; orange Kiev setup markings alone do not prove a country boundary.
4. **Historical combined movement and eastern-edge communication**: the 261-hex movement/rail/river/shoreline graph is not yet accepted for gameplay.
5. **Naval transport timing and end-to-end campaign integration**: action phase authority and complete rules acceptance are still required.

The candidate result always returns `gameplayCertified: false` and `canRunHistoricalCampaign: false`. There is no new playable Kiev–Odessa browser mode or modified source map.

## Verification

- 57 new candidate assertions, including negative tests for missing/duplicate faces, wrong rear/port/star placement, source-face tampering, country violations, stacking and player-selectable German identities.
- Existing source-setup, Kiev inventory, source map, Odessa city-isolation, Fleet, naval-return, and campaign-continuation tests pass.
- Existing Support Window Chromium map-target test passes.
- The test saves a full diagnostic 37-unit manifest to `rules/audit/odessa-candidate-37-unit-manifest-v524.json`, with source-selected positions and explicit unresolved blockers. This manifest is *not* a certified game save.

Original source rules, source counter sheets, CRT, approved maps, TEC and previously approved UI art are unchanged.
