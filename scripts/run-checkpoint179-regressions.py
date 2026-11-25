#!/usr/bin/env python3
import json, pathlib, subprocess, time, sys
root=pathlib.Path(__file__).resolve().parents[1]
previous=json.loads((root/'rules/audit/checkpoint178-regressions-v412.json').read_text())
tests=list(dict.fromkeys(['tests/arduous-full-source-opening-v413.test.js','tests/scenario-opening-bridge-v358.test.js','tests/historical-player-deployment-v404.test.js','tests/historical-deployment-campaign-v404.test.js']+[r['test'] for r in previous['rows']]))
start=int(sys.argv[1]) if len(sys.argv)>1 else 0
end=int(sys.argv[2]) if len(sys.argv)>2 else len(tests)
output=root/'rules/audit/checkpoint179-regressions-v413.json'
prior=json.loads(output.read_text()) if output.exists() else {'checkpoint':179,'version':'v413','suites':len(tests),'rows':[]}
byname={r['test']:r for r in prior['rows']}
for name in tests[start:end]:
 if name in byname:continue
 t=time.monotonic();cmd=['python',name] if name.endswith('.py') else ['node',name]
 try:
  p=subprocess.run(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=40)
  status='PASS' if p.returncode==0 else 'FAIL';detail=p.stdout.strip()[-1000:]
 except subprocess.TimeoutExpired as e:status='TIMEOUT';detail=str(e)
 row={'test':name,'result':status,'seconds':round(time.monotonic()-t,2),'detail':detail}
 byname[name]=row;print(status,name,row['seconds'],flush=True)
 prior['rows']=[byname[t] for t in tests if t in byname]
 prior['passed']=sum(r['result']=='PASS' for r in prior['rows'])
 prior['failed']=sum(r['result']=='FAIL' for r in prior['rows'])
 prior['timedOut']=sum(r['result']=='TIMEOUT' for r in prior['rows'])
 output.write_text(json.dumps(prior,indent=2)+'\n')
print('AUDIT',len(prior['rows']),prior['passed'],prior['failed'],prior['timedOut'])
