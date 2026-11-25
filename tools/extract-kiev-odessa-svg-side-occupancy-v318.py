#!/usr/bin/env python3
"""Checkpoint 79: common finite-side SVG measurements for Kiev and Kiev–Odessa.

The composed board is used for Odessa; never interpret the extension as an
independent playable map. Evidence is visual only, not gameplay permissions.
"""
import hashlib,json,pathlib,subprocess,sys,xml.etree.ElementTree as ET
from collections import Counter
from importlib.machinery import SourceFileLoader
from fontTools.svgLib.path import parse_path
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from core.svg_side_occupancy import evaluate
sampler=SourceFileLoader('cp79_sampler',str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()
DIRS=['N','NE','SE','S','SW','NW']
KIEV=ROOT/'maps/kiev.json';ODESSA=ROOT/'maps/odessa-extension.json'
OUTPUTS={'kiev':ROOT/'rules/audit/kiev-svg-side-occupancy-v318.json',
         'kiev-odessa':ROOT/'rules/audit/kiev-odessa-svg-side-occupancy-v318.json'}

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def get_source_vectors(mapdata,src,source_key):
    fname=src['sourceFile'];p=ROOT/'maps/source/user-svg'/fname
    if digest(p)!=src['sourceSvgSha256']:
        raise ValueError('authored SVG checksum mismatch: '+fname)
    transform=src['registration']
    result={}
    for kind,field in [('river','rivers'),('reinforcement','entryBoundaries')]:
        for item in src.get(field,[]):
            pen=sampler.SamplePen();parse_path(item['d'],pen)
            if len(pen.points)<2:raise ValueError('degenerate SVG vector: '+item['id'])
            pts=[(x*transform['scaleX']+transform['translateX'],
                  y*transform['scaleY']+transform['translateY']) for x,y in pen.points]
            key=source_key+':'+item['id']
            if key in result:raise ValueError('duplicate vector: '+key)
            result[key]={'kind':kind,'sourceSvgId':item['id'],'sourceKey':source_key,'points':pts}
    return result,{'sourceKey':source_key,'sourceFile':fname,'sourceSvgSha256':digest(p),
                   'registration':transform}

def build(which, kiev_path=KIEV, odessa_path=ODESSA):
    if which not in OUTPUTS:raise ValueError('unknown board '+str(which))
    kp=pathlib.Path(kiev_path);op=pathlib.Path(odessa_path)
    k=json.loads(kp.read_text());o=json.loads(op.read_text()) if which=='kiev-odessa' else None
    vector_sources=[('kiev',k['authoredSourceVectors'])]
    if o:
        vector_sources.extend(('odessa',src) for src in o['additionalSourceVectors'])
    vectors={};manifests=[]
    for label,src in vector_sources:
        found,manifest=get_source_vectors(k,src,label)
        overlap=set(vectors)&set(found)
        if overlap:raise ValueError('overlapping source keys')
        vectors.update(found);manifests.append(manifest)
    if o:
        # Odessa's two authored reinforcement traces are stored as sampled
        # *source* points in engine coordinates, not registry SVG d-strings.
        # Keep their distinct provenance and do not claim path precision.
        source_ids={el.get('id') for el in ET.parse(ROOT/'maps/source/user-svg'/o['additionalSourceVectors'][0]['sourceFile']).iter()}
        for trace in o.get('authoredReinforcementTraces',[]):
            if trace['sourceSvgId'] not in source_ids:raise ValueError('Odessa sampled trace lacks source SVG element')
            key='odessa:'+trace['sourceSvgId']
            pts=trace['points']
            if key in vectors or len(pts)<2:raise ValueError('invalid reinforcement trace')
            vectors[key]={'kind':'reinforcement','sourceSvgId':trace['sourceSvgId'],
                         'sourceKey':'odessa','points':pts,'sourceGeometry':'sampled-authored-trace'}
    js='''const T=require('./core/terrain_tiles');const C=require('./maps/composer');const k=require(process.argv[1]);const o=require(process.argv[2]);const b=process.argv[3]==='kiev-odessa'?C.compose(k,o):k;console.log(JSON.stringify({id:b.id,cells:b.cells.map(c=>c.id),segments:T.gridSegmentData(b).map(s=>({cellId:s.cellId,dir:s.dir,neighborId:s.neighborId,a:s.a,b:s.b}))}));'''
    raw=subprocess.check_output(['node','-e',js,str(kp.resolve()),str(op.resolve()),which],cwd=ROOT,text=True)
    board=json.loads(raw);ids=set(board['cells'])
    perhex={id:{'hexId':id,'sides':{}} for id in board['cells']}
    edges={};counters=Counter()
    for seg in board['segments']:
        a=seg['cellId'];side=seg['dir'];b=seg['neighborId'] if seg['neighborId'] in ids else None
        key='~'.join(sorted((a,b))) if b else a+':'+side
        members=[{'hexId':a,'dir':side}]
        if b:members.append({'hexId':b,'dir':DIRS[(DIRS.index(side)+3)%6]})
        if key in edges:raise ValueError('duplicate physical side '+key)
        obs=[]
        for source_id,info in sorted(vectors.items()):
            met=evaluate(info['points'],seg['a'],seg['b'])
            if met['relation']=='not-near-side':continue
            item={'kind':info['kind'],'sourceSvgId':info['sourceSvgId'],
                  'sourceKey':info['sourceKey'],**met,
                  'status':'svg-measured-visual-only','visualOnly':True}
            if 'sourceGeometry' in info:item['sourceGeometry']=info['sourceGeometry']
            obs.append(item)
            counters[info['kind']+':'+met['relation']]+=1
        if not obs:continue
        edges[key]={'edgeKey':key,'members':members,'observations':obs}
        for member in members:
            perhex[member['hexId']]['sides'][member['dir']]=[{'edgeKey':key,**v} for v in obs]
    return {'schemaVersion':1,'mapId':board['id'],'scope':which,
       'semantics':'svg-measured-visual-only','authorizedForMovement':False,
       'sources':manifests,'sourceMapSha256':digest(kp),
       'extensionMapSha256':digest(op) if o else None,
       'registrationStatus':'existing source transforms; no independent gameplay certification',
       'parameters':{'sideCorridorPx':3.0,'minProjectionFractionForSideFollow':0.55},
       'counts':{'hexes':len(ids),'physicalSidesWithObservations':len(edges),
                 'riverPaths':sum(v['kind']=='river' for v in vectors.values()),
                 'reinforcementPaths':sum(v['kind']=='reinforcement' for v in vectors.values()),
                 **dict(sorted(counters.items()))},
       'hexes':perhex,'edges':edges,
       'limitations':['All observations are visual-only; proximity is not guaranteed authored hexside occupancy.',
                      'Odessa reinforcement geometries originate in sampled authored traces, not original path d strings.',
                      'Kiev–Odessa is one composed map, not a standalone Odessa game.',
                      'Original SVG paths remain rendering authority; movement legality unchanged.']}

if __name__=='__main__':
    for mode in ('kiev','kiev-odessa'):
        x=build(mode)
        if '--write' in sys.argv:OUTPUTS[mode].write_text(json.dumps(x,indent=2)+'\n')
        print(mode,json.dumps(x['counts'],sort_keys=True))
