# Checkpoint 277 / v511 — Shared Air Support Window

## Implementation

The historical Kiev, Arduous, and Leningrad browser games now display a common
nonmodal **Air Support Window**, using `core/support_window.js` and
`core/support_window.css`. The generic game shell uses the same component for
configurations that register air support. No additional server or rules engine
has been introduced.

- **Desktop:** move the window by its title bar; collapse to its header; hide it
  and reopen it from the Air Support launcher. Alt + arrow keys while the header
  has focus repositions the window (Shift increases step size). The UI clamps
  position to the viewport on resize.
- **Touch/smaller screens:** dock to the lower edge, initially collapsed to a
  compact bar. Tapping expands it; the game's separate mobile controls drawer
  takes precedence when open.
- **Persistence:** panel position and visibility preferences use local browser
  storage, scoped per historical scenario. They are never part of campaign
  saves or rule adjudication.
- **Source artwork:** `scripts/build-support-counter-art.py` crops 16 original
  photographed front/back air counter faces without rescaling or recoloring.
  The displayed marker is the original source counter, not a fabricated icon.
- **Rule status:** available, assigned/committed, REFIT, and not arrived are
  derived from the source marker policy and immutable campaign snapshot. The
  presented REFIT face is the photographed reverse when the policy registers it.
  The Romanian Rom I AK marker remains **diagnostic-only**, since Kiev–Odessa
  gameplay is not yet enabled.
- **Action contract:** the historical Support Window offers *only exact*
  `commit-ground-air` actions already supplied by the authoritative legal-action
  catalogue. The same human-session `choose()` transaction processes them.
  These decisions are immutable after locking, serialize normally, and can be
  undone through the existing shared game session. No UI-specific air-use
  flag, alternative odds table, or additional die roll was added.
- **Unrelated scenarios:** when a game does not register Air Support, no
  support panel is mounted; the generic game shell suppresses it entirely.

## Verification

`tests/shared-support-window-browser-v511.py` uses actual embedded, source-
configured Arduous and Leningrad campaigns in Chromium. It checks drag,
collapse/open, close/reopen, desktop/map interaction, tablet docking, source
photo rendering, legal pre-roll assignment, save/restore, and Undo.

`tests/kiev-support-window-browser-v511.py` checks the actual experimental
Kiev map, photographed FK IV/FK V markers, and initial non-commitability.

`tests/support-window-source-art-v511.py` compares every generated counter
pixel against the appropriate original JPG crop (16 faces).

No shared CRT, historical map renderer, approved map export, river/terrain
classification, game-rule config, or printed source has changed.

## Remaining work

The future Kiev–Odessa playable browser must bind the diagnostic Romanian
REFIT marker and reinforcement schedule before presenting it as live. Fleet
support remains a separate rules/mechanics feature, not part of the Air
Support Window's present action set. Avoid claiming five historically playable
configurations.
