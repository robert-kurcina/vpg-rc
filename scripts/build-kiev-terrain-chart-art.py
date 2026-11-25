#!/usr/bin/env python3
"""Build Kiev / Kiev–Odessa Terrain Effects Chart specimen art.

This wrapper delegates to the shared JavaScript renderer so every TEC sample is
an actual engine-rendered single-hex specimen derived from the source-backed
board data, not a crop from the full-board PNG export.
"""
from __future__ import annotations
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / 'scripts' / 'render-terrain-chart-specimens.js'

completed = subprocess.run(['node', str(SCRIPT)], cwd=ROOT, text=True)
raise SystemExit(completed.returncode)
