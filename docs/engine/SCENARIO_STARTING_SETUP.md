# Shared initial-setup validator — Checkpoint 123 / v357

**One code path:** `core/scenario_starting_setup.js` implements the same
source-marker occupancy, counter-face, stacking and group-adjacency checks for
any scenario with a typed setup configuration. It reads scenario-specific
formation types, marker capacity, initial roster groups, and rulebook print
anchors **only** from configuration. No game-ID-specific logic is present.

**Leningrad configuration:** `maps/setup/leningrad.json` specifies the seven
starting groups (19 counters), five Soviet front stars, five German deployment
crosses, and five fixed Soviet rear markers. The German crosses each require
one or two units, specifically four pairs and one singleton. Two Soviet
frontline armies must not be adjacent. Unit affiliation, type, source-face
identity and movement points are verified against the photographed counter
faces and the existing `leningrad_starting_inventory.js` allocation validator.

**Caller must supply:** `validate({map,spec,counterConfig,inventory,allocation,placements})`.
The `inventory` dependency is an adapter with `inspect(config)` and
`validateAllocation(config,allocation)` methods. Both are run on the current
counter configuration, rather than trusting a previously computed report.
`placements` is an explicit map from front-face ID to physical cell ID;
none are selected automatically. The response includes a candidate state
with **source-face IDs** (not authenticated historical formation IDs),
movement points and untried face status. It refuses to return any state when
occupancy or source checks fail. It does not permit production activation.

## Two real coordinate disagreements

The PDF §6.0(3) prints rear hexes `0107, 0607, 1305, 1606, 1701`.
The user-supplied SVG contains three fixed-infantry symbols and two
fixed-mechanized symbols. The assignment of individual PDF printed numbers
to these markers follows the existing source-registered positions and the
class/geographic ordering; the source SVG contains **no printed coordinate
text**, so this association is not independently certified by the SVG.
On the **already-approved production map**:

| Rules PDF | Source symbol | Runtime cell | Number currently rendered | Agreement |
|---|---|---|---|---|
| `0107` | `use503` | `0208` | `0107` | yes |
| `0607` | `use1-19` | `0707` | `0607` | yes |
| `1305` | `use1-50` | `1406` | `1306` | **no** |
| `1606` | `use1-79` | `1706` | `1606` | yes |
| `1701` | `use504` | `1802` | `1702` | **no** |

The displayed `1305` corresponds to unmarked runtime `1405` and displayed
`1701` does not resolve to a terrain-backed runtime cell. Changing the
approved map or silently shifting the symbols would violate user approval.
The physical source-symbol setup is **testable**, but independent historical
coordinate certification is incomplete. The conflict remains open; do not
claim a source-certified playable game on this basis alone.

**Test-only selections:** `tests/fixtures/leningrad-source-setup-v357.js`
chooses one illustrative set of eligible counter faces and one legal stacking
pattern solely for testing. It is not a historical adjudication of which
formation gets which start hex, and must never become a production default.

**Run:** `node tests/scenario-starting-setup-v357.test.js`,
`node tools/audit-leningrad-source-setup-v357.js`.
Audit: `rules/audit/leningrad-source-marker-setup-v357.json`.
