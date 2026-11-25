# Checkpoint 126 — v360 — Native B4M preview and differential audit

Source archive: `hex_wargame_v359_CHECKPOINT_125_SHARED_COMBAT_TRANSACTIONS.zip`.

The existing generic engine now loads the original B4M scenario content using a constrained opt-in overlay. The overlay configures precise phase order for the tested slice, mud movement-cost behavior, Soviet-only fortification defensive benefit, Shock Army ordinary replacement lockout, and a fixed known baseline German setup. The generic kernel gained a non-scenario-specific `control`/`owner` city-ownership fallback. Nothing was changed in the production legacy game or rendering code.

Audit: `rules/audit/b4m-native-preview-parity-v360.json`.

Key deltas found during adversarial testing:
- Mud initially disagreed because forest entry still charged 2; corrected via the scenario's `weather[].mudIgnoresTerrainCosts` configuration.
- Native initial city ownership initially had only 4 rather than 11 records; fixed in generic core without a scenario-name branch.
- Virtual Soviet-on-German fortification battles originally incorrectly penalized the Soviet attacker. Corrected through `combat.terrainDefenderFactions.fortification=['soviet']`.
- Soviet Shock Army was selectable as ordinary replacement on Turns 1–4; corrected with the preexisting generic replacement eligibility option `replacements.excludedTypesUntilTurn.shock=4`.

Verification covers 406 movement contexts with 2,560 exact options/routes/costs, 14 replacement contexts, 3,144 virtual combat odds and 30 opening German candidate odds, along with phase, initial roster, initial city controls, topology, CRT/source immutability and fail-closed tests. Re-rendering preserved all ten SVG/PNG exports byte-for-byte. This remains a bounded preview, **not** B4M full gameplay migration; retain the live legacy baseline.
