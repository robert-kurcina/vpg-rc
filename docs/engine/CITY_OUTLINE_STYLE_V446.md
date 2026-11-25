# Checkpoint 212 / v446 — Inset dashed city borders

Adjusted the shared city-hex highlight so the orange dashed border sits **within** the city hex rather than outside it.

## Style
- stroke: `#ed8d30`
- opacity: `.95`
- width: `4.5`
- dash: `10 4`
- geometry: inset polygon within the hex

## Scope
This replaces the previous outside-grid treatment. Battle for Moscow no longer uses the separate `city-hex-highlight.svg` artwork path for map exports; all maps now share the inset polygon renderer. Gameplay and city classification are unchanged.
