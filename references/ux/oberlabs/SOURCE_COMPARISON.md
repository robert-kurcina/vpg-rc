# Oberlabs UX: source-versus-reference comparison — Checkpoint 32

## Evidence classes

1. **Upstream page evidence:** https://oberlabs.com/b4m/ exposes the phase labels, turn sequencing, reference tabs, defender-first battle declaration, city-ownership turn-information control, and opt-in tournament rules. Its published page text was inspected 2026-11-18. This is upstream webpage evidence, **not a locally inspected copy of original upstream JavaScript**.
2. **Bundled runtime evidence:** `legacy/ui.js` implements the local human actions and phase transitions; `legacy/oberlabs-play.js` wraps it with a phase-guided panel, New Game, Rules & Charts and AI research controls. It explicitly identifies itself as a *wrapper*, not a full upstream source clone.
3. **Screenshot evidence:** the seven reference screenshots indexed in `manifest.json` show the original appearance and four-tab reference window. They do not prove that the local wrapper implements all controls.

## Source traceability and gaps

| UX feature | Upstream webpage / screenshot | Bundled code | Disposition |
|---|---|---|---|
| Eight main phases | Confirmed; four German and four Russian | `legacy/ui.js::phaseAdvance`, `legacy/oberlabs-play.js` phase panel | Retain phase policy via scenario config; include special setup/reinforcement substates |
| Defender-first attack declaration and queue | Confirmed in upstream How To | `legacy/ui.js::handleBoardClick`, `doCombat`, `phaseAdvance` | Baseline for B4M |
| Stored die, subsequent consequence choices | Characterized in bundled runtime, not independently proven upstream | `legacy/ui.js::prepareCurrentHumanBattle`, `resolveCurrentHumanBattle` | Preserve local behavior pending upstream confirmation |
| Reference tabs: Sequence, How To, Terrain, CRT | Confirmed upstream and screenshots | `legacy/oberlabs-play.js` creates a *simple un-tabbed* rules dialog | **GAP:** common tabbed reference window not implemented |
| City ownership by turn-bar click | Upstream How To documents this interaction | Local wrapper status sync does not expose equivalent control | **GAP:** implement through shared city-control overlay policy when supported |
| Tournament rules option | Confirmed on upstream landing | Local rule profile has tournament-mode metadata; wrapper New Game has mode selection but no equivalent tournament toggle | **GAP:** optional and scenario-configurable, not globally enabled |
| Phase actions and help | Upstream visible; details vary by phase | `legacy/ui.js::renderActions`, `render`, `phaseAdvance`; `legacy/oberlabs-play.js::sync` | Existing local B4M path, retain |
| Generic catalog combat declaration | Not upstream B4M evidence | `app.js::clickHex` selects friendly attackers first | **CONFLICT:** do not treat generic catalog as equivalent to Oberlabs UX |
| Generic terrain/counter rendering | User-approved across map configurations | `app.js::render`, `core/presentation.js`, `core/counter_visuals.js` | Reuse unchanged; avoid screenshot simulation |

## Shared presentation architecture decision

One set of reusable components and action contracts must serve all five entries: game selection, turn/phase header, map, action list, settings, modal reference tabs, city-control display, and action/Undo history. Each component reads the active scenario's *validated configuration* for labels, legal actions, phase order, available controls, optional rules, chart rows, and illustrations. The existing `maps/presentation/registry.json` is a **declaration only**, not a completed runtime integration.

There is no universal rule that attacker-first or defender-first is correct for every historical game: B4M must reproduce the upstream defender-first sequence, while other configurations must use the source-backed sequence for those games, not inherit the current `app.js` behavior by accident. Similarly, base CRT lookup is shared; modifiers, terrain, optional rules, reinforcements and phase exceptions remain scenario-defined. Kiev–Odessa composes Kiev plus expansion data, not another UI implementation.

## Acceptance gates

- A single shared shell is instantiated for all five catalog entries; no copied per-game dialog implementations.
- An action provider describes legal clicks and next steps; renderer does not independently decide combat legality.
- The B4M adapter reproduces defender-first declarations, battle queue and Undo using real browser interactions.
- The four reference tabs show data from active scenario rules and hide terrain rows that are not in the scenario.
- Game-specific option controls are shown only where supported, including tournament rules when applicable.
- Existing approved map and counter artwork remain produced by the engine.
- Missing scenario executable data fails closed; historical games are not advertised as playable prematurely.

## Limits

The upstream webpage is available as text, but original upstream JavaScript was not located in the packaged checkpoint. Earlier local-v316-versus-v317 tests remain **internal differential tests**, not independent upstream executable parity.
