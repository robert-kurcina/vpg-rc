# Russian Campaign — five historical games

**Production baseline:** v701 / checkpoint 479 plus accepted shared-engine updates through PR #40. **Packaging:** reproducible browser-only static distribution. **Active plan:** `PLAN.md` (authoritative release checklist).

## Run

From this directory, run `python3 serve.py` and open http://localhost:8765/ in a browser. No backend game service or dependency installation is needed for gameplay. Use the same browser origin to access mission-local saves. Mission-local saves now use IndexedDB to retain full history beyond typical localStorage limits; previous localStorage saves remain readable and migrate on the next successful Save Mission. If IndexedDB is unavailable, localStorage fallback is capacity-limited. Export portable JSON saves for backups, especially before clearing site data or changing origin.

The mission selector (`index.html`) opens Battle for Moscow, The Arduous Beginning, Target: Leningrad, Objective: Kiev, and Kiev–Odessa. All five retain Standard/Advanced CRT, human/computer faction assignment, independent AI profiles, mission save/resume, Rules & Charts, and Undo/Redo. Historical victory remains the default. AI difficulty is Novice, Standard or scenario-specific Expert, plus unchanged Strategy defaults. Earlier numerical saves restore exactly; competitive ordering remains provisional; experimental graduated territorial victory is selectable under Settings before a new mission; thresholds and balance are provisional. HTML source reading editions provide 70 major-section and 133 numbered-case links; semantic reading-order review is deferred; integrated browser acceptance passed; see `PLAN.md`.

## Project layout

| Path | Purpose |
|---|---|
| `index.html`, `serve.py` | Mission selector and local static server |
| `games/` | Five production routes and existing experimental/lab routes |
| `core/` | Shared rules, renderer, AI, UI, and generated historical engine bundles |
| `maps/` | Scenario configurations, rosters, source geometry and map viewer |
| `assets/`, `supplied_assets/` | Approved counter, terrain and support artwork |
| `exports/` | Current five map SVG/PNG exports and gallery (retained because the UI links to them) |
| `references/` | Original rulebooks and player aids |
| `tests/`, `rules/tests/`, `scripts/`, `tools/` | Development, focused regressions, build and simulation tools |
| `rules/audit/` | Source ledgers, reports, saved fixtures and retained visual inputs |
| `docs/`, `provenance/` | Design notes, source decisions, prior evidence and archived documentation |
| `mechanics-lab.html`, `legacy/` | Existing diagnostic and compatibility material |

The historical directory name `rc_dev325` and all gameplay paths are intentionally unchanged. The production mission selector is the primary entry point; the laboratory is not required to play.

## Historical evidence supplement (archive provenance)

The original archive distribution referenced a companion `hex_wargame_v681_HISTORICAL_EVIDENCE.zip` (not bundled in this repository), containing historical generated screenshots and obsolete checkpoint-specific packaging scripts/tests, at their original paths. The supplement is not needed to play or run the focused current checks below. Some older audit tools or evidence-dependent tests require it; extract it over the same parent directory (not inside `rc_dev325`), e.g. `unzip -n hex_wargame_v681_HISTORICAL_EVIDENCE.zip -d .` from the parent. Do not overwrite any newly generated screenshots. The relocation manifest records every original file and SHA-256, including archived root documents. Original v681 README, UPDATE and manifest are in `provenance/archive/v681/`; older statements there are historical, not current status. No source evidence has been discarded.

## Development checks

Requires Node.js and Python 3. From the project directory:

```sh
python3 scripts/build-historical-browser-bundle.py --install --check
node tests/mission-storage-v680.test.js
node tests/mission-indexeddb-v693.test.js
python3 tests/rulebook-navigation-v693.py
node tests/mission-redo-v681.test.js
node tests/shared-terrain-reference-v676.test.js
node tests/historical-campaign-action-catalog-v390.test.js
```

Browser tests may additionally require Playwright and Chromium. For the current release limitations, consult `UPDATE.md` and `PLAN.md`. For parallel headless simulation use `node scripts/run-campaign-batch.js jobs.json new-output-directory 4` with the existing jobs schema documented in the archived README. No new development deliverable or rules interpretation is introduced by this cleanup.

