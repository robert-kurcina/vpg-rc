# P0 codebase inventory — initial measured baseline

Pinned main commit: `ffb900cbdd8eaa4f6dd3a2ff62aa35d0dffe29ae`. Git tree `f85d294e11c7218fa6303cde07596e6a933ae683`, recursive response not truncated. Counts are tracked blobs, not checkout disk usage or git history. No files deleted.

| Category | Files | Bytes |
|---|---:|---:|
| Entire tree | 2044 | 143552056 |
| JavaScript | 626 | 6359401 |
| Python | 300 | 1582273 |
| HTML | 23 | 2902088 |
| core/ (all) | 149 | 3861260 |
| core/ JS | 137 | 3809537* |
| Generated historical engine JS | 16 | 1914838 |
| Generated counter template/art JS | 2 | 569086 |
| Mixed terrain geometry and art JS | 1 | 163987 |
| Other core JS (candidates for source review) | 118 | 1161626 |
| tests/ | 611 | 3909493 |
| rules/ | 519 | 16996528 |
| scripts/ | 89 | 387066 |
| tools/ | 62 | 307137 |
| legacy/ | 25 | 348433 |
| docs/ | 178 | 690444 |
| provenance/ | 95 | 2426910 |

*Core JS subtotal is the sum of the four JS categories above (not all core files). Generated engine entry/runtime headers and generated art headers were checked; terrain_tiles.js is mixed source and artwork, not classified as generated. No category is a deletion recommendation. Tests include fixtures; rules includes audit evidence.

## Targeted source measurements

Physical lines (trailing whitespace ignored) and lexical named-function markers (not AST counts; arrow functions, object methods and anonymous functions excluded).

| Module | Lines | Named markers |
|---|---:|---:|
| historical_browser_app.js | 1308 | 75 |
| engine.js | 869 | 73 |
| historical_campaign_autoplay.js | 817 | 21 |
| native_browser_view.js | 636 | 32 |
| historical_campaign_session.js | 571 | 36 |
| mission_storage.js | 184 | 25 |
| historical_campaign_human.js | 175 | 11 |
| historical_deployment_session.js | 118 | 10 |

Ordinary JSON clone helpers confirmed in historical_browser_app, engine, historical_campaign_autoplay, historical_campaign_human and historical_deployment_session. Human and deployment modules also have ordinary JSON equality, SHA-256 and object predicates. Campaign session uses stricter canonical JSON and must not be merged indiscriminately. AI communication-index loops are similar but cache contracts differ. These are review candidates, not measured duplication percentages.

## Dependency evidence and next action

Moscow production HTML directly includes engine.js, native_browser_view.js, mission_storage.js and other native/shared modules. Kiev includes the generated historical engine chunks and historical_browser_app.js. Both controllers call mountToolbar once and await mount during startup (native lines 587/625; historical lines 1122/1292). A page-lifetime mount guard is therefore preferable to general DOM component teardown unless another caller establishes a need. Storage subscription disposal and failed-open retry remain separate concerns. The generic engine is not dead code.

Current CI entry point: .github/workflows/mission-browser-acceptance.yml. Existing baseline evidence: PLAN.md PR44 final acceptance and operational parity; not freshly rerun at the pinned commit. Focused storage regressions: tests/mission-storage-v680.test.js, tests/mission-indexeddb-v693.test.js, tests/mission-redo-v681.test.js. No new runtime qualification claimed.

## Reproduction and limits

Run `python3 scripts/audit-source-inventory.py ffb900cbdd8eaa4f6dd3a2ff62aa35d0dffe29ae` in a local checkout. This read-only report lists tracked source metrics, exact repeated one-line helper candidates, explicit relative require/script references and unresolved references; it does not establish semantic equivalence or dead code. Review dynamic imports, globals, HTML inline scripts, build registrations, CI, external entry points and actual callers before any deletion. Full report has not been executed against the repository in this session; the complete tree counts and selected source measurements above were obtained through GitHub. P0 remains partial until the report is run and its candidates reviewed. No arbitrary reduction percentage.
