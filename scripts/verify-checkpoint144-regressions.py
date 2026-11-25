#!/usr/bin/env python3
"""Checkpoint 144 bounded non-mutating regression smoke; captures reproducible commands."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from subprocess import run,TimeoutExpired
import json,time,sys
root=Path(__file__).resolve().parent.parent
checks=[
 ['node','tests/b4m-native-redeployment-campaign-v378.test.js'],
 ['node','tests/b4m-native-redeployment-audit-v377.test.js'],
 ['node','tests/b4m-native-reserve-redeployment-v376.test.js'],
 ['node','tests/b4m-native-tournament-reference-v375.test.js'],
 ['node','tests/native-city-control-v374.test.js'],
 ['node','tests/b4m-native-ai-session-v368.test.js'],
 ['node','tests/b4m-native-continuous-campaign-v364.test.js'],
 ['node','tests/b4m-native-expanded-turn-v366.test.js'],
 ['node','tests/b4m-native-combat-v361.test.js'],
 ['node','tests/forest-no-shadow-v373.test.js'],
 ['node','tests/shared-render-profiles-v356.test.js'],
 ['node','tests/smoke-current.js'],
 ['python3','tests/leningrad-approved-visual-regression-v352.test.py'],
 ['node','scripts/verify-campaign-maps.js']
]
def task(command):
 begin=time.monotonic()
 try:
  r=run(command,cwd=root,capture_output=True,text=True,timeout=100)
  return {'command':' '.join(command),'status':'PASS' if r.returncode==0 else 'FAIL',
   'returnCode':r.returncode,'elapsedSeconds':round(time.monotonic()-begin,2),
   'lastOutput':(r.stdout+'\n'+r.stderr).strip()[-950:]}
 except TimeoutExpired:
  return {'command':' '.join(command),'status':'TIMEOUT','elapsedSeconds':round(time.monotonic()-begin,2)}
results=[]
with ThreadPoolExecutor(max_workers=3) as pool:
 futures={pool.submit(task,x):x for x in checks}
 for f in as_completed(futures):
  item=f.result();results.append(item)
  print(item['status'],item['command'],item['elapsedSeconds'],flush=True)
results.sort(key=lambda x:x['command'])
report={'checkpoint':144,'version':'v378','scope':'bounded local regression, no original executable or hosted-browser parity',
 'results':results,'passed':sum(x['status']=='PASS' for x in results),'total':len(results)}
(root/'rules/audit/b4m-native-post-redeployment-regressions-v378.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'total':report['total'],'nonPassing':[x for x in results if x['status']!='PASS']}))
sys.exit(0 if report['passed']==report['total'] else 1)
