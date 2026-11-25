# Shared native-game browser workflow — Checkpoint 133 (v367)

## Entry and scope

For an HTTP-served copy of the archive, use
`games/battle-for-moscow/native-preview/index.html`. The project homepage links
this **opt-in experimental preview** without changing `game.json` or the
production legacy redirect. Serving is required: JSON is fetched over HTTP;
direct opening via `file://` does not provide portable browser fetch access.

The page loads the **real** six-piece historical B4M package and the `native-preview/config.json`
projection, and builds it with `WargameCore.build`. It does not execute the
legacy game rules for any action. `core/native_browser_view.js` is the reusable
browser interaction layer, using `WargameSession.legal/execute/undo/serialize/restore`.
All UI geometry is sourced from the original shared SVG map configuration, via
`HexTerrainTiles.svgMap`, `maps/registry.json` and official counter templates.

Available human interaction: manual or automatic start, legal counter movement,
declaration of one or more combat battles, atomic dice commitment, legal combat
choices (attacker loss, exchange loss order, retreat destination and advance),
interactive reinforcement entry, replacements, phase finish, Undo and versioned
JSON save/load. These are only the behaviors currently supported by the shared
native adapter. There is no independent browser-specific adjudicator.

## Save compatibility

`core/sync_sha256.js` implements the same synchronous SHA-256 digest as Node's
`node:crypto`; it exists to preserve the *existing* v1 native JSON save format
and package fingerprint across browser and CLI. Node byte-for-byte digest tests
run in `tests/browser-native-session-v367.test.js`. An independent Chromium
DOM test verifies cross-runtime save hash equality, a real map click, a combat
resolution, Undo, and manual setup.

SHA-256 checksums detect corruption. They are not signatures and must not be
interpreted as adversary-proof or server-authenticated saves.

## Verification limits

The sandbox's installed Chromium blocks direct navigation to local HTTP and
`file://` pages. `scripts/verify-native-browser-v367.py` therefore injects the
**unmodified JS source and actual scenario JSON bytes** into an isolated page,
mocking *only* `fetch`, without substituting any rules or session functions.
It verifies DOM operations, but not real hosted navigation, asset loading,
responsive behavior across devices, or pixel parity against the legacy UI.

Not migrated: B4M production entry point, the complete AI/AI-vs-AI controls,
full upstream Oberlabs human workflow, interactive air support for other
scenarios, and exhaustive combat/retreat/stacking decisions. No playability
claims are made for Leningrad, Arduous, Kiev, or Kiev–Odessa from this preview.

**Future:** add independent hosted browser acceptance in an environment that
permits local HTTP navigation, wire the AI to this same action interface, and
differentially compare real end-to-end player workflows. Do not retire the
legacy runtime before those gates pass.

## Checkpoint 134 · Native baseline AI control

The optional AI button loads `native-preview/ai-config.json` only on first use, validates its schema and bounds, then invokes `WargameNativeSessionAI.playSide` with the **existing native `WargameSession`**. The UI performs no additional AI legality or rules interpretation. Every move, declaration, die commitment, choice, replacement, reinforcement and phase transition is its own immutable session action and Undo entry. Partial manual setup is rejected without changing the session. Browser/Node save and replay fidelity is preserved.

The AI policy is a deterministic *baseline*, not a port of the older B4M strategic doctrines. Tests apply its chosen actions to both the shared session and the legacy **rules engine**, without assuming the old legacy AI would choose those actions. Hosted browser navigation and actual AI doctrine parity remain unverified. See `scripts/verify-native-ai-browser-v368.py` and `tests/b4m-native-ai-session-v368.test.js`.

## Checkpoint 136 · Defender-first human combat and rule references (v370)

`core/native_combat_ui.js` is a generic, read-only presenter of combat possibilities. It filters nearby uncommitted attackers for display, but **only `WargameSession.legal({type:'declare-battle',…})` authorizes a group**. Thus a single attacker with insufficient odds may still be selected as part of a valid group, and clicking a defender does not roll or mutate anything. Group suggestions are capped for presentation (all combinations of at most 12 adjacent attackers may be enumerated; custom click selection remains available when that bound is exceeded). `games/battle-for-moscow/native-preview/ui-config.json` selects defender-first mode. The same source can use attacker-first selection through `combatSelectionMode:'attacker-first'`, independently of scenario name.

