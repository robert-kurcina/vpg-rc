# Checkpoint 280 / v514 — Support map targets: thick solid dark-yellow borders

## Decision

The player-approved Support map target highlight uses a **thick, solid, dark-yellow hex perimeter**, replacing the lighter blue outline. The target style applies uniformly to legal Air Support battle hexes, naval-air Fleet target hexes, and legal Fleet destination ports, via the existing `support-target-hex` SVG class and shared Support Window stylesheet.

## Style

- Eligible target: `#9e7900` solid 5 px stroke, round joints, no dash pattern, subtle transparent dark-gold fill.
- Hover/focus: same 5 px solid dark-yellow stroke; no width jitter.
- Target selected for confirmation: darker `#806100` solid 6 px stroke, slightly stronger transparent gold fill.
- `vector-effect: non-scaling-stroke` maintains the screen-space border thickness when map zoom changes.
- Original renderer hex points, terrain, rail and water art, city borders, counters, legal target lists, and combat controls are unchanged.

The keyboard/touch selection workflow remains counter → exact eligible hex highlight → select hex → confirm in the Support Window. The highlight is visual only and does not authorize additional targets.

## Scope

This adjusts **Support target highlighting only**. Reinforcement placement, resupply, terrain indicators, Romanian/Bessarabian territorial outlines, and other map styles retain their existing semantics and coloring. No gameplay/rules, CRT, map SVG/PNG exports, or shared renderer source changes.

## Verification

`tests/support-target-map-browser-v514.py` passes **78** actual Chromium assertions, covering Arduous legal target and selected target computed SVG strokes (including `stroke-dasharray: none`), all five Leningrad Fleet destination highlights, legal-action synchronization, confirm-before-commit, Undo, save/restore, and touch docking. Actual browser screenshots are archived at:

- `rules/audit/visual/support-map-arduous-highlights-v514.png`
- `rules/audit/visual/support-map-arduous-yellow-detail-v514.png` (crop of genuine browser output)
- `rules/audit/visual/support-map-leningrad-fleet-highlights-v514.png`
- `rules/audit/visual/support-map-leningrad-yellow-detail-v514.png` (crop of genuine browser output)
