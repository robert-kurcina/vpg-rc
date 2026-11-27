# Development layout and qualification

The five production mission routes and the generated browser bundle retain their existing paths. Do not reorganize runtime modules solely by filename or age.

## Active entry points

| Purpose | Entry point |
| --- | --- |
| Current focused rules and contracts | `python3 scripts/run-active-regressions.py` |
| List focused test commands | `python3 scripts/run-active-regressions.py --list` |
| Generated runtime consistency | `python3 scripts/build-historical-browser-bundle.py --install --check` |
| Real-origin browser acceptance | `python3 tests/mission-hosted-v693.py` (with local server and Playwright Chromium) |
| Controlled CPU profiling / operational parity | Mission browser acceptance workflow, manual dispatch |
| Static distribution | `python3 scripts/build-static-release.py` (see README for arguments) |

The focused manifest is `tests/active-regressions.json`. Its initial sequence exactly matches the prior CI focused-rules commands. Every invocation runs fresh subprocesses, stops on failure, and does not write historical audit files. The suite is not exhaustive; browser, source-reference, distribution, and live-campaign jobs remain independent.

## Retention and reorganization policy

- Active production: runtime routes, authoritative engine, maps, configs, generated scripts and linked assets.
- Active development: manifest-listed checks and documented build, profiling, release and simulation entry points; their transitive fixtures and dependencies.
- Historical evidence: versioned checkpoint runners (including verify-checkpoint and run-checkpoint scripts), audit records, source ledgers and archived plans. Existing paths are retained because evidence and scripts refer to them. These runners are not current qualification and may overwrite their historical output or skip recorded cases.
- Removal candidates: only files proven unused by active entry points, dynamic loading, generated packaging, and retained evidence requirements. Age or absence from the focused manifest is not proof.

Before relocating or deleting anything, establish references, dynamic callers, packaging impact and evidence retention. Prefer documenting logical boundaries over physical moves when a move offers no practical benefit. Historical runners have not been rewritten or certified by this change.
