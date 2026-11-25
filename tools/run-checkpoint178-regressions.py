#!/usr/bin/env python3
import json,os,pathlib,subprocess,time,sys
root=pathlib.Path(__file__).resolve().parents[1]
old=json.loads((root/'rules/audit/checkpoint177-node-regressions-v411.json').read_text())
paths=[r['test'] for r in old['rows']]+[
 'tests/terrain-evidence-v318.test.js','tests/arduous-whole-hex-terrain-v412.test.py',
 'tests/arduous-river-candidates-v418.test.py','tests/arduous-terrain-source-v318.test.py',
 'tests/arduous-svg-terrain-per-hex-v318.test.py','tests/arduous-scan-terrain-v318.test.py',
 'tests/arduous-svg-linear-hex-v318.test.py','tests/arduous-svg-side-occupancy-v318.test.py',
 'tests/export-png-freshness-v339.test.js','tests/export-png-regeneration-v339.test.js',
 'tests/source-edge-trace-v318.test.js']
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--budget',type=float,default=20);args=parser.parse_args()
outpath=root/'rules/audit/checkpoint178-regressions-v412.json'
prior=json.loads(outpath.read_text()) if outpath.is_file() else {'rows':[]}
rows=prior['rows']
seen={r['test'] for r in rows}
batch_start=time.monotonic()
for i,path in enumerate(paths):
 if path in seen:continue
 if time.monotonic()-batch_start>args.budget:break
 cmd=['python',path] if path.endswith('.py') else ['node',path]
 start=time.monotonic()
 try:
  result=subprocess.run(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=90)
  passed=result.returncode==0
  detail=(result.stdout+'\n'+result.stderr).strip()[-1200:]
 except subprocess.TimeoutExpired as e:
  passed=False;detail='Timed out at 90s'
 row={'test':path,'result':'PASS' if passed else 'FAIL','seconds':round(time.monotonic()-start,2),'detail':detail}
 rows.append(row)
 outpath.write_text(json.dumps({'checkpoint':178,'version':'v412','status':'PARTIAL','suites':len(paths),'rows':rows},indent=2)+'\n')
 print(f'{i+1:02d}/{len(paths)}',row['result'],path,row['seconds'],'s',flush=True)
 if not passed:print(detail,flush=True)
out={'checkpoint':178,'version':'v412','status':('PASS' if all(r['result']=='PASS' for r in rows) else 'FAIL') if len(rows)==len(paths) else 'PARTIAL',
 'suites':len(rows),'passed':sum(r['result']=='PASS' for r in rows),'failed':sum(r['result']!='PASS' for r in rows),'rows':rows}
(root/'rules/audit/checkpoint178-regressions-v412.json').write_text(json.dumps(out,indent=2)+'\n')
if out['status']=='FAIL':sys.exit(1)
