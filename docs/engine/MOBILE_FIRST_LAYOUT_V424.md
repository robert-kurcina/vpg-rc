# Mobile-first game shell — v424

The three playable historical browser UIs (Battle for Moscow, The Arduous Beginning, Target: Leningrad) use one shared layout controller: `core/responsive_game_shell.js` and `core/responsive_game_shell.css`. It does not copy map drawing logic or modify any legal-action routing, CRT outcomes, counter art, saved campaign states, or source geometries.

## Automatic detection and manual choice

The controller defaults to `auto`, choosing mobile mode for narrow screens (at most 700 CSS pixels), a primary coarse pointer, hoverless tablet-size devices, or multi-touch hardware at tablet widths (to recognize iPadOS with a trackpad). Ordinary pointer-fine desktops begin in desktop mode. Detection is approximate; it is not a browser identity test.

Settings > Interface layout > **Desktop mode** enables the previous full sidebar, map-help text, and separate zoom toolbar. Turning it off forces mobile mode. **Use automatic detection** clears the override. Preference values (`auto`, `mobile`, `desktop`) are browser-local and shared across games on the same origin, but never entered into game saves. A resize re-evaluates automatic mode. Settings are functional without browser storage; persistence may not work in a restricted file context.

## Mobile layout

The map fills the available viewport beneath a compact header. Instructions, legends, and diagnostics that formerly occupied a large amount of vertical space are hidden in map mode; source limitations from Arduous's warning banner remain available in the controls drawer under a collapsible disclosure. The map starts horizontally centered when zoomed on touch screens to avoid opening on a mostly empty geographic corner. The map-stage and SVG transform remain untouched.

A floating `−`, `Fit`, `+` group replaces the full-width controls; the percentage readout is visually suppressed, not removed from accessibility APIs. A **Controls** button opens the existing gameplay sidebar as a bottom sheet, with the same Play/Settings tabs and the existing unit orders. **Close**, tapping outside the sheet, and Escape return to the map. The closed sheet is made inert and hidden from assistive technology. On desktop all existing controls, labels, and the original layout remain visible.

Single-finger counter taps and two-finger panning use the existing `map_touch_navigation.js`, which remains the only touch controller. User interactions do not alter a game's state until a legal action is chosen. The controls drawer never duplicates or rerenders the map.

## Acceptance and limits

- `python tests/mobile-first-shell-v424.py`: 10 Chromium combinations: iPad portrait/landscape and 1600px desktop on all three games, plus a 390px phone run on Arduous. Exercises mode detection, side panel accessibility, compact zoom dimensions, Settings toggle, forced layout changes, automatic reset, and no JS exceptions.
- Updated `tests/tablet-responsive-browser-v423.py` and `tests/two-finger-pan-browser-v423.py` validate the 2023-touch interactions against the current map-first layout. Both passed; the latter exercises two-axis pan at a zoom sufficient for vertical overflow and a post-pan counter tap with the drawer closed.
- Existing Leningrad click-to-swap Chromium regression passed; selected Node tests for the shared CRT, all-five counter geometry, Arduous geometry/opening, and human action gateway passed.
- A combined repeat of the ten-mode browser test after the click/swap regression timed out after nine completed cases in this execution environment; the full ten-mode test had already passed independently twice earlier in this checkpoint.
- The five-map diagnostic viewer retains its existing separate Settings tab and touch navigation. This new bottom-sheet layout covers the three playable game browsers, not the viewer or home catalog.
- Actual physical iPad Safari remains unverified; browser acceptance uses Chromium touch emulation.
