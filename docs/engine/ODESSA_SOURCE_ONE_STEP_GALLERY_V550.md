# Checkpoint 316 / v550 — source-accurate one-step counter presentation

## Finding

The shared counter-face projection previously mapped every `printed-reduced` runtime status to the authored damage bar. This misrepresented three **one-step, single-sided Odessa cavalry counters**: the authentic playable face is printed on the physical reverse, the front is blank, and the runtime uses `printed-reduced` only to select that reverse face. The authoritative combat consequences already identify these source-gated exceptions as one-step (`face: "one-step", reduced: null`), eliminating them upon a step loss; no combat rule change is needed.

## Implementation

`core/historical_counter_face_projection.js` now recognizes **only** the existing source roles `blank-face-of-single-sided-cavalry-counter` / `single-sided-cavalry-printed-face` plus the corresponding source face kinds. For that pair, it preserves the reverse `faceId`, original color, values, and runtime `strengthStatus` while emitting an un-damaged shared SVG rendering. Ordinary `printed-reduced` units still display the existing face-aware red (or white-on-red) damage stripe. `revealed-one-step` Mechanized Corps remain unmarked by the damage stripe.

The repeatable `scripts/render-kiev-odessa-counter-gallery-v550.js` draws every face from the **same** shared SVG renderer and live Support vector renderer. Its distinct panels cover the 36 original opening ground counters, six scheduled reinforcement units, the one replacement-only Soviet Army, and four Support/Fleet faces. The right column means `Reduced`, `Revealed (one-step)`, `REFIT`, `Damaged`, or `Eliminated (no reduced face)` as applicable—not uniformly damaged. No photographed crop or fabricated reverse face is used.

## Verification

- **127 Node assertions**: source face-pair identity, all three reverse-only cavalry units, ten concealed/revealed Mechanized Corps, remaining counter categories, and seven later ground faces.
- **30 Chromium assertions**: 47 source units in the actual HTML/SVG renderer, absent invented damaged faces, genuine two-step damage indicators, vector Support art, and a 375px responsive rendering.
- **24 Chromium assertions**: actual game at Romanian cavalry hex `1010`, with correct source pale-blue field and no false damage stripe.
- **48 existing Romanian field-color Node checks, 204 shared red/white damage-bar Node checks, 166 selected-infantry seven-turn Node assertions, 98 mixed campaign Node assertions, 50 Odessa Turn-2 buildup assertions, and 69 Kiev contested Kovel assertions** pass.
- **146 protected source, source-map, approved export, original counter template, and combat-engine files remain byte-identical** to checkpoint 315. No terrain, CRT, campaign adjudication, or approved two-tone retreat style changes.
- The older browser-wide red-counter regression exceeded its execution limit in this environment, so it is **not counted as a pass** for this checkpoint.

## Scope and pending work

This is a display accuracy correction, not historical gameplay certification. The Kiev–Odessa scenario remains experimental. Naval evacuation still awaits original §15.3 phase authority, Romanian/Hungarian country boundaries remain incomplete, and rare/adversarial combat branches need additional acceptance.

Gallery HTML: `rules/audit/visual/kiev-odessa-source-counter-gallery-v550.html`. Actual Chromium screenshot: `rules/audit/visual/kiev-odessa-source-counter-gallery-v550.png`.
