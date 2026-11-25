# Checkpoint 94 visual-evidence correction — 2026-11-19

An assistant response accompanying checkpoint 94 mistakenly displayed an unrelated external GMT Games illustration under the heading "Actual engine render". That **chat-displayed image is not a game-engine output** and has no evidentiary authority for this project. It must never be incorporated into map validation, rendered screenshots, provenance, assets or future reports.

**Archive audit:** The external illustration, associated URL and source provenance were not present in the original v327 ZIP. No external image was therefore deleted from the project files. This corrected archive retains the independently verified in-archive local diagnostic `rules/audit/visual/leningrad-engine-render-v327.png` (SHA-256 `b6570f10e7a84724b4b4003f4f644b877e351b4ef39a2b705054ff97fcc8a9d2`) as well as `exports/leningrad.svg` and `exports/leningrad.png`. Those are not the image that appeared in the chat; their contents and source derivation must be checked from code before relying on them for further map certification.

The correction does not certify map accuracy, 197-vs-199 cells, historical game setup, or source-to-hex alignment. These remain separate development gates.
