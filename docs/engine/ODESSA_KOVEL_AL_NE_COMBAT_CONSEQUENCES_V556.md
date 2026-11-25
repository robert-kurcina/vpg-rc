# Checkpoint 322 / v556 — Kovel Attacker Loss and No Effect browser consequences

## Defect

The post-roll `Orders` button for an **Attacker Loss (AL)** in Kiev–Odessa could read **“No additional losses, retreat or advance”** even though the source-validated combat transaction reduced an attacking counter. A **No Effect (NE)** could flip an untried Soviet Mechanized Corps from its concealed face to its revealed one-step face, without the Orders button identifying that visual effect.

The shared campaign engine, B4M CRT, and one-step/step-loss adjudication were already correct. This was a presentation omission in the human post-roll action catalog and browser label formatter, not a new combat rule.

## Implementation

- `core/historical_campaign_action_catalog.js` now retains the existing authoritative combat receipt's `revealed` counter IDs alongside already retained losses/retreat/advance metadata in each read-only candidate result.
- `core/historical_campaign_human.js` exposes `optionEffects` in the same order as the existing `options`. **Only the original `options` actions** are eligible to commit; metadata cannot be submitted or incorporated into the signed campaign action transaction. The pending-die state remains authenticated by the original save envelope.
- `core/historical_browser_app.js` renders consequence labels using the authoritative receipt: **Reduced**, **Eliminated**, **Revealed**, Retreat, and Advance as applicable. The AL fallback also recognizes `lossUnitId`. For untried reveal labels, it displays owner, counter class, and current hex, **not the concealed reverse combat values**.
- Rebuilt `core/historical_engine_browser_bundle.js` from the same CommonJS source modules. There is no scenario-specific duplicate rules engine.

## Verified source-bound combat

This qualification uses the preexisting real Kovel `0502` battle: German original 6–4 Infantry Corps from `0402` attacking the untried Soviet Mechanized Corps in Kovel. The source-bound common B4M CRT gives:

| d6 | Outcome | Actual shared-engine consequence |
|---|---|---|
| 6 | AL | German Infantry reduced to its printed **3–4** reverse; Soviet Mechanized Corps revealed on its printed one-step reverse; no Kovel capture |
| 4 | NE | No losses or displacement; Soviet Mechanized Corps revealed; no Kovel capture |

The live browser uses its standard manual die selector and visible Orders button, and shows the counter faces on the original exported shared-renderer map. Both outcomes pass pending Save/Restore, committed Save/Restore, and Undo back to the pre-roll state. Node tests additionally reject attempts to choose an action for a different committed die and confirm that source counter strength is not exposed in the read-only label metadata.

## Tests and evidence

- `node tests/odessa-kovel-attacker-loss-and-reveal-v556.test.js`: **50 assertions PASSED**
- `python tests/odessa-kovel-al-ne-browser-v556.py`: **56 Chromium assertions PASSED**
- Existing `tests/odessa-source-city-recapture-v551.test.js`: **181 assertions PASSED**
- Existing `tests/odessa-source-city-recapture-browser-v555.py`: **54 Chromium assertions PASSED**
- Existing seven-turn selected-face integration: **166 assertions PASSED**
- Human decision gateway: **37 assertions PASSED**; immutable catalog cache: **18 PASSED**; transaction probe: **154 PASSED**
- Retreat map model: **18 PASSED**; approved retreat style: **10 PASSED**
- Source preservation: **280 protected files compared, zero differences**. Historical source maps, original source SVGs and photos, map exports, counter templates, combat logic, CRT, movement policy, and accepted sharp light-blue retreat arrows/blue inset destinations are unchanged.

Actual engine Chromium screenshots:

- `rules/audit/visual/odessa-kovel-al-orders-v556.png`
- `rules/audit/visual/odessa-kovel-al-resolved-v556.png`
- `rules/audit/visual/odessa-kovel-ne-orders-v556.png`
- `rules/audit/visual/odessa-kovel-ne-resolved-v556.png`

## Boundaries

This qualifies two distinct original-map combat outcomes at Kovel. It does **not** certify exhaustive post-roll choices, the unverified national territory masks, historical naval evacuation activation, or a fresh uninterrupted seven-turn Chromium campaign for v556. The previously certified full-length paths are not expanded by these tests. The engine is still experimental where source authority remains missing.
