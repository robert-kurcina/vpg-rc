# Checkpoint 184 — cleaned project / candidate-only audit

The project is based on the checkpoint 183 clean distribution. No old checkpoint artifacts were reintroduced.

The Arduous effective river audit now includes only sustained source-vector side-follow observations. There are 45 internal candidates and two exterior observations. Incidental contacts are ignored at extraction; there is no separate rejected-contact ledger, original ambiguity image, or obsolete decision metadata. River candidates remain uncertified for gameplay.

The approved five map exports, source maps, artwork, shared CRT, and existing gameplay engine are preserved. The candidate overlay is generated over the approved `exports/arduous.png` without altering its city labels or water colors.

Run:

```sh
python tools/audit-arduous-river-candidates-v418.py --write
node tools/audit-arduous-topology-v418.js --write
python tools/render-arduous-river-candidates.py
node tests/arduous-river-candidates-v418.test.js
node tests/arduous-topology-probe-v418.test.js
python tests/arduous-river-candidates-v418.test.py
python tools/check-package-layout-v417.py
```

The SHA-256 manifest `PACKAGE_MANIFEST.json` is generated after tests. Legacy history remains only in the separately distributed v417 historical-evidence ZIP, which is not needed for gameplay.