Experimental headless Moscow stacking policies are selectable per faction in batch jobs with `germanTacticalPolicy` / `sovietTacticalPolicy`: `armored-concentration-v1`, `concentrated-defense-v1`, `mobile-concentration-v1`, or `adaptive-concentration-v1`. None is a production default or browser option. Dynamic stacking results: `rules/audit/b4m-dynamic-stack-v688.json`. See `rules/audit/b4m-stack-doctrine-v687.json` for inputs and results.

Graduated mode batch jobs use `"victoryMode": "graduated"` (default `historical`). Candidate scoring is version-bound to the save. See `core/graduated_mode.js` and `rules/audit/graduated-victory-v689.json`.

For controlled experimental mode comparisons, use `node scripts/analyze-graduated-pairs.js path/to/completed-report-directory [other-report-directory]`, or pass archived audit JSON files. The analyzer supports both terminal formats, refuses mismatched configurations and reports each scenario separately. Reproduce checkpoint 469 from this archive with `node scripts/analyze-graduated-pairs.js rules/audit/graduated-victory-v689.json rules/audit/graduated-controlled-v691.json`. All five scenarios have exploratory matched evidence; balance remains unverified.

### Real-origin release check

With `python3 serve.py` running, execute `python3 tests/mission-hosted-v693.py --url http://localhost:8765/index.html` in an environment with Playwright Chromium and permitted HTTP navigation. This uses a fresh browser context, tests all five mission routes and real IndexedDB save/return/resume/abandon. For a full terminal-save check, first run `SAVE_PATH=/tmp/moscow-terminal.json node scripts/run-native-campaign.js standard 71 5000 0 0`, then add `--terminal-save /tmp/moscow-terminal.json`. Use the corresponding repository-prefixed URL to check a GitHub Pages deployment. Hosted Chromium run [45747675673](https://github.com/robert-kurcina/vpg-rc/actions/runs/45747675673) passed all five real-origin save/resume checks and mission-scoped abandonment. Desktop/tablet screenshots were captured. Run 45756263724 passed all four historical live campaigns and five-route hosted acceptance using the split engine; diagnostic AI completed in approximately 5–10 seconds observed. Production split files were committed in PR #30. Controlled operational AI/headless comparison passed in run [45763742040](https://github.com/robert-kurcina/vpg-rc/actions/runs/45763742040): Kiev seed 7, grade 3/3, 433 exact actions, 11.750s Chromium and 9.369s Node. A same-run Node comparison measured 14.319s before topology reuse and 7.623s after (1.878×). All ten CI jobs passed.

Terminal browser regression (four larger missions, historical and graduated retained journals): `python3 tests/historical-terminal-browser-v694.py --scenario arduous` (repeat for `leningrad`, `kiev`, `kiev-odessa`). Uses bundled exact terminal save fixtures and isolated Chromium storage transport; not real-origin acceptance.

## Static deployment candidate

Build from this source distribution with `python3 scripts/build-static-release.py /tmp/russian-campaign-site --http` (a new directory outside the source tree). Verify file hashes and references after transfer with `python3 scripts/build-static-release.py /tmp/russian-campaign-site --verify --http`. Copy the staged files, including `.nojekyll`, to the intended static hosting root. This is a private release candidate: confirm redistribution rights for the supplied materials before public deployment. The HTTP check verifies repository-relative resources, not gameplay by itself. Integrated staged browser acceptance has passed; re-run it after relevant runtime changes or against a new deployment. See PLAN.md for remaining bounded optimization work and external release constraints.

## Repository maintenance

Keep the source repository distinct from the staged static website. Generated historical engine chunks and their script manifest are committed production assets; regenerate with `python3 scripts/build-historical-browser-bundle.py --install` after changing bundled sources. Do not delete supplied source art, linked map exports, audit fixtures or older tests solely because of their age. Historical checkpoint notes in `UPDATE.md`, `plans/archive/`, `docs/` and `provenance/` are evidence, not active requirements. Current priorities are defined only by `PLAN.md`. WASM and Oberlabs UX parity are rejected.
