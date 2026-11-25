# Historical counter-first deployment UI (Checkpoint 171 / v405)

The generic historical browser UI uses `core/historical_browser_app.js` with the authoritative `core/historical_deployment_session.js`; this is not a scenario-specific rules fork. The configured scenario determines allowed starting groups, markers, occupancy, and counter source pools. `core/scenario_starting_setup.js` validates every proposed resulting deployment before it may replace the current one.

## Interaction contract

1. Click a deployed map counter, indicated by the official SVG's amber selection outline. Click another deployed counter to call `swapPositions()` (only when both assigned positions differ) or an eligible reserve counter to call `swapFaces()`.
2. Click a reserve counter first, then a deployed map counter for the same source-face exchange. Reserve-to-reserve clicks only change which reserve counter is selected.
3. Click a marked hex with a selected map counter to call `move()`. Existing marker/occupancy and army nonadjacency validation applies. Clicking the selected counter again or pressing Escape cancels without mutating game state.
4. Optional pointer dragging between map map / map reserve / reserve map / map hex uses the same click-handler semantics. Pointer movement on a counter above nine viewport pixels initiates the gesture; dropping outside legal targets has no effect. A drag's incidental follow-up click is suppressed only when it targets that same drop item, not unrelated fast clicks.
5. Failures preserve the existing validated `deployment` snapshot, source allocations and positions. They retain selection for a second attempt and expose the caught validation error in the visible setup interface. A successful mutation clears selection and redraws board/pool.

## Counter pool

Starting-group configuration supplies nationality, formation kind, and size. The inventory reports eligible printed source faces. The pool lists front-side counter artwork (official SVG vector templates), excluding all currently deployed face IDs. In the current candidate Leningrad setup, all ordinary ground faces are allocated across initial groups and later-turn reinforcements; a reserve face is *already assigned* to a future reinforcement group. An exchange atomically swaps both identities across their source-allocation groups, and revalidates the complete result. No additional reinforcement is created, duplicate identity admitted, or game rule bypassed. Source pool grouping uses available starting-group pools; other scenarios require an inventory/configuration binding before using the browser.

Concealed Soviet Mechanized Corps always render the source-authorized front `*` / `?-6` values in both map and selection UI. `setupShuffle()` uses browser cryptographic random bytes and `Deployment.permute()` while preserving the existing mixing gate. Local source-face IDs and downloaded state are not protected against deliberate developer-tools inspection; this is a normal single-device gameplay concealment feature, not a secure multiplayer implementation.

## Verification and limitations

`tests/leningrad-counter-swap-browser-v405.py` runs actual isolated Chromium with authentic `exports/leningrad.svg`, official counter art, production source modules and browser interactions, substituting only local file transport with in-memory byte-equivalent JSON. The test includes physical mouse/pointer drags as well as direct click dispatch for overlapping official stacked counters. It exercises the full validator, reserves, reverse swap, illegal attempts, cancellation, shuffling and campaign start. Source rendering/CRT/engine modules are preserved byte-for-byte from v404.

Unresolved: historical starting identity proof, two printed-to-host hex discrepancies, full independently supervised human/AI eight-turn acceptance, hosted HTTP browser validation, and completion of all historical games. The broader Oberlabs UX parity remains intentionally deferred.
