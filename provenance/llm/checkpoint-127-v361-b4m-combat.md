# Checkpoint 127 · v361 · Battle for Moscow native combat parity

## Change boundary

Source package (map, counters, CRT, special rules, objectives) and all production UI files are unchanged. Added only a generic optional combat policy in the native preview, shared-module interpretation of that policy, strict validation, and differential audit/test code. Do not use this checkpoint to justify deleting legacy B4M.

## Verified cases

See `rules/audit/b4m-native-combat-parity-v361.json` for exact counts and source hashes. Legacy reference is `legacy/engine.js` and its current source package. The two defects were wrong default retreat module (one hex vs source two hexes) and missing exchange-strength matching. Additional tie-breaking and default attacker selections are configured, not hardwired per game.

## Nonclaims

No complete seven-turn replay, human browser cutover, full source correctness claim, native save/Undo and AI parity, or Turn-4 Shock UX coverage. Leningrad visual and map sources unaffected. Broader canonical migration deferred.
