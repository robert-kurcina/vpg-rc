# Checkpoint 278 / v512 — Fleet in the shared Support Window

## User-facing implementation

The existing movable, collapsible and dockable Air Support Window is extended
as a single **Support** utility window in scenarios with both Air Corps and
Fleet markers. The existing Kiev, Arduous and generic shell interfaces retain
their original Air Support behavior.

The Target: Leningrad experimental historical browser now displays:

- A separate **Air Corps** section with photographed FK I and FK VIII source
  counter faces. An available Air Corps has a **Strike Fleet** button *only* if
  an exact `declare-fleet-attack` action exists in the verified legal-action
  catalogue. Its Shift Rating is explained separately: the naval strike hits
  on d6 <= rating. This is not a CRT column shift for the Fleet attack.
- A **Fleet** section with the original Baltic Sea Fleet printed front face,
  or its original DAMAGED reverse when the authoritative support-marker state
  is damaged. It shows the currently occupied registered port and conditional
  combat-support modifier; it does not invent rules from the visual marker.
- **Finish naval air-attack window** while that exact action is legal.
- During the Soviet Special Movement Phase, buttons to move the Fleet only to
  source-certified ports for which the campaign controller exposes an exact
  `declare-fleet-move` action. The destination is committed before the damage
  die. Dice are rolled in the existing combat controls.
- Where source-validated forced-port actions are exposed, the same window can
  present them. Source-bounded post-roll Fleet consequence lists remain in the
  existing authoritative catalogue, with a count in the Support Window; no
  alternate result-selection algorithm or automated die is introduced.

The source Fleet marker identity uses its scenario-configured marker key and
front/back counter face IDs, not hard-coded scenario-ID rendering.

## Rules and state isolation

The Fleet's original source rules are in `references/rules/leningrad-rules.pdf`
§§13.1–13.3 and source `maps/combat-configs/leningrad.json`.
`core/historical_port_support.js`, `core/historical_air_support.js`,
`core/historical_campaign_action_catalog.js` and the actual campaign session
remain authoritative. No Fleet or Air rule is reimplemented in the UI.

The 22 source-photo counter crops now include the Fleet's undamaged and DAMAGED
faces (and the extra Odessa diagnostic naval marker faces). These are exact
bitmap crops from the supplied original counter sheets. The Fleet window's
position/collapse state remains browser-only presentation data, outside saves.

## Actual-engine verification

`tests/fleet-support-window-browser-v512.py` runs the real Leningrad human
campaign inside Chromium. It checks the initial Undamaged Fleet at Leningrad,
source image resolution, legal German air-to-Fleet strike, precommitted naval
die and air-use history, Undo and save/restore; then moves the actual campaign
through the published phase sequence to Soviet Special Movement, commits one
of five source-legal Fleet destinations, resolves d6=1, sees the DAMAGED
reverse, saves/restores and undoes the Fleet transaction. Tablet docking also
passes.

`tests/support-window-source-art-v512.py` checks every one of the 22 counter
crops at exact pixel dimensions and equality to the corresponding source JPG.

All five map SVG/PNG exports, original PDFs and SVGs, movement/rules policy,
CRT, TEC and territory classification remain unchanged.

## Remaining

Kiev–Odessa is still diagnostic-only and non-playable. Its Black Sea Fleet
mechanics must be source-qualified and bound into the historical campaign
before its visual marker can legitimately be activated in gameplay.
