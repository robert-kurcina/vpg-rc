#!/usr/bin/env python3
"""Checkpoint 78: classify rivers and reinforcement boundaries by finite-side geometry.

Builds on the already registered vector paths and renderer-generated side
endpoints. Does not infer movement permissions from artwork.
"""
import hashlib, json, pathlib, subprocess, sys
from collections import Counter
from importlib.machinery import SourceFileLoader
from fontTools.svgLib.path import parse_path
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from core.svg_side_occupancy import evaluate
previous=SourceFileLoader('arduous_cp77',str(ROOT/'tools/extract-arduous-svg-linear-hex-v318.py')).load_module()
sampler=SourceFileLoader('arduous_pen78',str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()
OUT=ROOT/'rules/audit/arduous-svg-side-occupancy-v318.json'
DIRS=['N','NE','SE','S','SW','NW']

def build(map_path=previous.MAP):
    map_path=pathlib.Path(map_path)
    data=json.loads(map_path.read_text())
    svg=ROOT/'maps/source/user-svg/arduous-map-temp(3).svg'
    digest=hashlib.sha256(svg.read_bytes()).hexdigest()
    if digest!=data['authoredSourceVectors']['sourceSvgSha256']:
        raise ValueError('authored SVG checksum mismatch')
    reg=data['authoredSourceVectors']['registration']
    vectors={}
    for kind,group in [('river','rivers'),('reinforcement','entryBoundaries')]:
        for obj in data['authoredSourceVectors'][group]:
            pen=sampler.SamplePen();parse_path(obj['d'],pen)
            pts=[(x*reg['scaleX']+reg['translateX'],y*reg['scaleY']+reg['translateY']) for x,y in pen.points]
            if len(pts)<2:raise ValueError('degenerate vector '+obj['id'])
            vectors[(kind,obj['id'])]=pts
    script='''const T=require('./core/terrain_tiles');const m=require(process.argv[1]);console.log(JSON.stringify(T.gridSegmentData(m).map(s=>({cellId:s.cellId,dir:s.dir,neighborId:s.neighborId,a:s.a,b:s.b}))))'''
    segments=json.loads(subprocess.check_output(['node','-e',script,str(map_path.resolve())],cwd=ROOT,text=True))
    perhex={c['id']:{'hexId':c['id'],'sides':{d:[] for d in DIRS}} for c in data['cells']}
    edges={};counter=Counter()
    for seg in segments:
        side=seg['dir'];a=seg['cellId'];b=seg['neighborId']
        key='~'.join(sorted([a,b])) if b else a+':'+side
        members=[{'hexId':a,'dir':side}]
        if b:members.append({'hexId':b,'dir':DIRS[(DIRS.index(side)+3)%6]})
        obs=[]
        for (kind,id),points in sorted(vectors.items()):
            met=evaluate(points,seg['a'],seg['b'])
            if met['relation']=='not-near-side':continue
            record={'kind':kind,'sourceSvgId':id,**met,
                    'status':'svg-measured-visual-only','visualOnly':True}
            obs.append(record);counter[kind+':'+met['relation']]+=1
        if not obs:continue
        edges[key]={'edgeKey':key,'members':members,'observations':obs}
        for m in members:
            perhex[m['hexId']]['sides'][m['dir']].extend([{'edgeKey':key,**o} for o in obs])
    for h in perhex.values():h['sides']={d:h['sides'][d] for d in DIRS if h['sides'][d]}
    return {'schemaVersion':1,'mapId':data['id'],'semantics':'svg-measured-visual-only',
      'authorizedForMovement':False,'sourceSvgSha256':digest,
      'sourceMapSha256':hashlib.sha256(map_path.read_bytes()).hexdigest(),
      'registrationStatus':'existing map transform; not independently certified',
      'parameters':{'sideCorridorPx':3.0,'minProjectionFractionForSideFollow':0.55},
      'counts':{'hexes':len(perhex),'physicalSidesWithObservations':len(edges),
                'riverPaths':sum(k=='river' for k,_ in vectors),
                'reinforcementPaths':sum(k=='reinforcement' for k,_ in vectors),
                **dict(sorted(counter.items()))},
      'hexes':perhex,'edges':edges,
      'limitations':['A side-follow candidate is geometric evidence, not certified occupancy or movement legality.',
                     'Point intersections include tangencies; the classifier does not equate touching with crossing.',
                     'Original continuous SVG paths retain full rendering authority.',
                     'No historical scenario rule or connectivity is changed.']}

if __name__=='__main__':
    result=build()
    if '--write' in sys.argv:OUT.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result['counts'],indent=2))
