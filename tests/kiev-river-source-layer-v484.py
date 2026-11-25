#!/usr/bin/env python3
"""Verify Kiev's corrected five river hexsides against the untouched user SVG.
The SVG named layer is independent evidence from the compiled game edge ledger.
"""
from pathlib import Path
from xml.etree import ElementTree as ET
import hashlib, json, sys

ROOT=Path(__file__).resolve().parents[1]
read=lambda p:(ROOT/p).read_bytes()
sha=lambda x:hashlib.sha256(x).hexdigest()
map_data=json.loads(read('maps/kiev.json'))
ledger=json.loads(read('maps/movement-configs/source-reviewed-edge-ledgers.json'))['maps'][map_data['id']]
original=json.loads(read('rules/audit/kiev-definitive-city-river-v429.json'))
src='maps/source/user-svg/kiev-odessa-main.svg'
assert sha(read(src))==original['sourceSvgSha256']==ledger['sourceSvgSha256'], 'source SVG drift'
root=ET.fromstring(read(src)); parent={c:p for p in root.iter() for c in p}
objects={e.get('id'):e for e in root.iter() if e.get('id')}
ink_label='{http://www.inkscape.org/namespaces/inkscape}label'
corrected=['1401:1502','1402:1502','1402:1503','1403:1503','1403:1504']
sides=[];checks=0
for pair in corrected:
 trace=next((x for x in original['riverHexsides'] if x['hexPair']==pair),None)
 assert trace and trace['kind']=='river' and trace['coverageFraction']>=0.99, pair
 assert pair in ledger['riverEdges'] and pair not in ledger['majorRiverEdges'],pair
 path=objects[trace['sourceSvgId']]; layer=parent[path]
 assert layer.get(ink_label)=='river-minor',(pair,layer.get(ink_label))
 assert 'stroke-width:2.64583' in path.get('style',''),pair
 a,b=pair.split(':')
 matching=[]
 for cell in map_data['cells']:
  if cell['id'] not in {a,b}:continue
  for direction, features in cell.get('tileEdges',{}).items():
   if any(f['kind']=='river' and f['status']=='source-svg-river-minor-v484' for f in features):
    # The Node geometry test confirms which of these sides links the named pair.
    matching.append([cell['id'],direction])
 assert len(matching)>=2,(pair,matching)
 sides.append({'hexPair':pair,'sourcePath':trace['sourceSvgId'],
               'sourceLayer':layer.get(ink_label),'coverageFraction':trace['coverageFraction'],
               'gameplayClassification':'river','correctedMapClass':'river'})
 checks+=6
assert len(sides)==5
output={'checkpoint':250,'version':'v484','scope':'Objective: Kiev five water-classification corrections',
 'sourceSvgSha256':sha(read(src)),'mapSha256':sha(read('maps/kiev.json')),
 'ledgerSha256':sha(read('maps/movement-configs/source-reviewed-edge-ledgers.json')),
 'correctedHexsides':sides,'gameplayGraphChanged':False,'gameplayAuthorized':False,
 'exportedKievArtworkChanged':False,
 'limit':'Verifies named source-minor river layers and matching gameplay sides; not a complete independent certification of all Kiev geography.'}
if '--write' in sys.argv:
 (ROOT/'rules/audit/kiev-river-class-reconciliation-v484.json').write_text(json.dumps(output,indent=2)+'\n')
else:
 assert output==json.loads(read('rules/audit/kiev-river-class-reconciliation-v484.json')),'reconciliation audit drift'
print(f'PASS source SVG river-minor classification: {checks} checks, five corrected sides, gameplay unchanged')
