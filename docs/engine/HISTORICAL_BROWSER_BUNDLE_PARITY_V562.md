# Browser bundle parity — v562

**Checkpoint 327 / v562 — browser engine bundle synchronization.** v561 fixed naval destination admission in CommonJS but shipped a stale generated browser bundle. Regenerated all 59 modules; the only bundle difference is the v561 naval fix. Added a non-mutating `--check` build guard and regression for stale/missing bundles. Actual Chromium executes the bundled naval component for all six dice (36 assertions); 198 naval, 75 return, 26 synthetic journal and 301 CRT Node assertions pass. No historical naval phase permission or other gameplay configuration changed. Full browser campaign not rerun. See `docs/engine/HISTORICAL_BROWSER_BUNDLE_PARITY_V562.md`.


Release verification: `python scripts/build-historical-browser-bundle.py --check` and `python tests/historical-browser-bundle-v562.py`. The latter exposes a private module loader only in a test copy of the generated bundle, runs source-qualified naval fixtures in Chromium, and checks the stale/missing guard in a temporary directory. This is component-level browser qualification, not historical phase authorization or a player-facing campaign replay.
