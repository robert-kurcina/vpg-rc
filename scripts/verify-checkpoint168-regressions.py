#!/usr/bin/env python3
"""CP168 cross-game regression matrix; run separately to avoid external runner stalls.

Examples:
 python3 scripts/verify-checkpoint168-regressions.py --group 1
 python3 scripts/verify-checkpoint168-regressions.py --group 7

Each test is a distinct process. Group 3 is the expensive fresh-render test.
No historical prior-checkpoint audit files are edited by this runner.
"""
import argparse,subprocess,time,sys,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
prior=json.loads((root/'rules/audit/leningrad-human-gateway-regressions-v401.json').read_text())
all_cmds=[r['command'] for r in prior['results']]+['python3 scripts/verify-historical-human-browser-v402.py']
assert len(all_cmds)==41
ranges={1:(0,12),2:(12,22),3:(22,23),4:(23,34),5:(34,39),6:(39,40),7:(40,41)}
p=argparse.ArgumentParser();p.add_argument('--group',type=int,choices=ranges,required=True);args=p.parse_args()
lo,hi=ranges[args.group];results=[]
for number in range(lo,hi):
 command=all_cmds[number];start=time.monotonic()
 try:
  proc=subprocess.run(command,shell=True,cwd=root,text=True,stdout=subprocess.PIPE,
   stderr=subprocess.STDOUT,timeout=135)
  passed=proc.returncode==0;output=proc.stdout
 except subprocess.TimeoutExpired as e:passed=False;output='TIMEOUT '+str(e)
 record={'index':number+1,'command':command,'passed':passed,'seconds':round(time.monotonic()-start,2),
  'outputTail':output[-1000:]}
 results.append(record)
 print(f"{number+1:02d}/41 {'PASS' if passed else 'FAIL'} {record['seconds']}s {command}",flush=True)
 if not passed:print(output[-2000:],flush=True)
path=root/f'rules/audit/leningrad-human-browser-regressions-v402-group{args.group}.json'
path.write_text(json.dumps({'checkpoint':168,'version':'v402','group':args.group,
 'completed':len(results),'passed':sum(r['passed'] for r in results),'results':results},indent=2)+'\n')
sys.exit(0 if all(r['passed'] for r in results) else 1)
