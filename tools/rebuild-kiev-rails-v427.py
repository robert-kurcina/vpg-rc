#!/usr/bin/env python3
"""Reconcile Objective: Kiev rails against *finite renderer hexsides*.

The current visible source is the definitive Kiev–Odessa main SVG (24 railway
routes). Earlier temporary Kiev SVG paths are not the final visible source.
The output derives both rail links and reciprocal side annotations from one
source geometry, without enabling gameplay or altering the shared renderer.
"""
import argparse
import hashlib
import json
import math
import pathlib
import subprocess
import xml.etree.ElementTree as ET
from collections import defaultdict
from importlib.machinery import SourceFileLoader
from shapely.geometry import LineString, Point
from fontTools.svgLib.path import parse_path

ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'maps/source/user-svg/kiev-odessa-main.svg'
MAP=ROOT/'maps/kiev.json'
EXT=ROOT/'maps/odessa-extension.json'
AUDIT=ROOT/'rules/audit/kiev-rail-reconstruction-v427.json'
PIN='2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e'
DRAFT=ROOT/'maps/source/user-svg/kiev-map-temp(5).svg'
SAMPLE=SourceFileLoader('kiev_rail_sampler',str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()
STATUS='definitive-svg-finite-hexside-v427'
# The six observed v426→v427 differences are historical comparison metadata,
# not a second active rail registry. This keeps the audit stable on reruns.
PRE_V427_ONLY={'0101:0102','0101:0201','0306:0406','0711:0810','1501:1601'}
V427_ONLY={'0501:0502'}
OPP={'N':'S','NE':'SW','SE':'NW','S':'N','SW':'NE','NW':'SE'}
def pair(a,b):return ':'.join(sorted((a,b)))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()

def grid(board):
    # These finite hexside segments are those of the shared map renderer.
    # NEVER use extended Voronoi rays: they produce false edge links.
    js='''const T=require('./core/terrain_tiles'),m=require(process.argv[1]),ids=new Set(m.cells.map(c=>c.id)),s=new Set(),direct={};for(const c of m.cells)for(const d of T.DIRS){const t=T.neighbor(c,d,m.geometry);if(ids.has(t)){const key=[c.id,t].sort().join(':');s.add(key);direct[c.id+':'+t]=d;}}console.log(JSON.stringify({pairs:[...s].sort().map(p=>p.split(':')),directions:direct,segments:T.gridSegmentData(m).filter(x=>x.neighborId).map(x=>({a:x.cellId,b:x.neighborId,ends:[x.a,x.b]}))}));'''
    result=json.loads(subprocess.check_output(['node','-e',js,str(MAP.resolve())],cwd=ROOT,text=True))
    if len(result['pairs'])!=442 or len(result['segments'])!=442:raise ValueError('Kiev physical grid changed')
    return result

def definitive_paths(board,extension):
    if sha(SRC)!=PIN or extension['authoritativeCompositeSvg']['sha256']!=PIN or board['standaloneKievRailGeometryAudit']['sourceSvgSha256']!=PIN:
        raise ValueError('Definitive SVG SHA-256 mismatch')
    routes=extension['authoritativeRailRoutes'];display=board['sourceRailRoutes']
    if len(routes)!=24 or len(display)!=24 or [r['sourceSvgId'] for r in routes]!=[r['sourceSvgId'] for r in display]:
        raise ValueError('Current display route IDs differ from definitive authored source')
    if len({r['sourceSvgId'] for r in routes})!=24:raise ValueError('Duplicate SVG route ID')
    scale=3.7795275590551185;tx=350.0940888188976;ty=492.587262992126
    ids={e.get('id'):e for e in ET.parse(SRC).getroot().iter() if e.get('id')}
    for raw,dsp in zip(routes,display):
        if len(raw['points'])!=len(dsp['points']) or any(math.dist(p,q)>2.5 for p,q in zip(raw['points'],dsp['points'])):
            raise ValueError('Source/display route geometry diverges: '+raw['sourceSvgId'])
        e=ids.get(raw['sourceSvgId'])
        if e is None or e.tag.rsplit('}',1)[-1]!='path' or not e.get('d'):raise ValueError('SVG path missing')
        p=SAMPLE.SamplePen();parse_path(e.get('d'),p)
        if len(p.points)!=len(raw['points']):raise ValueError('Source vertex count changed: '+raw['sourceSvgId'])
        for (x,y),(u,v) in zip(p.points,raw['points']):
            if math.hypot(x*scale+tx-u,y*scale+ty-v)>0.002:raise ValueError('Definitive source vertex changed: '+raw['sourceSvgId'])
    return {r['sourceSvgId']:r['points'] for r in routes}

def draft_paths(board):
    raw=board['authoredSourceVectors'];r=raw['registration']
    if sha(DRAFT)!=raw['sourceSvgSha256']:raise ValueError('Temporary SVG source SHA changed')
    paths={}
    for e in raw['railways']:
        p=SAMPLE.SamplePen();parse_path(e['d'],p)
        paths[e['id']]=[(x*r['scaleX']+r['translateX'],y*r['scaleY']+r['translateY']) for x,y in p.points]
    return paths

def finite_crossings(paths,g,centers,strict=False):
    records=[];uncertain=[]
    for side in g['segments']:
        a,b=side['a'],side['b'];edge=LineString(side['ends'])
        if edge.length<1:raise ValueError('Degenerate renderer hexside '+pair(a,b))
        ax,ay=centers[a];bx,by=centers[b]
        mid=((ax+bx)/2,(ay+by)/2);dx,dy=bx-ax,by-ay
        for id,pts in paths.items():
            rail=LineString(pts);hit=rail.intersection(edge)
            if hit.is_empty:continue
            if hit.geom_type not in ('Point','MultiPoint'):
                uncertain.append((pair(a,b),id,'overlap-or-multiple'));continue
            for point in [hit] if hit.geom_type=='Point' else hit.geoms:
                d=min(point.distance(Point(p)) for p in side['ends']);along=rail.project(point)
                if d<=.35 or along<=.35 or rail.length-along<=.35:
                    uncertain.append((pair(a,b),id,'near-vertex-or-path-end'));continue
                before=rail.interpolate(max(0,along-.15));after=rail.interpolate(min(rail.length,along+.15))
                signed=lambda p:(p.x-mid[0])*dx+(p.y-mid[1])*dy
                if signed(before)*signed(after)>=-1e-6:
                    uncertain.append((pair(a,b),id,'touch-not-crossing'));continue
                records.append({'hexPair':[a,b],'sourceSvgId':id})
    if strict and uncertain:raise ValueError('Source crossing requires review: '+str(uncertain[:5]))
    return {'links':{pair(*r['hexPair']) for r in records},'crossings':records,'ambiguous':uncertain}

def reconstruct(board,extension):
    g=grid(board);cent={c['id']:c['pixelCenter'] for c in board['cells']}
    source=finite_crossings(definitive_paths(board,extension),g,cent,strict=True)
    rendered=finite_crossings({r['sourceSvgId']:r['points'] for r in board['sourceRailRoutes']},g,cent,strict=True)
    if source['links']!=rendered['links']:raise ValueError('Source and approved displayed rail paths cross different hexsides')
    links=source['links']
    if len(links)!=93:raise ValueError('Finite-source rail count changed; review source before accepting: '+str(len(links)))
    routes=defaultdict(set)
    for hit in source['crossings']:routes[pair(*hit['hexPair'])].add(hit['sourceSvgId'])
    if set(routes)!=links:raise ValueError('Missing source route ID for link')
    existing={pair(l['from'],l['to']) for l in board['hexCenterRailConnections']}
    baseline=(links-V427_ONLY)|PRE_V427_ONLY
    if len(baseline)!=97 or (V427_ONLY & PRE_V427_ONLY):
        raise ValueError('Historical comparison metadata is inconsistent')
    old=finite_crossings(draft_paths(board),g,cent)
    new_links=[{'from':k.split(':')[0],'to':k.split(':')[1],
                'sourceSvgIds':sorted(routes[k]),'status':STATUS} for k in sorted(links)]
    target=json.loads(json.dumps(board))
    for c in target['cells']:
        c['railEdges']=[]
        c['tileEdges']={d:[f for f in entries if f.get('kind')!='rail'] for d,entries in c.get('tileEdges',{}).items()}
        c['tileEdges']={d:v for d,v in c['tileEdges'].items() if v}
        c['hexsideFeatures']={d:v for d,v in c.get('hexsideFeatures',{}).items() if v.get('type')!='rail'}
    byId={c['id']:c for c in target['cells']}
    for link in new_links:
        a,b=link['from'],link['to'];d=g['directions'][a+':'+b]
        byId[a]['tileEdges'].setdefault(d,[]).append({'kind':'rail','status':STATUS})
        byId[b]['tileEdges'].setdefault(OPP[d],[]).append({'kind':'rail','status':STATUS})
    target['hexCenterRailConnections']=new_links
    target['railwayNetworkAudit']={'source':'definitive user-authored Kiev–Odessa SVG',
       'sourceSvgSha256':PIN,'internalLinks':93,'exteriorStubs':board.get('railwayNetworkAudit',{}).get('exteriorStubs'),
       'exteriorStubsCertified':False,'scope':'internal finite hexside crossings only',
       'method':'renderer-finite-hexside-crossings','visualCandidate':False,'gameplayCertified':False,
       'pending':'terrain, river, and remaining map geometry certification'}
    report={'checkpoint':193,'version':'v427','map':'kiev',
       'source':{'definitiveSvg':'maps/source/user-svg/kiev-odessa-main.svg','sha256':PIN,'routes':24,
                 'olderDraftSvg':'maps/source/user-svg/kiev-map-temp(5).svg','olderDraftSha256':sha(DRAFT),'olderDraftRoutes':36},
       'hexes':len(cent),'physicalInternalSides':len(g['segments']),
       'definitiveSourceLinks':len(links),'originalRegisteredLinks':len(baseline),
       'currentRegisteredLinks':len(existing),
       'registeredMissingFromDefinitive':sorted(baseline-links),
       'definitiveMissingFromRegistered':sorted(links-baseline),
       'definitiveNotInOldDraft':sorted(links-old['links']),
       'oldDraftNotInDefinitive':sorted(old['links']-links),
       'oldDraftFiniteCrossingCount':len(old['links']),
       'reciprocalRailSideRecords':2*len(links),'unresolvedGeometricCrossings':len(source['ambiguous']),
       'status':'rail-geometry-reconciled-not-gameplay-certified',
       'limitations':['Uses actual finite renderer hexside endpoints, not extended Voronoi boundaries.',
           'The two source paths that cross a *prolonged* border outside the real hexside do not create links.',
           'The older temporary SVG has a different rail network and is not the approved visible map.',
           'Terrain, rivers, and Kiev–Odessa extension movement are outside the scope.']}
    return target,report

def main():
    p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');p.add_argument('--write-audit',action='store_true');args=p.parse_args()
    board=json.loads(MAP.read_text());ext=json.loads(EXT.read_text());target,report=reconstruct(board,ext)
    if args.write:MAP.write_text(json.dumps(target,indent=2,ensure_ascii=False)+'\n')
    else:
        if target['cells']!=board['cells'] or target['hexCenterRailConnections']!=board['hexCenterRailConnections']:
            raise ValueError('Kiev rail network is not synchronized with definitive source')
    if args.write_audit:AUDIT.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k in ('definitiveSourceLinks','originalRegisteredLinks','registeredMissingFromDefinitive','definitiveMissingFromRegistered','oldDraftFiniteCrossingCount','reciprocalRailSideRecords')},indent=2))
if __name__=='__main__':main()
