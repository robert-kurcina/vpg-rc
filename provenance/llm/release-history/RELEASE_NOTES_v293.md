# v293 — Coast halo, reinforcement layering and appearance

- The registered Coast shoreline dark stroke is now omitted only where its facing neighboring cell is authored Sea. Coast wavelet fill and inland water outlines stay unchanged.
- Reinforcement lines are emitted as layer 0, underneath opaque terrain, instead of layer 3.75 above coast and terrain. Both factions use the same mitered boundary algorithm and universal 20px widths. Their centerline exterior offset is reduced from half-width to 14% width, making the perimeter closer to and underneath the tiles.
- German deployment cross SVG artwork recolored to translucent German dark blue; its 25% white backing is preserved.
- Kiev–Odessa Open terrain bitmap appearance uses a translucent pale-green lighten overlay, preserving original bitmap texture and terrain rules; other maps do not receive that overlay.
- Source railways, hex numbers, sea cell topology, 36 deployments, and 261 composite hexes remain registered as in v292.
