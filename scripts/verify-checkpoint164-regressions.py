#!/usr/bin/env python3
"""Checkpoint 164 complete cross-game checks, split into bounded serial groups.
Run: for i in 0 1 2 3 4 5; do python3 scripts/verify-checkpoint164-regressions.py "$i"; done
Then: python3 scripts/verify-checkpoint164-regressions.py combine
Each result is from a fresh process. This runner never substitutes older passes.
"""
from pathlib import Path
import json,subprocess,sys,time
root=Path(__file__).resolve().parents[1]
prior=json.loads((root/'rules/audit/leningrad-three-battle-regressions-v396.json').read_text())
commands=[r['command'].replace(' --write-audit','') for r in prior['results']]
commands.extend(['node tests/historical-joint-safe-retreat-v397.test.js',
                 'node tests/historical-retreat-search-certification-v398.test.js'])
assert len(commands)==39 and len(set(commands))==39
mode=sys.argv[1] if len(sys.argv)>1 else None
if mode not in ('0','1','2','3','4','5','combine'):raise SystemExit('Use group 0,1,2,3,4,5 or combine')
if mode=='combine':
 results=[]
 for i in range(6):
  p=root/f'rules/audit/cp164-regression-group-{i}.json'
  results.extend(json.loads(p.read_text()))
 results.sort(key=lambda x:x['index'])
 assert len(results)==39 and [r['index'] for r in results]==list(range(39))
 assert all(r['passed'] and r['command']==commands[r['index']] for r in results)
 report={'checkpoint':164,'version':'v398','planned':39,'passed':39,
  'method':'39 independent commands run in six sequential groups on final code',
  'results':[{k:v for k,v in r.items() if k!='index'} for r in results],
  'notes':['No unchanged prior-checkpoint pass substituted','Synthetic stress graph does not certify historical retreat positions']}
 (root/'rules/audit/leningrad-retreat-budget-regressions-v398.json').write_text(json.dumps(report,indent=2)+'\n')
 print('PASS 39/39 final regression commands')
 sys.exit(0)
idx=int(mode)
# Deliberate separation keeps costly campaign and raster checks isolated.
groups=[list(range(0,10)), list(range(10,22)), list(range(22,29)), list(range(29,34)), [34], list(range(35,39))]
results=[]
for i in groups[idx]:
 cmd=commands[i];start=time.monotonic()
 try:
  p=subprocess.run(cmd,shell=True,executable='/bin/bash',cwd=root,
       stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=95)
  ok=p.returncode==0;tail=p.stdout[-900:]
 except subprocess.TimeoutExpired as ex:
  ok=False;tail=f'TIMEOUT: {ex}'
 result={'index':i,'command':cmd,'passed':ok,'seconds':round(time.monotonic()-start,2),'outputTail':tail}
 results.append(result)
 print(f'{i+1:02d}/39 {"PASS" if ok else "FAIL"} {cmd} ({result["seconds"]}s)',flush=True)
 if not ok:
  print(tail,flush=True);sys.exit(1)
(root/f'rules/audit/cp164-regression-group-{idx}.json').write_text(json.dumps(results,indent=2)+'\n')
print(f'Group {idx} complete ({len(results)} passing commands)',flush=True)
