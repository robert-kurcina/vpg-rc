#!/usr/bin/env python3
"""Checkpoint 163 full cross-game regression, split into memory-safe batches.
Usage: python3 scripts/verify-checkpoint163-regressions.py core
       python3 scripts/verify-checkpoint163-regressions.py remaining
The second batch verifies and combines actual pass evidence from both batches.
"""
from pathlib import Path
import subprocess,json,time,sys
root=Path(__file__).resolve().parents[1]
previous=json.loads((root/'rules/audit/leningrad-three-battle-regressions-v396.json').read_text())
commands=[r['command'].replace(' --write-audit','') for r in previous['results']]
commands.append('node tests/historical-joint-safe-retreat-v397.test.js')
assert len(commands)==len(set(commands))==38
mode=sys.argv[1] if len(sys.argv)>1 else None
if mode not in ('core','remaining'):raise SystemExit('Specify core or remaining')
# Fleet and source-combat suites run without competing fresh raster exports.
indexes=[34]+[i for i in range(38) if (i<22 or 23<=i<=28)] if mode=='core' else [i for i in range(38) if not (i<22 or 23<=i<=28 or i==34)]
results=[]
for i in indexes:
 command=commands[i];start=time.monotonic()
 try:
  p=subprocess.run(command,shell=True,executable='/bin/bash',cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
  passed=p.returncode==0;out=p.stdout
 except subprocess.TimeoutExpired as ex:
  passed=False;out=f'TIMEOUT: {ex}'
 result=dict(index=i,command=command,passed=passed,seconds=round(time.monotonic()-start,2),outputTail=out[-1200:])
 results.append(result)
 print(f'{i+1:02d}/38 {"PASS" if passed else "FAIL"} {command} ({result["seconds"]}s)',flush=True)
 if not passed:print(result['outputTail'],flush=True)
 if not passed:sys.exit(1)
(root/f'rules/audit/leningrad-joint-safe-regressions-{mode}-v397.json').write_text(json.dumps(results,indent=2)+'\n')
if mode=='remaining':
 early=json.loads((root/'rules/audit/leningrad-joint-safe-regressions-core-v397.json').read_text())
 all_results=sorted(early+results,key=lambda x:x['index'])
 assert len(all_results)==38 and [x['index'] for x in all_results]==list(range(38))
 assert all(x['passed'] and x['command']==commands[x['index']] for x in all_results)
 report={'checkpoint':163,'version':'v397','planned':38,'passed':38,
  'method':'Each command executed independently, in two sequential memory-safe batches; no prior-checkpoint pass substituted',
  'results':[{k:v for k,v in x.items() if k!='index'} for x in all_results],
  'preservedCRT':'Identical B4M CRT for all five scenarios',
  'visualBaseline':'Accepted v373 no-shadow exports',
  'scope':'Cross-game regression set plus source-graph, bounded survivor-first two-defender retreat test'}
 (root/'rules/audit/leningrad-joint-safe-retreat-regressions-v397.json').write_text(json.dumps(report,indent=2)+'\n')
 print('SUMMARY',report['passed'],'/',report['planned'])
