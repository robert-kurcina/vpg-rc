# Checkpoint 281 / v515 — shared legal-hex highlight standardization

This checkpoint standardizes the legal destination / target highlight used by the historical browser interfaces.

## Affected workflows

- player-selectable deployment
- reinforcements
- resupply / repair
- rebuild
- Support targeting

## Visual treatment

Each legal hex now uses the same two-part treatment:

1. **Primary border**: thick, solid, dark yellow.
2. **Secondary border**: thinner border on the same footprint, animated to pulse and fade while expanding to 3 px over 1 second.

A light translucent yellow fill remains so terrain and counters stay visible.

Support targets that have been chosen but not yet confirmed keep a darker selected border while retaining the same pulse language.

## Implementation scope

The historical browser renderer (`core/historical_browser_app.js`) now emits a paired non-interactive pulse polygon for each legal hex in these workflows. Shared CSS in `games/leningrad/native-preview/style.css` now owns the common highlight appearance. The prior support-only highlight CSS and the Kiev setup page's inline setup-highlight override were removed.

## Non-goals

- no rules changes
- no map geometry changes
- no CRT changes
- no changes to generic/native mechanics-lab previews
