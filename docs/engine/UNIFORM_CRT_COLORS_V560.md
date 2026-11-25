# Uniform CRT outcome colors

**Checkpoint 325 / v560 — uniform CRT outcome colors.** Both browser CRT modes use one shared outcome palette: EX #FF9900, AL #FF2000, NE #FFFFFF, DR #CCCCCC, DE #555649, DRL #B8BAA9. AL and DE use white text; all others black. Headers retain alternating shading. No result-cell striping, rules changes or default changes. Verified 301 Advanced Node assertions, 36 Standard cells across five mappings, and 108 native B4M plus 123 historical Kiev–Odessa Chromium assertions including exact palette checks of all 168 cells, variant toggles and save/restore. Full campaign replay not repeated. See `docs/engine/UNIFORM_CRT_COLORS_V560.md`.

Browser evidence: `rules/audit/visual/{standard,advanced}-crt-{b4m,kiev-odessa}-v560.png`. The v559 reference-color tests and screenshots are retained as historical evidence; use the v560 tests for the approved palette.
