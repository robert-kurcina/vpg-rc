#!/usr/bin/env python3
"""Rebuild immutable browser copies from canonical JSON; no game-specific roster logic."""
import json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
paths=['maps/rosters/registry.json','games/battle-for-moscow/units.json','maps/counter-configs/battle-for-moscow.json']
files={p:json.loads((root/p).read_text()) for p in paths}
sha256={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in paths}
target=root/'maps/rosters/browser-data.js'
target.write_text('// Generated from canonical JSON by tests/build-browser-roster-data.py; do not edit manually.\nwindow.WargameRosterBrowserData='+json.dumps({'files':files,'sha256':sha256},separators=(',',':'))+';\n')
print('Generated',target.relative_to(root))
