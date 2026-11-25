#!/usr/bin/env python3
"""Rerun inherited 25 Node suites plus new source/one-step/rail tests.
Never overwrites checkpoint 176 evidence.
"""
from pathlib import Path
import concurrent.futures, json, subprocess, time
root=Path(__file__).resolve().parents[1]
prior=json.loads((root/'rules/audit/checkpoint176-node-regressions-v410.json').read_text())
names=[x['test'] for x in prior['rows']]
names+=['tests/arduous-brest-garrison-v411.test.js','tests/arduous-brest-combat-v411.test.js','tests/arduous-rail-reconciliation-v411.test.js','tests/map-movement-graph-source-policy-v318.test.js','tests/map-certification-readiness-v318.test.js']
assert len(names)==len(set(names)) and all((root/n).is_file() for n in names)
def run(name):
 t=time.monotonic()
 try:
  p=subprocess.run(['node',name],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=105)
  verdict='PASS' if p.returncode==0 else 'FAIL'
  detail=((p.stdout or '')+'\n'+(p.stderr or '')).strip()
 except subprocess.TimeoutExpired as e:
  verdict='TIMEOUT';detail=str(e)
 return {'test':name,'result':verdict,'seconds':round(time.monotonic()-t,2),'detail':detail[-650:]}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:rows=list(pool.map(run,names))
result={'checkpoint':177,'version':'v411','status':'PASS' if all(r['result']=='PASS' for r in rows) else 'INCOMPLETE',
 'inheritedSuites':len(prior['rows']),'newOrAdditionalSuites':len(names)-len(prior['rows']),
 'rows':rows,'limitation':'Arduous/Kiev movement graph remains fail-closed; combat Garrison test uses Leningrad verified graph as an isolated fixture'}
(root/'rules/audit/checkpoint177-node-regressions-v411.json').write_text(json.dumps(result,indent=2)+'\n')
for row in rows:print(row['result'],row['test'],row['seconds'],flush=True)
print(json.dumps({'status':result['status'],'passed':sum(r['result']=='PASS' for r in rows),'total':len(rows)},indent=2))
if result['status']!='PASS':raise SystemExit(1)
