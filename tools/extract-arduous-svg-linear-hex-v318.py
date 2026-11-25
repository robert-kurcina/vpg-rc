#!/usr/bin/env python3
"""Checkpoint 77: source-vector-first per-hex linear-feature projection.

A single authored SVG path can annotate many hex sides. Geometric crossings
and proximity are *visual observations*, never movement permissions. The
original paths remain the rendering authority. No raster sampling is used.
"""
import hashlib, json, pathlib, sys
from collections import defaultdict
from importlib.machinery import SourceFileLoader
from fontTools.svgLib.path import parse_path
from shapely.geometry import LineString, Point
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from core.svg_hex_traversal import trace
sampler=SourceFileLoader('linear_pen',str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()
MAP=ROOT/'maps/arduous.json'
OUT=ROOT/'rules/audit/arduous-svg-linear-per-hex-v318.json'
DIRS=['N','NE','SE','S','SW','NW']

def build(map_path=MAP):
    path=pathlib.Path(map_path);data=json.loads(path.read_text())
    src=ROOT/'maps/source/user-svg/arduous-map-temp(3).svg'
    digest=hashlib.sha256(src.read_bytes()).hexdigest()
    if digest!=data['authoredSourceVectors']['sourceSvgSha256']:
        raise ValueError('authored SVG checksum differs from map registration')
    from importlib.machinery import SourceFileLoader as Load
    # Load the exact same registered hex sides and six-direction adjacency as the shared renderer.
    import subprocess
    node='''const T=require('./core/terrain_tiles');const m=require(process.argv[1]);let segments=T.gridSegmentData(m);let rows=[];for(const c of m.cells)for(const dir of T.DIRS){const seg=segments.find(s=>s.cellId===c.id&&s.dir===dir||s.neighborId===c.id&&T.OPP[s.dir]===dir);if(!seg)throw Error('missing side');let n=T.neighbor(c,dir,m.geometry);rows.push({hexId:c.id,dir,neighborId:m.cells.some(x=>x.id===n)?n:null,edgeKey:m.cells.some(x=>x.id===n)?[c.id,n].sort().join('~'):c.id+':'+dir,a:seg.a,b:seg.b});}console.log(JSON.stringify(rows))'''
    sides=json.loads(subprocess.check_output(['node','-e',node,str(path.resolve())],cwd=ROOT,text=True))
    byhex={c['id']:{'hexId':c['id'],'railStubs':{},'riverSides':{},'reinforcementSides':{}} for c in data['cells']}
    reg=data['authoredSourceVectors']['registration']
    vectors={};sourceKinds={}
    for kind,key in [('rail','railways'),('river','rivers'),('reinforcement','entryBoundaries')]:
        for item in data['authoredSourceVectors'][key]:
            id=item['id'];pen=sampler.SamplePen();parse_path(item['d'],pen)
            if len(pen.points)<2:raise ValueError('degenerate vector '+id)
            pts=[(x*reg['scaleX']+reg['translateX'],y*reg['scaleY']+reg['translateY']) for x,y in pen.points]
            vectors[id]=pts;sourceKinds[id]=kind
    # Crossing graph is produced from complete paths; no preassigned rail candidates.
    centers={c['id']:c['pixelCenter'] for c in data['cells']}
    pairs=sorted({tuple(sorted((s['hexId'],s['neighborId']))) for s in sides if s['neighborId']})
    result=trace({id:pts for id,pts in vectors.items() if sourceKinds[id]=='rail'},centers,pairs)
    railByPair=defaultdict(set)
    for r in result['crossings']:railByPair[tuple(r['hexPair'])].add(r['sourceSvgId'])
    for s in sides:
        if not s['neighborId']:continue
        ids=railByPair.get(tuple(sorted((s['hexId'],s['neighborId']))),set())
        if ids:byhex[s['hexId']]['railStubs'][s['dir']]={'to':s['neighborId'],'sourceSvgIds':sorted(ids),'status':'svg-derived-visual-crossing','visualOnly':True}
    # A river/reinforcement line is a boundary feature, not a railway: measure
    # continuous SVG-to-finite-side overlap, not center-to-center connectivity.
    # Side-distance threshold yields *candidate proximity*, not certified occupancy.
    # Complete source vectors are processed; multiple sides may cite the same path.
    threshold=3.0  # pixels, disclosed as an interpretive parameter
    proximity=[]
    for s in sides:
        segment=LineString([s['a'],s['b']]); mid=segment.interpolate(.5,normalized=True)
        for id,pts in vectors.items():
            kind=sourceKinds[id]
            if kind=='rail':continue
            line=LineString(pts)
            dist=line.distance(segment)
            # Proximity alone is not enough to assert a whole-side feature;
            # record measurements and leave ambiguity explicit.
            if dist>threshold:continue
            midDist=line.distance(mid)
            rec={'hexId':s['hexId'],'dir':s['dir'],'edgeKey':s['edgeKey'],'sourceSvgId':id,
                 'kind':kind,'minimumDistancePx':round(dist,3),'midpointDistancePx':round(midDist,3),
                 'status':'svg-near-side-needs-topological-review'}
            proximity.append(rec)
            field='riverSides' if kind=='river' else 'reinforcementSides'
            byhex[s['hexId']][field].setdefault(s['dir'],[]).append({'sourceSvgId':id,'status':rec['status'],'visualOnly':True})
    old={(c['from'],c['to']) if c['from']<c['to'] else (c['to'],c['from']) for c in data['hexCenterRailConnections']}
    new=set(railByPair)
    for h in byhex.values():
        for key in ('railStubs','riverSides','reinforcementSides'):
            h[key]={k:h[key][k] for k in DIRS if k in h[key]}
    # One canonical edge row per physical side; multiple source marks are retained.
    edges={}
    for rec in proximity:
        item=edges.setdefault(rec['edgeKey'],{'edgeKey':rec['edgeKey'],'observations':[]})
        obs={'kind':rec['kind'],'sourceSvgId':rec['sourceSvgId'],'fromHex':rec['hexId'],'dir':rec['dir'],'minimumDistancePx':rec['minimumDistancePx']}
        item['observations'].append(obs)
    return {'schemaVersion':1,'mapId':data['id'],'semantics':'visual-only-not-gameplay-certified',
            'sourceSvgSha256':digest,'sourceMapSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'geometryStatus':'uses-existing-map-registration; not independently recertified',
            'sideProximityThresholdPx':threshold,
            'counts':{'hexes':len(byhex),'railSourcePaths':sum(v=='rail' for v in sourceKinds.values()),
              'riverSourcePaths':sum(v=='river' for v in sourceKinds.values()),
              'reinforcementSourcePaths':sum(v=='reinforcement' for v in sourceKinds.values()),
              'railDerivedPairs':len(new),'railRegisteredPairs':len(old),
              'riverSideObservations':sum(x['kind']=='river' for x in proximity),
              'reinforcementSideObservations':sum(x['kind']=='reinforcement' for x in proximity),
              'ambiguousRailCrossings':len(result['ambiguous'])},
            'railDerivedNotRegistered':[list(x) for x in sorted(new-old)],
            'railRegisteredNotDerived':[list(x) for x in sorted(old-new)],
            'railCrossings':result['crossings'],'railAmbiguities':result['ambiguous'],
            'hexes':byhex,'canonicalSideObservations':edges,
            'limitations':['River and reinforcement proximity is not a side-occupancy assertion.',
              'A rail crossing is not a legal move.',
              'Original SVG path curves remain the rendering authority.',
              'No source vectors were redrawn or simplified in the game renderer.'],
            'authorizedForMovement':False}

if __name__=='__main__':
    res=build()
    if '--write' in sys.argv:OUT.write_text(json.dumps(res,indent=2)+'\n')
    print(json.dumps(res['counts']))