The native browser now presents live guided text from the configured phase cursor and four rules-reference tabs. These read the *active executable configuration* (side phase sequences, terrain costs and shifts, CRT rows, and generic instructions). They are **not a transcription of the complete rulebook**; specialized exceptions remain governed by the source rules and the shared engine. UX profile fields are strictly validated. Session JSON format, map renderer, all gameplay modules and legacy production routing remain unchanged.

Verification: `node tests/native-combat-ui-v370.test.js` and `python3 scripts/verify-native-browser-ux-v370.py` exercise real action legality, two-step Undo, no RNG consumed by inspection, attacker-first alternative and malformed config rejection. Existing v367/v368/v369 isolated Chromium harnesses load the added shared module and still pass. The browser harness mocks only JSON network fetch; direct HTTP navigation, image asset loading and independent visual parity with upstream Oberlabs are outstanding acceptance criteria.

## Browser artwork integrity (Checkpoint 137 / v371)

The native browser uses the same map renderer (`HexTerrainTiles.svgMap`) and registry presentation profile as `scripts/export-campaign-maps.js`. The Node exporter embeds terrain and overlay images as self-contained data URIs. The browser now **also** loads the genuine PNG and SVG assets from the project root, validates decoding, converts them to data URIs, and passes those to the same engine renderer. Missing/empty/undecodable assets stop initialization instead of silently rendering flat fallback tiles.

The original v370 screenshot from an isolated `about:blank` Chromium DOM was not visual evidence: relative SVG image URLs did not resolve there. Its source and screenshot are archived. Current isolated-browser tests provide **real original file bytes** via `scripts/native_browser_asset_fixture.py` and explicitly verify 40 loaded assets. `scripts/verify-native-browser-art-v371.py` extracts the browser SVG without the interactive counters and demonstrates **exact pixel parity** with the approved B4M engine-export PNG (1690×1229). Tests still do not claim hosted HTTP navigation acceptance.


## Checkpoint 142 · v376: opt-in opening redeployment candidate

An **unchecked** experimental toggle in the native Battle for Moscow page adds a source-identified precombat reserve phase after German setup and before Turn 1 German combat. The selected reserves can remain unmoved, be returned to their original hexes or be redeployed to empty cells strictly east of the other Soviet frontline counters and outside German ZOC. These are generic shared-engine operations, not UI-computed moves; every action and confirmation participates in `WargameSession` save/Undo. Neutral AI opts to leave all reserves at their starting locations.

The published tournament reserve hexes (`0503/0608/0803 (Mozhaisk)`) do not agree with the engine board/register (`0503/0609/0804 (Mozhaisk)`). The conservative candidate zone can be narrower than the published rule. Therefore **tournament gameplay is disabled**, and the original Oberlabs executable destination set and optional-mode adjudication remain mandatory before certification. See `rules/audit/b4m-native-reserve-redeployment-v376.json`.

## Checkpoint 143 · v377: source/registered reserve diagnostic

In experimental reserve mode, the browser surfaces the published versus registered location triples near the active phase status. Once a source-configured reserve is selected, `WargameCore.openingRedeploymentAudit()` classifies all cells using the common engine's current candidate legality, and reports counts by candidate, occupied, east-boundary, and enemy-ZOC class. This method is **pure/read-only**: the shared `WargameSession.legal` and `execute` APIs remain the sole authorization/transaction path. The diagnostic does not alter the actual map or counter assets or supply a second map renderer.

The 22 German manual-setup identity transpositions yield identical legal reserve masks; this verifies a specific ZOC invariance, not source perimeter correctness. Published coordinates `0503/0608/0803` continue to differ from registered board `0503/0609/0804`; no implicit remapping or historical rule adjudication is applied. A true full-map parity result requires observing the original Oberlabs browser's destination set. See `rules/audit/b4m-native-redeployment-audit-v377.json`.
