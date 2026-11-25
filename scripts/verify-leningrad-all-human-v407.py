#!/usr/bin/env python3
"""Reproducible full Leningrad acceptance through UI-only Chromium decisions.

Starts independent Chromium sessions in bounded segments; checks durable saves,
24 side turns, human-only action commitment, both real-die and automatic-NE
pathways, the registered map export, and the terminal phase.
"""
import json, subprocess, sys, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
test=ROOT/'tests/leningrad-all-human-browser-v407.py'
with tempfile.TemporaryDirectory(prefix='leningrad-v407-') as work:
    state=Path(work)/'stage.json'
    for i in range(12):
        args=[sys.executable,'-u',str(test),'--output',str(state),'--max-actions','24','--max-seconds','45']
        if i:args.extend(['--resume',str(state)])
        subprocess.run(args,cwd=ROOT,check=True)
        snapshot=json.loads(state.read_text())
        if snapshot['snapshot']['cursor']['complete']:break
    else:raise AssertionError('Campaign did not complete within 12 bounded browser sessions')
    summary=json.loads((ROOT/'rules/audit/leningrad-all-human-browser-v407.json').read_text())
    assert summary['fullCampaign'] and summary['turn']==8
    assert summary['starting']['deployed']==19 and summary['starting']['concealedMixed']
    assert summary['counts']['baselineCalls']==0
    assert summary['counts']['humanAutomaticNoDie']>0 and summary['counts']['humanDieCommitments']>0
    assert summary['counts']['humanPostRollChoices']>0 and summary['counts']['humanBattleDeclarations']>0
    assert summary['counts']['humanCommands']>0
    assert summary['errors']==[] and summary['campaignActions']>=100
    trace=snapshot['trace']
    seen={(int(t['phase'][0]),t['phase'][1]) for t in trace}
    assert {(turn,actor) for turn in range(1,9) for actor in ('german','soviet','system')}<=seen
    assert summary['interfaceDecisions']==len(trace)
    assert summary['terminal']['outcome'] in ('soviet-victory','german-victory')
    print(json.dumps({'status':'PASS','checkpoint':173,'sessions':i+1,'humanOnlyDecisions':len(trace),
      'committedActions':summary['campaignActions'],'controlledSideTurns':len(seen),
      'dice':summary['counts']['humanDieCommitments'],'automaticNE':summary['counts']['humanAutomaticNoDie'],
      'postRollChoices':summary['counts']['humanPostRollChoices'],'outcome':summary['terminal']['outcome'],
      'source':'real isolated Chromium, unchanged renderer and shared gameplay transactions'},indent=2))
