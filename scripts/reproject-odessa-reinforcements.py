#!/usr/bin/env python3
"""Compare author-drawn Odessa reinforcement paths to canonical exterior hexsides.

The authored path does not align perfectly with the printed map perimeter.
Project the evidence onto exterior hexsides, never invent interior entry edges.
Keep conservative prior segments within a one-half-hex registration tolerance,
and add only very close, previously missed perimeter edges.
"""
from pathlib import Path
import json,math,subprocess
ROOT=Path(__file__).resolve().parent.parent
p=ROOT/'maps/odessa-extension.json'
ext=json.loads(p.read_text());old=json.loads((ROOT/'maps/source/odessa-entry-edges-baseline-v259.json').read_text())['entryEdges']
node='''const fs=require('fs'),T=require('./core/terrain_tiles'),C=require('./maps/composer');
const b=C.compose(JSON.parse(fs.readFileSync('./maps/kiev.json')),JSON.parse(fs.readFileSync('./maps/odessa-extension.json')));
console.log(JSON.stringify(T.gridSegmentData(b,...T.gridRadii(b.geometry)).filter(e=>!e.neighborId)));'''
raw=subprocess.check_output(['node','-e',node],cwd=ROOT,text=True)
segs=json.loads(raw)

# Dense source path samples, stored under a trace provenance record.
traces={t['side']:t for t in ext['authoredReinforcementTraces']}
assert set(traces)=={'german','soviet'}

def point_to_edge(p,a,b):
 u=(b[0]-a[0],b[1]-a[1]);den=u[0]*u[0]+u[1]*u[1]
 t=max(0,min(1,((p[0]-a[0])*u[0]+(p[1]-a[1])*u[1])/den))
 return math.hypot(p[0]-a[0]-t*u[0],p[1]-a[1]-t*u[1])

old_by_key={(e['cellId'],e['dir']):e['side'] for e in old}
entries=[];rejected=[];distance_audit=[]
for seg in segs:
 if not seg['cellId'].startswith(tuple(f'{i:02d}' for i in range(7,20))):continue
 if not any(c['id']==seg['cellId'] for c in ext['cells']):continue
 key=(seg['cellId'],seg['dir'])
 distances={side:min(point_to_edge(p,seg['a'],seg['b']) for p in trace['points'])
  for side,trace in traces.items()}
 closest=min(distances,key=distances.get)
 original=old_by_key.get(key)
 # The printed edge geometry is authoritative for the edge's location. The
 # SVG vector supplies faction and approximate extent. Registration gaps of
 # 30-40 px are an acknowledged source conflict, not hidden by map clipping.
 keep=(original is not None and distances[original]<=45) or (original is None and distances[closest]<=12)
 if keep:
  side=original or closest
  entries.append({'cellId':key[0],'dir':key[1],'side':side,
                  'source':'user-svg-projected-to-printed-exterior-v260',
                  'svgReinforcementPath':traces[side]['sourceSvgId'],
                  'sourceVectorToHexEdgeMinDistancePx':round(distances[side],2),
                  'sourceRegistrationConflict':distances[side]>20})
 elif original:rejected.append({'cellId':key[0],'dir':key[1],'side':original,'distancePx':round(distances[original],1)})
 distance_audit.append({'cellId':key[0],'dir':key[1], 'germanDistancePx':round(distances['german'],1),
                        'sovietDistancePx':round(distances['soviet'],1), 'selected':keep})
assert len(entries)>10, len(entries)
assert not any(x['cellId']=='1911' and x['dir']=='N' for x in entries)
entries.sort(key=lambda e:(e['side'],e['cellId'],e['dir']))
ext['entryEdges']=entries
ext['sourceReinforcementProjectionAudit']={
 'method':'Perimeter edges from actual engine grid; source strokes from exact uploaded SVG sampled in Chromium; no guessed internal edges',
 'sourceSvgSha256':ext['v260SourceRegistration']['sha256'],
 'sourceFile':ext['v260SourceRegistration']['svgFile'],
 'distanceToleranceForPriorEdgesPx':45,
 'distanceToleranceForNewEdgesPx':12,
 'projectionConflictThresholdPx':20,
 'count':len(entries),
 'sourceConflictCount':sum(e['sourceRegistrationConflict'] for e in entries),
 'previousRejectedEdges':rejected,
 'entryEdges':entries,
 'status':'VISUAL_TRANSCRIPTION_ONLY: source SVG trace is displaced 30-40px from printed western perimeter; kept printed hex topology and flagged discrepancy'
}
p.write_text(json.dumps(ext,indent=2,ensure_ascii=False)+'\n')
print('projected Odessa reinforcement edges',len(entries),'by faction',{side:sum(e['side']==side for e in entries) for side in traces},'discrepant',ext['sourceReinforcementProjectionAudit']['sourceConflictCount'])
print('added',[(e['cellId'],e['dir']) for e in entries if (e['cellId'],e['dir']) not in old_by_key])
print('rejected',rejected)
