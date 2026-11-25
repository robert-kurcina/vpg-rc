# Checkpoint 226 / v460 — Seven-turn contested Arduous campaign through Chromium

## Accepted behavior

The full **184-action**, seven-turn deterministic contested Arduous campaign now completes through the **actual shared-engine browser player controls**, with a terminal Soviet victory. The test consumes a separately generated current-engine oracle but does not commit an action by invoking `Campaign.execute` from the Chromium test. It selects visible action buttons, battle proposal checkboxes, the committed-die input, and post-roll consequence buttons.

### Exact coverage

| Gameplay element | Browser action count |
|---|---:|
| Campaign transactions | 184 |
| Ground movement declarations and resolutions | 27 each |
| Resolved battles | 14 |
| Committed ordinary d6 | 8 |
| Automatic no-die battles | 6 |
| Ground air support decisions | 7 |
| Reinforcement placements | 7 |
| Replacement actions | 6 |
| Completed housekeeping phases | 7 |
| Browser assertions | 1,530 |

Opening SHA-256 campaign state: `ab85eef4fcd613f7aaf5f5cb6270fc88852610a743de8d30cb561522dfbfe337`.

Terminal SHA-256 campaign state: `904229f5bdcfdd603a950578ffb086f4fccb7e22efd60293477bd20803eae260`.

The terminal state has German control of 1 of 12 source-defined cities (Vilnius), giving a Soviet victory under the configured scenario adjudication.

## Reproducible method

1. `node tests/arduous-contested-browser-trace-v460.js` independently generates the source-authoritative 184-action reference file. It uses the candidate opening from `tests/fixtures/arduous-source-setup-v419.js` and the already-tested seeded single-battle policy from v459. The initial browser save must match its opening state hash.
2. `python3 tests/arduous-contested-chromium-v460.py --max-actions 28` loads the project-original Arduous browser JS and approved shared-renderer SVG into Chromium. No alternate engine or map mockup is used. In this execution environment, local HTTP is unavailable, so original files are supplied through the established in-memory HTML/JSON fixture.
3. Each browser action is located in the actual human decision catalogue and selected through a visible control. Large lists use the player-facing Orders filter. Each non-automatic die is submitted before choosing a result; automatic NE uses the separate player button.
4. After *each* game action, the browser-generated save's `campaign.finalStateHash`, action number, and phase are compared against the separately calculated reference. No divergence was observed.
5. The 184-action browser run was split across seven Chromium sessions at action counts **24, 48, 76, 104, 132, 160, and 184**. Each new session restored the exact **previous browser-produced** save and rechecked the expected hash. The stage saves are transient, not substitute initial states; the browser still committed all 184 actions.
6. Terminal Chromium screenshot: `rules/audit/visual/arduous-contested-seven-turn-chromium-v460.png`. Detailed acceptance record: `rules/audit/arduous-contested-chromium-v460.json`.

## Independent review and limits

This proves **browser-to-engine parity for this entire contested trajectory**, not complete source-rules verification or all possible seven-turn trajectories. The oracle runs the same source game engine separately and therefore cannot detect a mistake common to both implementations. A single deterministic candidate deployment does not certify all historical starting identities. The post-roll `EX` browser catalogue remains bounded to 128 validated choices: the tested choices were selectable, but other valid consequences may remain unavailable. Direct local HTTP hosting and physical iPad testing are outside the Chromium fixture's scope. Browser save restoration uses the existing supported test API, while all game actions are triggered through visible UI controls.

The source PDF, scenario graph, counter faces, common B4M CRT, accepted v457 City dots, all five map exports, and other gameplay code remain unchanged from v459. This checkpoint adds test and audit coverage only. The highest-priority follow-up is complete legal post-roll consequence selection and remaining Arduous stacking edge cases; Kiev scenario integration and Kiev–Odessa remain active. The optional B4M stacking experiment is second-to-last deferred, with the unified campaign last.
