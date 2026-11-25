# Checkpoint 210 / v444 — Kiev §10.8 original setup enforcement and Romanian source audit

## Governing sources

- `references/rules/kiev-rules.pdf`, printed page 5, §10.8: the **four Axis units initially placed in Romania** may not attack on Turn 1; only Soviet units **originally deployed** at 0708, 0808 or 1110 may attack Axis forces **in Romania** during Turn 1.
- `references/rules/kiev-rules.pdf`, printed page 2, §6.0(7): Romanian initial Axis setup slots: 0709, 0809, 0910 and 1010.
- `maps/kiev.json` and `maps/source/kiev-map-scan.jpg` preserve the corresponding approved source-registered hexes and deployment symbols. Their SHA-256 values are recorded in the audit JSON.

## Corrected shared-engine rule

Before v444, `core/historical_combat_declarations.js` rejected a restricted German attack by looking only at the unit's **current** hex. The printed rule concerns where the German unit *set up*, so this admitted a bypass if an imported or out-of-sequence game state moved the unit before its first attack.

Now the configurable Turn-1 restriction uses `unit.openingHex`, which was preserved by v443. Any first-turn attacker in a scenario with this option enabled must have a valid original board hex, otherwise the declaration is rejected. The first-turn rule still ends after Turn 1, and scenarios without the option are unchanged. The browser module has been rebuilt from the same shared code.

This is implemented in the common declaration engine, not a Kiev-specific branch. Kiev is **not** activated by this change.

## Source-supported geographic findings

- **Four known Romanian Axis starting positions:** `0709`, `0809`, `0910`, `1010`.
- **Three known eligible Soviet initial positions:** `0708`, `0808`, `1110`.
- The three Soviet origin hexes each neighbor at least one of the four Romanian setup hexes in the existing Kiev grid; this is a topology validation only, **not** a reconstruction of the full national border.
- The source map does not expose an existing, complete registered layer identifying **all** Romanian territory hexes. The seven initial-position facts are insufficient to prove which other hexes are or are not in Romania.
- `161` of the `165` Kiev cells are therefore **unclassified as possible Romania targets** in this audit. *Unclassified* does **not** mean that all 161 are plausible Romanian cells; it means they have not been assigned a certified national ownership label. Do not promote this data to `firstTurnTerritorialRestriction`.

`rules/audit/kiev-romania-territory-evidence-v444.json` is read-only, source-pinned evidence, not a playable territory mask. `scripts/audit-kiev-territory-v444.js` regenerates it; `scripts/export-kiev-romania-diagnostic-v444.js` adds a transparent diagnostic overlay to the real game-engine SVG, creating an annotated image without altering the approved map.

The visual diagnostic at `rules/audit/visual/kiev-romania-evidence-v444.png` marks **orange dashed** Romanian Axis setup hexes and **blue dotted** eligible Soviet origins. These outlines **do not define a political boundary**.

## Checks

- New v444 source/eligibility tests: **27 assertions** passed.
- Existing v442 first-turn rules: **45** assertions passed.
- Existing v443 original setup/territorial candidate: **100** assertions passed.
- Kiev source movement: **2,949** assertions passed.
- Kiev 30-unit opening fixture: **180** assertions passed.
- Kiev reinforcement inventory: **289** assertions passed.
- Kiev 4th Mechanized exclusion: **24** assertions passed.
- Relevant shared combat/campaign and earlier geographical regression tests passed. No full seven-turn *Kiev* campaign test is claimed.
- Accepted v441 terrain bitmap art and five map exports remain unchanged.

## Remaining gate

A complete, source-adjudicated Romanian territory mask and remaining Kiev campaign certification. Do not mistake an initial deployment region for a complete territory classification or open the Kiev gameplay gate on this basis. Kiev–Odessa remains independently gated.
