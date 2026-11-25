#!/usr/bin/env python3
"""Compatibility check: v453 black dots superseded by v454 dots over a bold city border."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('city-solid-dots-raster-v454.py')),run_name='__main__')
