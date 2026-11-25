# Checkpoint 279 / v513 — shared counter-first Support map assignment

## User-approved interaction standard

The historical human browser now uses the same **legal-hex highlight → map click**
pattern already established for reinforcement entry, replacement rebuilding and
resupply. The common Support Window is the starting point:

1. Select an available Air Corps or Fleet counter **by its entire row, including
   its source-photo counter face**. This changes presentation selection only.
2. The browser projects the **existing, current engine-legal actions** to their
   target hexes. Blue highlights use the same map overlay and accessibility
   conventions as reinforcements. No range or eligibility is calculated by the UI.
3. When those targets become available, the panel collapses to uncover the map.
   If a battle must first be declared/selected, the panel explains why no
   targets appear. Selection can be made before that declaration and retained.
4. Selecting a highlighted hex **stages**, but does not commit, the action.
   The Support Window reopens with the destination, action and Confirm/Cancel.
5. Confirmation submits the exact action from the authoritative catalogue,
   preserving standard combat/Fleet die timing, Undo and saved state.

Escape or Cancel clears the presentation selection; it cannot affect combat.
The general engineering Orders catalogue still contains the underlying
source-validated actions for AI/diagnostics, but Support-specific buttons are
not redundantly presented in ordinary historical play.

## Supported projections

- Ground Air Support: only the currently **selected and declared** battle's
  defender hex when `commit-ground-air` for that exact counter is legal.
- Naval air strike: the current Fleet port hex when `declare-fleet-attack`
  for the selected Air Corps is legal.
- Fleet movement or forced port: each exact destination from current
  `declare-fleet-move` / `commit-forced-port` actions.
- A hex with multiple legal action types requires an explicit choice at
  confirmation; the UI never silently picks an action.
- Ineligible or unclassified destinations do not produce highlights.

The shared support map model is `core/historical_support_target_map_ux.js`,
following the existing `core/historical_buildup_map_ux.js` pattern. It does not
modify the shared game engine, action catalogue, CRT or source geography.

## Devices and accessibility

- Desktop: click counter or row, see highlighted map hexes, click one, confirm.
- Tablet: docked Support Window is compact by default; selecting a legal
  Support target collapses the sheet and reopens it for confirmation.
- Counter selection and map target hexes are keyboard-operable; Escape cancels.
- Window dragging/collapsing/hiding is presentation state only.

## Evidence and limits

- Pure projection checks: 15 assertions, including face identity, mixed air and
  naval legal actions, exact Fleet destinations and no invented targets.
- Real Chromium checks: 72 assertions across Arduous ground air, Leningrad
  naval air and Fleet movement, as well as tablet controls, Undo and restore.
- Kiev experimental browser: source counters selectable and engine initialized;
  no target is manufactured before battle declaration.
- Earlier v511/v512 UI tests expecting one-click `Assign` and individual Fleet
  destination buttons are superseded by the new counter-first tests; their
  gameplay results remain valid, but their old UI selectors are no longer live.
- The generic mechanics-lab shell retains its older direct Support control;
  historical scenario browsers now share the new interface. Live Kiev–Odessa
  remains non-playable and Romanian Air/Black Sea Fleet support is not activated.

## Unchanged

Original five map exports (SVG + PNG), TEC, original source counter sheets,
combat rules, Fleet rules, scenarios and adjudicated territory data.
