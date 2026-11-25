# Checkpoint 42: Shared browser setup, replacements, and reinforcement

Two Chromium windows run identical user actions against the bundled default
B4M UI and the opt-in persistent `WargameSession` pilot. `tests/b4m-browser-session-setup-replacement-v317.py`
executes **32 matched state checkpoints**: 22 individual German deployment map clicks,
setup confirmation, two Undo operations, a replacement restore and Undo, and
1st Shock Army placement and Undo. Replacement and reinforcement tests begin
from controlled game states, but use actual generated UI buttons.

The test does not establish direct parity against the live upstream Oberlabs
website. The game engine and printed map/counter artwork are unchanged.

Outstanding: phase-Undo used-unit-set discrepancy, mixed-action history and
AI/import-export ownership, incomplete historical scenario execution.
