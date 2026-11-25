#!/usr/bin/env python3
"""Checkpoint 162: repeat CP161 cross-game checks plus three-battle integration.
Runs read-only test commands, with dedicated audit output for this checkpoint.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor,as_completed
import subprocess,json,time,sys,shlex
root=Path(__file__).resolve().parents[1]
previous=json.loads((root/'rules/audit/leningrad-joint-order-regressions-v395.json').read_text())
commands=[r['command'].replace(' --write-audit','') for r in previous['results']]
commands.append('node tests/historical-three-battle-plans-v396.test.js')
assert len(commands)==len(set(commands))==37

def execute(pair):
 i,command=pair
 start=time.monotonic()
 try:
  p=subprocess.run(command,shell=True,executable='/bin/bash',cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=240)
  status=p.returncode==0;output=p.stdout
 except subprocess.TimeoutExpired as ex:
  status=False;output=f'TIMEOUT: {ex}'
 return i,dict(command=command,passed=status,seconds=round(time.monotonic()-start,2),outputTail=output[-1200:])

results=[None]*len(commands)
with ThreadPoolExecutor(max_workers=3) as pool:
 futures=[pool.submit(execute,x) for x in enumerate(commands)]
 for future in as_completed(futures):
  index,result=future.result();results[index]=result
  print(f'{index+1:02d}/{len(commands)} {"PASS" if result["passed"] else "FAIL"} {result["command"]} ({result["seconds"]}s)',flush=True)
  if not result['passed']:print(result['outputTail'],flush=True)
report=dict(checkpoint=162,version='v396',planned=len(commands),passed=sum(r['passed'] for r in results),
 results=results,preservedCRT='Identical B4M CRT for all five games',visualBaseline='v373-no-forest-shadow',
 note='Three-way concurrency, independent subprocesses; all 37 commands must pass')
(root/'rules/audit/leningrad-three-battle-regressions-v396.json').write_text(json.dumps(report,indent=2)+'\n')
if report['passed']!=len(commands):sys.exit(1)
