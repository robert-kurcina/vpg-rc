#!/usr/bin/env python3
"""Checkpoint 152 non-mutating regression bundle, keeps prior audit artifacts intact."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
from subprocess import run,TimeoutExpired
import json,time,sys
root=Path(__file__).resolve().parent.parent
checks=[
 ['node','tests/historical-safe-retreat-options-v379.test.js'],
 ['node','tests/historical-forced-retreat-v380.test.js'],
 ['node','tests/historical-overstack-retreat-v381.test.js'],
 ['node','tests/historical-port-fleet-retreat-v382.test.js'],
 ['node','tests/historical-fleet-opening-movement-v383.test.js'],
 ['node','tests/historical-fleet-forced-displacement-v384.test.js'],
 ['node','tests/historical-air-sea-support-v385.test.js'],
 ['node','tests/historical-combat-session-v386.test.js'],
 ['node','tests/leningrad-phase-movement-pilot-v318.test.js'],
 ['node','tests/historical-combat-consequences-v359.test.js'],
 ['node','tests/scenario-opening-bridge-v358.test.js'],
 ['node','tests/leningrad-combat-commitment-v318.test.js'],
 ['node','tests/leningrad-combat-geography-v318.test.js'],
 ['node','tests/leningrad-reinforcement-ledger-v323.test.js'],
 ['node','tests/leningrad-full-inventory-v355.test.js'],
 ['node','tests/b4m-native-redeployment-campaign-v378.test.js'],
 ['node','tests/b4m-native-combat-v361.test.js'],
 ['node','tests/b4m-native-tournament-reference-v375.test.js'],
 ['node','tests/forest-no-shadow-v373.test.js'],
 ['node','tests/shared-render-profiles-v356.test.js'],
 ['node','tests/smoke-current.js'],
 ['python3','tests/leningrad-approved-visual-regression-v352.test.py'],
 ['node','scripts/verify-campaign-maps.js'],
]
def task(cmd):
 begin=time.monotonic()
 try:
  r=run(cmd,cwd=root,capture_output=True,text=True,timeout=130)
  return {'command':' '.join(cmd),'status':'PASS' if r.returncode==0 else 'FAIL',
   'exitCode':r.returncode,'elapsedSeconds':round(time.monotonic()-begin,2),
   'lastOutput':(r.stdout+'\n'+r.stderr).strip()[-1100:]}
 except TimeoutExpired:
  return {'command':' '.join(cmd),'status':'TIMEOUT','elapsedSeconds':round(time.monotonic()-begin,2)}
results=[]
with ThreadPoolExecutor(max_workers=3) as pool:
 futures={pool.submit(task,x):x for x in checks}
 for f in as_completed(futures):
  result=f.result();results.append(result)
  print(result['status'],result['command'],result['elapsedSeconds'],flush=True)
results.sort(key=lambda x:x['command'])
report={'checkpoint':152,'version':'v386','scope':'engine-first combat-phase replay/restore; not full campaign or human UX',
 'results':results,'passed':sum(x['status']=='PASS' for x in results),'total':len(results)}
(root/'rules/audit/leningrad-combat-session-regressions-v386.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'passed':report['passed'],'total':report['total'],'nonPassing':[x for x in results if x['status']!='PASS']}))
sys.exit(0 if report['passed']==report['total'] else 1)
