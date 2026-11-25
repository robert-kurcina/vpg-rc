#!/usr/bin/env python3
"""Fresh, independent shared-engine regression processes for CP165.
Historical audit output isn't altered. Individual process failures remain visible.
"""
import json, subprocess, time, concurrent.futures, sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
base=json.loads((root/'rules/audit/leningrad-retreat-budget-regressions-v398.json').read_text())
cmds=[x['command'] for x in base['results']]
assert len(cmds)==39
# Already verified manually; do not re-run the long controller case twice.
def run(item):
 i,cmd=item;start=time.monotonic()
 try:
  result=subprocess.run(cmd,shell=True,cwd=root,stdout=subprocess.PIPE,
   stderr=subprocess.STDOUT,text=True,timeout=140)
  passed=result.returncode==0;out=result.stdout
 except subprocess.TimeoutExpired as e:
  passed=False;out='TIMEOUT: '+str(e)
 return i,{'command':cmd,'passed':passed,'seconds':round(time.monotonic()-start,2),'outputTail':out[-1000:]}
results=[None]*len(cmds)
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for i,record in pool.map(run,enumerate(cmds)):
  results[i]=record
  print(f"{i+1:02d}/{len(cmds)} {'PASS' if record['passed'] else 'FAIL'} {record['seconds']}s {record['command']}",flush=True)
report={'checkpoint':165,'version':'v399','planned':len(cmds),'passed':sum(x['passed'] for x in results),
 'method':'Independent fresh processes, max three concurrent, 140-second individual deadline',
 'scope':'Unchanged checkpoint-164 regression contracts. Additional v399 controller eight-turn test runs separately.',
 'results':results}
(root/'rules/audit/leningrad-autoplay-regressions-v399.json').write_text(json.dumps(report,indent=2)+'\n')
print('SUMMARY',report['passed'],'/',report['planned'],flush=True)
sys.exit(0 if report['passed']==report['planned'] else 1)
