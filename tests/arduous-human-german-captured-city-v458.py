#!/usr/bin/env python3
"""Complete captured-city browser acceptance in two independent Chromium stages.
Stage 1 creates a genuine browser JSON save; Stage 2 restores that exact save and performs the Soviet counterattack; Stage 3 restores the next save,
performs German Turn-4 city rebuild, and tests Undo/replay.
No synthetic events, direct state mutations or off-engine map rendering.
"""
from pathlib import Path
import subprocess,sys,json
ROOT=Path(__file__).resolve().parents[1]
for stage in ('stage1','stage2','stage3'):
 script=ROOT/'tests'/f'arduous-human-german-captured-city-v458-{stage}.py'
 subprocess.run([sys.executable,'-u',str(script)],check=True,cwd=str(ROOT),timeout=260)
report=json.loads((ROOT/'rules/audit/arduous-german-captured-city-v458.json').read_text())
assert report['checks']>=200 and report['saveRestore']=='identical' and report['replay']=='identical'
print('PASS v458 captured-city browser suite:',report['checks'],'combined assertions, actual browser save between stages',flush=True)
