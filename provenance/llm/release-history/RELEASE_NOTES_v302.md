# v302 — Leningrad source-geometry corrections

- Removed 2001 and 1801: neither grid placeholder has an Open, Forest, Swamp, or Sea symbol in the authoritative SVG. 197 terrain-authored cells remain.
- Registered each of the 53 coast source segments to the actual hexside, preserving source path identity and 0–1 px geometry error instead of dropping all but 12 sides.
- Replaced graph-sampled railway artwork with 14 exact authored SVG polylines; original 80 provisional graph links remain audit-only and must not be mistaken for verified gameplay rail connections.
- Preserved authored terrain, city, deployment, reinforcement and river data pending separate game-rule certification.
- All renderings use existing universal JavaScript engine, not source-preview artwork or image generation.
