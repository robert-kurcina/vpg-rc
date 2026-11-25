#!/usr/bin/env python3
"""Reproducible CP176 Node regressions; correct historical odds test path."""
from pathlib import Path
import concurrent.futures, json, subprocess, time
root=Path(__file__).resolve().parents[1]
old=json.loads((root/'rules/audit/checkpoint176-node-regressions-v410.json').read_text())
names=[row['test'] for row in old['rows']]
names=[n if n!='tests/historical-combat-odds-v318.test.js' else 'tests/leningrad-combat-odds-v318.test.js' for n in names]
names.append('tests/shared-historical-crt-v316.test.js')
assert len(names)==25 and len(set(names))==25
for n in names: assert (root/n).is_file(),n

def run(name):
 t=time.monotonic()
 try:
  p=subprocess.run(['node',name],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=115)
  result='PASS' if p.returncode==0 else 'FAIL'
  detail=(p.stdout or p.stderr).strip()
 except subprocess.TimeoutExpired as e:
  result='TIMEOUT';detail=str(e)
 return {'test':name,'result':result,'seconds':round(time.monotonic()-t,2),'detail':detail[-500:]}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool: rows=list(pool.map(run,names))
status='PASS' if all(x['result']=='PASS' for x in rows) else 'INCOMPLETE'
report={'checkpoint':176,'version':'v410','status':status,
 'correctedPriorBatch':'Original batch inadvertently used nonexistent historical-combat-odds-v318; replaced with real leningrad-combat-odds-v318 and added shared CRT test',
 'rows':rows,
 'browserChecks':[{'test':'tests/leningrad-counter-browser-parity-v403.py','result':'PASS','detail':'Chromium, real map SVG and official counter art'},{'test':'tests/leningrad-counter-swap-browser-v405.py','result':'PASS','detail':'Chromium, legal map/pool swaps and non-mutating rejection'}],
 'gameplayCertificationsNotInferred':['arduous movement map source-certified','kiev movement map source-certified','complete campaign for arduous/kiev']}
p=root/'rules/audit/checkpoint176-node-regressions-v410.json'
p.write_text(json.dumps(report,indent=2)+'\n')
for row in rows:print(row['result'],row['test'],row['seconds'],flush=True)
print(json.dumps({'status':status,'passed':sum(x['result']=='PASS' for x in rows),'total':len(rows),'report':str(p)},indent=2))
if status!='PASS':raise SystemExit(1)
