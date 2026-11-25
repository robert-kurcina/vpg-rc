# Cross-game movement profiles

All profiles use `core/movement_rules.js`. `arduous.json`, `leningrad.json`, and `kiev.json` are source-backed movement rules, **not** verified whole-board movement graphs. Kiev–Odessa inherits Kiev movement rules and requires separately configured naval, home-army, and expansion microrules before executable activation.

The shared validator requires verified terrain and edges, including explicit rail and hexside attributes. Missing geography fails closed. Source: printed rulebooks §§7–9 and associated Player Aids. German first-turn surprise movement is explicit only in Arduous' existing profile; it is not generalized from the narrative text in other games.

Unit class labels in this profile are canonical taxonomy keys. Italian Motorized must be normalized to `class: motorized`, `nationality: italian` when its gameplay roster is activated. River hexsides are movement-neutral except Kiev's major river (+1 MP); Lake and All-Sea hexsides block traversal/ZOC. Stacking legality at phase end and reserve eligibility are separate from final-path legality, and require end-of-phase enforcement in executable scenarios.
