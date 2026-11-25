#!/usr/bin/env python3
"""Bounded test runner; stores exact pass/fail/timeout without claiming interrupted suites passed."""
import json, pathlib, subprocess, time
R=pathlib.Path(__file__).resolve().parents[1]
node=[
'kiev-definitive-terrain-v428.test.js','kiev-definitive-rail-v427.test.js',
'terrain-evidence-v318.test.js','map-certification-readiness-v318.test.js',
'kiev-roster-and-victory-v410.test.js','cross-game-movement-registry-v318.test.js',
'cross-game-movement-v318.test.js','cross-game-movement-profiles-v318.test.js',
'arduous-executable-graph-v419.test.js','arduous-combat-river-fortification-v419.test.js',
'arduous-full-source-opening-v413.test.js','arduous-brest-garrison-v411.test.js',
'arduous-brest-combat-v411.test.js','arduous-river-candidates-v418.test.js',
'arduous-roster-and-victory-v410.test.js','leningrad-combat-geography-v318.test.js',
'leningrad-combat-commitment-v318.test.js','historical-combat-consequences-v359.test.js',
'b4m-native-objective-advance-v408.test.js','human-lazy-combat-plans-v425.test.js',
'hex-visual-features-v318.test.js','kiev-odessa-composite-seam-v318.test.js'
]
cmds=[['python','tests/kiev-definitive-terrain-v428.test.py'],['python','tests/kiev-definitive-rail-v427.test.py']]+[['node','tests/'+n] for n in node]
results=[]
for cmd in cmds:
 start=time.monotonic()
 try:
  p=subprocess.run(cmd,cwd=R,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=40)
  outcome='PASS' if p.returncode==0 else 'FAIL'
  tail='\n'.join(p.stdout.splitlines()[-6:])
 except subprocess.TimeoutExpired as e:
  outcome='TIMEOUT';tail=str(e)
 results.append({'command':' '.join(cmd),'outcome':outcome,'seconds':round(time.monotonic()-start,2),'detail':tail})
 print(outcome,cmd[-1],round(results[-1]['seconds'],1),flush=True)
(R/'rules/audit/checkpoint194-regressions.json').write_text(json.dumps({'checkpoint':194,'results':results,'summary':{k:sum(r['outcome']==k for r in results) for k in ('PASS','FAIL','TIMEOUT')}},indent=2)+'\n')
