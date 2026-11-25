# v294 — German deployment white backing opacity

Changed the `.german-deployment-backplate` white rectangle from 0.25 to 0.50 fill opacity to match the existing Soviet deployment star white halo at 0.50 stroke opacity. Preserved the source-derived German cross geometry and all map coordinates.

Re-exported maps using the existing shared JS renderer; the Kiev–Odessa PNG was rasterized from that export using Inkscape.

Verification: `node tests/deployment-white-alpha-v294.test.js`, `node tests/svg-rail-deployments-v291.test.js`, `node tests/official-counters.test.js`.
