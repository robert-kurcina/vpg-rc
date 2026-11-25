#!/usr/bin/env python3
"""Compatibility regression: the v447 visibility check is superseded by the
v453 actual-raster test for the current black dotted city-highlight style."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('city-black-dots-raster-v453.py')),run_name='__main__')
