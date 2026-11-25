# Checkpoint 252 / v486 — Second-pass source-complete archive cleanup

A second archive audit after the seven-turn Kiev browser acceptance concentrated on reproducible browser screenshot evidence and retired images, rather than deleting source material or game outputs.

## Preserved

- Full shared engine and all five scenario runtime configurations
- All five actual engine-rendered SVG and PNG exports
- Original scanned maps, traced SVG assets, photographed counter sheets, and historical rule PDFs
- Shared CRT, movement ledgers, rules, current Terrain Effects Chart assets and source-derived visual fixtures
- Four staged Kiev save/evidence pairs, campaign audit, contested-combat audit, and executable test sources
- Current final Kiev seven-turn Chromium screenshot and current TEC screenshot

## Excluded from distribution only

- Superseded reproducible Kiev browser screenshots (setup, territory drafts, movement workbench, prior packaging smoke test, experimental browser)
- One image explicitly marked retired under `provenance/llm/retired-visual-evidence`

No source tree files are deleted. `provenance/package-pruning-v479.json` retains every removed filename, size, and SHA-256 hash, including the historical exclusions inherited from earlier checkpoints.

## Policy

Original source variants and exact-byte duplicates remain in the source-complete archive: a name or identical hash alone is insufficient to declare a supplied source obsolete. In particular, the large official counter SVG and all map exports remain unchanged. Earlier version-specific tests and scripts remain as development provenance, while the current release uses the checkpoint-252 verifier.

## Gameplay scope

This is a packaging-only change. Kiev's 81-action Chromium run completed seven turns with a legal move and four reinforcements; an independent browser combat test verified an air-supported Exchange. These are separate results and do not yet certify a fully contested seven-turn historical campaign.
