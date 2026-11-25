#!/usr/bin/env python3
"""Checkpoint 161: repeat Checkpoint 160 regression commands plus new joint-order tests."""
from pathlib import Path
import subprocess, json, time, sys
root=Path(__file__).resolve().parents[1]
old=json.loads((root/'rules/audit/leningrad-postcombat-fleet-choices-regressions-v394.json').read_text())
commands=[r['command'].replace(' --write-audit','') for r in old['results']]
commands += ['node tests/historical-joint-order-retreat-v395.test.js']
results=[]
for i,command in enumerate(commands,1):
 start=time.time()
 try:
  p=subprocess.run(command,shell=True,executable='/bin/bash',cwd=root,
   stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=210)
  passed=p.returncode==0;output=p.stdout
 except subprocess.TimeoutExpired as ex:
  passed=False;output='TIMEOUT: '+str(ex)
 results.append({'command':command,'passed':passed,'seconds':round(time.time()-start,2),'outputTail':output[-950:]})
 print(f'{i:02d}/{len(commands)} {"PASS" if passed else "FAIL"} {command} ({results[-1]["seconds"]}s)',flush=True)
 if not passed:
  print(output[-3500:],flush=True)
  break
report={'checkpoint':161,'version':'v395','planned':len(commands),
 'passed':sum(x['passed'] for x in results),'results':results,
 'preservedCRT':'B4M for all five games','visualBaseline':'v373-no-forest-shadow'}
(root/'rules/audit/leningrad-joint-order-regressions-v395.json').write_text(json.dumps(report,indent=2)+'\n')
if len(results)!=len(commands) or not all(r['passed'] for r in results):sys.exit(1)
