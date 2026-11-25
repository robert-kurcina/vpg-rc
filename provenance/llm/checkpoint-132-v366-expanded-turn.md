# Checkpoint 132 · v366 — source-verified B4M expanded turns

Source of truth: `legacy/engine.js`, `games/battle-for-moscow/*`, and the opt-in native source projector.

Changed: `core/engine.js` (shared replacement-policy validation and option filtering); `core/native_preview_config.js` (strict replacement-policy whitelist); `games/battle-for-moscow/native-preview/config.json` (opt-in flag); two new differential tests and executable audit; documentation/PLAN only.

Evidence: `rules/audit/b4m-native-expanded-turn-v366.json`, source SHA-256s therein. The preview remains not live; production `game.json` retains legacy engine. 952 communication tests include 21 disconnected states but cannot cover arbitrary cut-set scenarios. The three terminal Moscow outcomes are reachable control-state counterfactuals, not fully played victory campaigns. Approved five-map rendering must remain unchanged.
