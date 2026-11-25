#!/usr/bin/env python3
"""Kiev city terrain semantics and finite-hexside river evidence from definitive SVG.

City underlay remains unknown: the player aid defines City and Major City as
terrain in their own right. Do NOT silently classify the underlying base Open.
The 82 internal river sides are *source-geometry evidence*, NOT gameplay
authorization. The shared movement graph remains gated until its major-river
strength/movement rules can be represented and regression-tested.
"""
import argparse, hashlib, json, math, pathlib, subprocess
from collections import Counter
from importlib.machinery import SourceFileLoader
from lxml import etree as ET
from shapely.geometry import LineString
from fontTools.svgLib.path import parse_path

ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'maps/source/user-svg/kiev-odessa-main.svg'
AID=ROOT/'references/rules/kiev-player-aid.webp'
MAP=ROOT/'maps/kiev.json'
AUDIT=ROOT/'rules/audit/kiev-definitive-city-river-v429.json'
SVG_PIN='2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e'
CITY_STATUS='source-typed-city-terrain-v429'
INK='{http://www.inkscape.org/namespaces/inkscape}'
SAMPLE=SourceFileLoader('kiev_river_path_sampler',str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def pairs(a,b):return ':'.join(sorted((a,b)))

def geometry(board):
    js='''const T=require('./core/terrain_tiles'),m=require(process.argv[1]);console.log(JSON.stringify(T.gridSegmentData(m).filter(s=>s.neighborId).map(s=>({a:s.cellId,b:s.neighborId,ends:[s.a,s.b]}))));'''
    arr=json.loads(subprocess.check_output(['node','-e',js,str(MAP.resolve())],cwd=ROOT,text=True))
    if len(arr)!=442 or len({pairs(x['a'],x['b']) for x in arr})!=442:raise ValueError('Kiev grid no longer matches finite renderer hexsides')
    return arr

def inkscape_boxes():
    query=subprocess.check_output(['inkscape',str(SRC),'--query-all'],text=True,stderr=subprocess.DEVNULL)
    out={}
    for s in query.splitlines():
        fields=s.split(',')
        if len(fields)==5:
            try:out[fields[0]]=[float(v) for v in fields[1:]]
            except ValueError:pass
    return out

def extract(board):
    if sha(SRC)!=SVG_PIN:raise ValueError('Definitive Kiev–Odessa SVG SHA mismatch')
    source=ET.parse(SRC).getroot()
    layers={e.get(INK+'label'):e for e in source.iter() if e.get(INK+'groupmode')=='layer'}
    if not all(x in layers for x in ['minor','major','river-minor','river-major']):raise ValueError('SVG semantic layers missing')
    boxes=inkscape_boxes()
    cities={c['id']:c for c in board['cells'] if c.get('city')}
    if len(cities)!=16:raise ValueError('Kiev city set changed')
    source_city={}
    for label in ['minor','major']:
        for item in layers[label]:
            if ET.QName(item.tag).localname!='use':continue
            id=item.get('id');x,y,w,h=boxes[id];pos=(x+w/2,y+h/2)
            dist,cid=min((math.dist(pos,c['pixelCenter']),key) for key,c in cities.items())
            if dist>1.5:continue # Source also contains Odessa extension cities.
            if cid in source_city:raise ValueError('Multiple city terrain symbols registered to '+cid)
            if not (70<w<80 and 60<h<70):raise ValueError('Unexpected authored city background symbol')
            source_city[cid]={'svgId':id,'type':'major-city' if label=='major' else 'city','distancePx':round(dist,3)}
    if set(source_city)!=set(cities) or Counter(x['type'] for x in source_city.values())!=Counter({'city':15,'major-city':1}):
        raise ValueError('Kiev city geometry mismatch')
    if source_city['1404']['type']!='major-city':raise ValueError('Kiev Major City identity mismatch')

    path_source={}
    for label in ['river-minor','river-major']:
        layer=layers[label]; tx,ty=(92.629061,130.33038) if label=='river-minor' else (0,0)
        # Only straight authored polylines are allowed. No geometry guessing.
        for item in layer:
            if ET.QName(item.tag).localname!='path':continue
            id=item.get('id');p=SAMPLE.SamplePen();parse_path(item.get('d'),p)
            pts=[((x+tx)*3.7795275590551185,(y+ty)*3.7795275590551185) for x,y in p.points]
            if len(pts)<2:raise ValueError('Invalid SVG river path')
            path_source[id]=(label,LineString(pts))
    if Counter(x[0] for x in path_source.values())!=Counter({'river-minor':10,'river-major':4}):
        raise ValueError('Unexpected definitive river paths')
    records=[];grazes=[]
    for side in geometry(board):
        face=LineString(side['ends']);key=pairs(side['a'],side['b'])
        for id,(label,path) in path_source.items():
            overlap=path.intersection(face.buffer(1.5,cap_style=2)).length/face.length
            if overlap>=0.90:
                records.append({'hexPair':key,'kind':'majorRiver' if label=='river-major' else 'river','sourceSvgId':id,
                      'coverageFraction':round(min(overlap,1),4)})
            elif overlap>0.15:
                grazes.append({'hexPair':key,'sourceSvgId':id,'coverageFraction':round(overlap,4)})
    if grazes:raise ValueError('Intermediate river/side contacts require review: '+str(grazes[:5]))
    if len(records)!=82 or len({x['hexPair'] for x in records})!=82 or Counter(x['kind'] for x in records)!=Counter({'river':72,'majorRiver':10}):
        raise ValueError('River geometry deviated from reviewed side following evidence')
    records.sort(key=lambda z:(z['hexPair'],z['kind'],z['sourceSvgId']))
    # Source authorization is for visible geometry only. Do not mislabel it as executable.
    audit={'checkpoint':195,'version':'v429','sourceFile':'maps/source/user-svg/kiev-odessa-main.svg',
           'sourceSvgSha256':SVG_PIN,'playerAid':'references/rules/kiev-player-aid.webp',
           'playerAidSha256':sha(AID),'scope':'Objective: Kiev 165-cell upper board only',
           'method':'authored city terrain layer + exact finite renderer hexside centerline matching',
           'cityGameplayTerrain':dict(sorted(source_city.items())),
           'baseTerrainUnderCity':'not specified by source; existing display-only Open fallback retained',
           'cityCount':16,'cityTypes':{'city':15,'major-city':1},
           'riverHexsides':records,'riverCount':72,'majorRiverCount':10,'riverGeometryVerified':True,
           'movementAuthorized':False,'combatAuthorized':False,
           'limitations':['Only side-following lines with >=90% finite-side overlap within 1.5px are included.',
             'Incidental point contacts do not enter the river list.',
             'Major River changes movement and halves each crossing attacker strength; the current shared engine does not implement that mechanic.',
             'Source-derived edge geometry is not an authorization to activate the Kiev campaign.',
             'This does not certify the Kiev–Odessa extension seam.']}
    return audit

def build(board,audit):
    out=json.loads(json.dumps(board));cities=audit['cityGameplayTerrain']
    for c in out['cells']:
        if c['id'] not in cities:continue
        if c['terrain']!='open' or not c.get('city') or c.get('terrainStatus')=='definitive-user-svg-terrain-v428':
            raise ValueError('City fallback no longer matches prior map: '+c['id'])
        # Source-backed combat city identity; the shared engine expects these
        # markers, including a majorCity marker and an exact sourceSvgId.
        ms=[m for m in c.get('tileMarkers',[]) if m.get('kind') in ('city','majorCity')]
        if len(ms)!=1 or ms[0].get('label')!=c['city']['name']:
            raise ValueError('City marker identity does not match source: '+c['id'])
        ms[0]['kind']='majorCity' if cities[c['id']]['type']=='major-city' else 'city'
        ms[0]['sourceSvgId']=cities[c['id']]['svgId']
        c['terrainStatus']=CITY_STATUS
        c['sourceTerrainEvidence']={'sourceSvgIds':[cities[c['id']]['svgId']],
          'layer':cities[c['id']]['type'],'sourceSvgSha256':SVG_PIN,
          'semantics':'source-typed City or Major City; not explicit underlying Open terrain'}
        c.pop('sourceTerrainScores',None);c.pop('sourceTerrainConfidence',None)
    out['sourceStatus']='v429: 149 SVG base terrains + 16 separately source-typed City/Major City terrains; 82 SVG river-side geometries; Kiev movement remains gated'
    out['semanticRiverAudit']={'sourceFile':'rules/audit/kiev-definitive-city-river-v429.json',
     'status':'82 source-matched finite river-side geometries, NOT executable combat/movement authorization',
     'internalRivers':72,'internalMajorRivers':10,'sourceSvgSha256':SVG_PIN,
     'originalTenProvisionalSideObservations':'superseded by source-matched geometry'}
    return out

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');args=parser.parse_args()
    board=json.loads(MAP.read_text());audit=extract(board);new=build(board,audit)
    if args.write:
        MAP.write_text(json.dumps(new,indent=2,ensure_ascii=False)+'\n')
        AUDIT.write_text(json.dumps(audit,indent=2)+'\n')
    else:
        if new!=board:raise ValueError('Kiev City/river source synchronization stale')
        if not AUDIT.exists() or json.loads(AUDIT.read_text())!=audit:
            raise ValueError('Kiev river/city audit stale')
    print(json.dumps({'cityTerrain':audit['cityTypes'],'riverEdges':audit['riverCount'],
      'majorRiverEdges':audit['majorRiverCount'],'movementAuthorized':False}))

if __name__=='__main__':
    main()
