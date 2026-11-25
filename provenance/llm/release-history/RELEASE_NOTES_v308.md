# v308 — Leningrad printed coordinates and Liepāja Coast correction

- Leningrad first printed column shifts its row numbers down by 1 in numeric value (Liepāja internal 0208 now displays 0107); other printed columns remain unchanged, without touching logical cell IDs or adjacency.
- Liepāja Coast now occupies hex faces 1 (N), 5 (SW), and 6 (NW), conforming to clockwise numbering from the top face.
- Corrected the three corresponding authored coastline polyline vertices and semantic authoredShoreHexsides; original source SVG is preserved.
- This correction was explicitly supplied by the user and takes precedence over the imported source path locally.
- Other map configurations and gameplay rail/terrain data are unchanged.
