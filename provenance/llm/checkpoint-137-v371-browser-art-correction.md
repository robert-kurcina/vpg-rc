# Checkpoint 137: Invalid v370 browser screenshot corrected

The v370 isolated Chromium fixture served source JSON but did not serve image bytes. `core/native_browser_view.js` passed relative PNG and SVG URLs into the shared map renderer; `about:blank` could not resolve those. Flat-color terrain, absent fort art, and missing city-hex yellow outlines were therefore observed. The original screenshot is retained in `retired-visual-evidence`.

The v371 browser source still calls `HexTerrainTiles.svgMap` for every map layer. Artwork is loaded from the configured project asset paths, validated and embedded using data URIs, exactly as for the universal Node exporter. No independent renderer or image generator was used. All 40 expected art images decode. A Chrome-generated baseline SVG (removing only the interactive game-unit/click layer) rasterizes with zero different pixels versus `exports/battle-for-moscow.png`. Missing or corrupted assets are fatal to browser preview initialization.

Browser evidence was collected by real Chromium executing actual browser JavaScript and the original source image bytes, served through an isolated DOM fixture because local hosted navigation returns `net::ERR_BLOCKED_BY_ADMINISTRATOR`. This verifies DOM and image correctness under test, not production hosted-browser operation.
