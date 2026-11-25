#!/usr/bin/env python3
"""Execute all eight candidate Leningrad turns in fresh Chromium stage processes.

A stage boundary exercises save/restore across distinct JS/Chromium contexts.
Each subprocess terminates before the next stage, limiting browser memory and
allowing the same suite to run under resource-constrained test environments.
This tests gameplay continuity, not historical setup certification or AI skill.
"""
import argparse, json, subprocess, sys, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TEST=ROOT/'tests/leningrad-eight-turn-browser-v406.py'
AUDIT=ROOT/'rules/audit/leningrad-full-browser-v406.json'
parser=argparse.ArgumentParser()
parser.add_argument('--sides-per-stage',type=int,default=2)
args=parser.parse_args()
if not 1<=args.sides_per_stage<=3:
    parser.error('Stages are intended to use 1, 2, or 3 side-turns')
with tempfile.TemporaryDirectory(prefix='leningrad-browser-v406-') as tmp:
    state=Path(tmp)/'progress.json'
    for stage in range(25):
        cmd=[sys.executable,str(TEST),'--output',str(state),'--max-sides',str(args.sides_per_stage)]
        if stage:cmd+=['--resume',str(state)]
        subprocess.run(cmd,cwd=ROOT,check=True)
        progress=json.loads(state.read_text())
        print(f'Checkpoint 172 stage {stage+1}: {len(progress["trace"])} side-turns, '
              f'{progress["humanActions"]} human inputs, '
              f'{progress["snapshot"]["actionCount"]} committed actions',flush=True)
        if progress['snapshot']['cursor']['complete']:
            assert len(progress['trace'])==24
            assert progress['humanActions']==8
            assert progress['undoReapplies']==2
            evidence=json.loads(AUDIT.read_text())
            assert evidence['status']=='PASS' and evidence['terminal']['outcome']=='soviet-victory'
            assert evidence['totalCampaignActions']==progress['snapshot']['actionCount']
            assert evidence['pageErrors']==[]
            print('PASS v406: 8 German human inputs, 24 side-turns, Turn-8 terminal replay')
            break
    else:
        raise AssertionError('Eight-turn run never completed within 24 side-turns')
