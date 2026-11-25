"""Checkpoint 153 verified regression report. Does not modify approved assets."""
import json, subprocess, sys, time
from pathlib import Path
root=Path(__file__).resolve().parents[1]
previous=json.loads((root/'rules/audit/leningrad-combat-session-regressions-v386.json').read_text())
commands=[x['command'] for x in previous['results']]
commands.append('node tests/historical-campaign-continuation-v387.test.js --write-audit')
results=[]
for index,command in enumerate(commands,1):
    begin=time.monotonic()
    try:
        p=subprocess.run(command,shell=True,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=105,text=True)
        code=p.returncode;output=p.stdout
    except subprocess.TimeoutExpired as e:
        code=124;output=f'TIMEOUT: {e}'
    result={'command':command,'status':'PASS' if code==0 else 'FAIL','exitCode':code,
            'elapsedSeconds':round(time.monotonic()-begin,2),'lastOutput':output[-1500:]}
    results.append(result)
    print(f'{index:02d}/{len(commands)} {result["status"]} ({result["elapsedSeconds"]}s): {command}',flush=True)
report={'checkpoint':153,'version':'v387','scope':'source-bound consecutive combat/movement/Fleet continuation; no full campaign',
        'results':results,'passed':sum(x['status']=='PASS' for x in results),'total':len(results)}
(root/'rules/audit/leningrad-campaign-continuation-regressions-v387.json').write_text(json.dumps(report,indent=2)+'\n')
if report['passed']!=report['total']:
    print('Failed commands:',*[x['command'] for x in results if x['status']!='PASS'],sep='\n')
    sys.exit(1)
print('ALL PASS:',report['passed'],'/',report['total'])
