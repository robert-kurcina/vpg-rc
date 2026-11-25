# Consolidated historical rule decisions — revision 435 (v667)

No historical rule has been changed. Source references are the supplied rulebooks and the v667 production code and tests.

| Topic | Printed rule | Current runtime | Ruling / outstanding proposal |
|---|---|---|---|
| B4M minimum odds, §9.1 | Adjusted odds below 1:1 have no effect | Declaration rejected below the active CRT minimum; v587 consequence fixture confirms Standard rejection | **SETTLED (author, revision 437):** retain rejection below the active minimum; Standard 1:1, Advanced 1:2. No automatic NE for B4M. No production change. |
| B4M Stand Fast, §9.3 | Defender may convert DR in Major City to one step loss without retreat | Automatic city hold; v587 verifies forced step loss for Major City DR | Make it an actual defender choice: accept one loss and stay, or resolve normal DR. Retain existing retreat authority for destination selection. Pause AI attacker when a human defender must choose. |
| B4M city ownership, §§5, 10 | Last friendly unit to enter determines control | Endpoint-only movement capture; v589 demonstrates transit through 1,4 retains prior control | Capture every city actually traversed by a legal committed route, including intermediate cities; preserve route legality and ownership on vacancy. |
| Leningrad §5 | Axis 14: German victory; Axis <=12: Soviet victory; Axis 13 with only Leningrad held by Soviets and isolated from east: draw | The other 13-city cases return unresolved-source-rule | Conservative proposed completion: Soviet victory when Leningrad remains connected or when a different city is the only Soviet-held city. This is a house adjudication, not printed text. |

The last proposal preserves the specific printed draw condition and the German sweep requirement, but the printed rules do not logically require a Soviet win for either omitted case. User approval is required. The B4M minimum-odds question is closed. The two remaining B4M proposals would change established Oberlabs-compatible behavior and require approval. The other four historical controllers retain automatic NE resolution (including concealed-strength cases); no global change is made.

## Independent verification on v667

- Odessa `odessa-entry-border-reconciliation-v527.test.js`: 389 assertions passed. 32 Soviet exterior sides, 16 unique candidate entry hexes; all source-marked sides exterior, source SVG digest verified. Current experimental buildup `odessa-turn-two-source-buildup-v533.test.js`: 53 assertions passed (16 Soviet, 23 Axis entry hexes). `odessa-victory-isolation-v521.test.js`: 4,814 assertions passed; 190 city pairs across four isolation combinations. `odessa-appended-edge-v581.test.js`: 2,125 assertions passed. `odessa-inherited-edge-reconciliation-v529.test.js`: 48 assertions passed; archival diagnostic retains historical 1201–1202 disagreement, not grounds to reopen user-approved active connection. These results do not confer historical certification on the experimental source binding.
- Kiev `kiev-exchange-exhaustion-v604.test.js`: passed exact replay, legal EX losses and no advance. Actual integrated browser casualty selection not yet verified.
- B4M `b4m-source-final-v589.test.js` and `b4m-source-consequences-v587.test.js`: passed existing compatibility fixtures; confirm the documented differences, not source compliance for the open conditions.
- Leningrad `historical-housekeeping-eight-turn-v389.test.js`: 226 assertions passed, 94 source-legal actions, existing undefined outcomes preserved.
- Arduous `historical-operational-qualification-v644.test.js arduous advanced 42 5000`: timed out after reaching Turn 7 with 177 movements, 17 combats, 7 reinforcements, 6 completed turns. No terminal report or save restoration confirmed. This is an incomplete run, not a gameplay failure.

## Subsequent acceptance evidence (checkpoint 442)

Kiev Exchange browser workflow passed 15 assertions in revision 436. Arduous Advanced seed 42 completed all seven turns and restored exactly in revision 436; the recovered machine-readable report is now included at `provenance/llm/arduous-v667-advanced-seed42-revision436.json`. No additional historical interpretation has been approved.
