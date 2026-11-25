#!/usr/bin/env python3
"""Certify Objective: Kiev base terrain from *explicit* definitive SVG terrain symbols.

This is NOT river/hexside certification. The source has no explicit base terrain
symbol under 16 city overlay hexes; retain their existing visual base but do
not mark them source-certified. Uses the same Inkscape --query-all source-bound
registration as the original authoritative-svg import. No bitmap sampling.
"""
import argparse, collections, copy, hashlib, json, math, pathlib, subprocess
from lxml import etree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'maps/source/user-svg/kiev-odessa-main.svg'
MAP=ROOT/'maps/kiev.json'; EXT=ROOT/'maps/odessa-extension.json'
AUDIT=ROOT/'rules/audit/kiev-definitive-terrain-v428.json'
PIN='2b15c3a92a282a7efc27d54bcd8994470f0fce8ee5417d5d734969fcd2c4ab7e'
STATUS='definitive-user-svg-terrain-v428'
LAYER_TO_TERRAIN={'open':'open','forests':'forest','swamp':'swamp'}
EXPECTED={'open':97,'forest':41,'swamp':11}
CITY_IDS=['0201','0404','0502','0507','0706','0708','0803','0902','0905','1010','1105','1107','1404','1408','1602','1708']
PREVIOUS_SWAMP=['0403','0608','1009']
INK='{http://www.inkscape.org/namespaces/inkscape}'
def sha(b):return hashlib.sha256(b).hexdigest()
def gather(board,extension,query_text):
    svg_bytes=SRC.read_bytes()
    if sha(svg_bytes)!=PIN or extension['authoritativeCompositeSvg']['sha256']!=PIN:
        raise ValueError('Definitive SVG pin mismatch')
    root=ET.fromstring(svg_bytes)
    layers={e.get(INK+'label'):e for e in root.iter() if e.get(INK+'groupmode')=='layer'}
    if not all(name in layers for name in LAYER_TO_TERRAIN):raise ValueError('Definitive terrain layers missing')
    boxes={}
    for line in query_text.splitlines():
        parts=line.split(',')
        if len(parts)==5:
            try: boxes[parts[0]]=tuple(float(z) for z in parts[1:])
            except ValueError: pass
    cells={c['id']:c for c in board['cells']+extension['cells']}
    if len(cells)!=261 or len(board['cells'])!=165 or len(cells)!=len(board['cells'])+len(extension['cells']):
        raise ValueError('Unexpected complete map or duplicate hex ID')
    records=collections.defaultdict(list)
    for layer,terrain in LAYER_TO_TERRAIN.items():
        for elem in layers[layer].iter():
            typ=ET.QName(elem.tag).localname; id=elem.get('id')
            if typ not in ('use','path','rect') or id not in boxes:continue
            x,y,w,h=boxes[id]
            if not (60<w<82 and 58<h<75):raise ValueError('Unexpected terrain symbol bounds '+id)
            center=(x+w/2,y+h/2)
            d,cid=min((math.dist(center,tuple(c['pixelCenter'])),key) for key,c in cells.items())
            if d>=6:raise ValueError('Terrain symbol not aligned to authored hex: '+id)
            records[cid].append({'terrain':terrain,'sourceSvgId':id,'registrationDistancePx':round(d,3)})
    for cid,entries in records.items():
        if len({entry['terrain'] for entry in entries})!=1:
            raise ValueError('Conflicting explicit terrain layers at '+cid)
    base={c['id']:c for c in board['cells']}
    definite={cid:entries for cid,entries in records.items() if cid in base}
    cities=sorted(set(base)-set(definite))
    count=collections.Counter(entries[0]['terrain'] for entries in definite.values())
    if dict(count)!=EXPECTED or cities!=CITY_IDS:
        raise ValueError('Kiev terrain registration changed: '+str((count,cities)))
    if any(not base[id].get('city') for id in cities):raise ValueError('Unclassified hex without a city symbol')
    corrections=sorted(cid for cid,entry in definite.items() if base[cid].get('userTerrainAdjudication',{}).get('previousTerrain',base[cid]['terrain'])!=entry[0]['terrain'])
    if corrections not in (PREVIOUS_SWAMP,[]):raise ValueError('Unexpected terrain mismatch: '+str(corrections))
    modified=copy.deepcopy(board);by={c['id']:c for c in modified['cells']}
    for cid,entries in definite.items():
        c=by[cid]; c['terrain']=entries[0]['terrain'];c['terrainStatus']=STATUS
        c['sourceTerrainEvidence']={'sourceSvgIds':sorted(e['sourceSvgId'] for e in entries),
            'layer':entries[0]['terrain'],'sourceSvgSha256':PIN,
            'maxRegistrationErrorPx':max(e['registrationDistancePx'] for e in entries)}
        # Keep source registration truthful. Apply explicitly recorded user
        # adjudications AFTER source extraction, never edit the source SVG.
        adjudication=c.get('userTerrainAdjudication')
        if adjudication:
            if (adjudication.get('previousTerrain')!=entries[0]['terrain'] or
                adjudication.get('terrain') not in LAYER_TO_TERRAIN.values() or
                not adjudication.get('directive') or not adjudication.get('sourceTerrainUnchanged')):
                raise ValueError('Invalid user adjudication versus source at '+cid)
            c['terrain']=adjudication['terrain']
            c['terrainStatus']='user-adjudicated-terrain-v435'
        # Old bitmap scores are obsolete where an explicit source vector exists.
        c.pop('sourceTerrainScores',None);c.pop('sourceTerrainConfidence',None)
    modified['definitiveTerrainAudit']={'sourceFile':'maps/source/user-svg/kiev-odessa-main.svg','sourceSvgSha256':PIN,
        'terrainSource':'explicit-open-forest-swamp-svg-symbols','certifiedHexes':len(definite),
        'explicitTerrainCounts':EXPECTED,'unclassifiedCityBaseHexes':cities,
        'correctionsFromProvisionalSwamp':PREVIOUS_SWAMP,
        'scope':'base terrain only: not river, movement, grid or historical setup certification'}
    modified['sourceStatus']='v428: 149 explicit authored base terrain hexes, 16 city-overlay bases unresolved; Kiev movement disabled'
    audit={'checkpoint':194,'version':'v428','map':'kiev','sourceSvgSha256':PIN,
        'source':'maps/source/user-svg/kiev-odessa-main.svg',
        'method':'Inkscape --query-all explicit use/path terrain markers registered to calibrated engine hex centers',
        'counts':dict(sorted(count.items())),'sourceCertifiedHexes':len(definite),'cityOverlayWithoutBaseSymbol':cities,
        'correctedTerrainHexes':PREVIOUS_SWAMP,'unresolvedRiverHexsides':'not addressed by this audit',
        'sourceDuplicates':{cid:[e['sourceSvgId'] for e in entries] for cid,entries in records.items() if len(entries)>1},
        'certifiedRecords':[{ 'id':cid,'terrain':entries[0]['terrain'],
            'sourceSvgIds':sorted(e['sourceSvgId'] for e in entries)} for cid,entries in sorted(definite.items())],
        'limitations':['Authoritative source has no explicit base terrain marks in 16 city hexes.',
            'No source-authoritative river or Major River gameplay hexsides are certified here.',
            'The shared movement graph remains blocked.']}
    return modified,audit

def reconcile(write=False):
    b=json.loads(MAP.read_text());ex=json.loads(EXT.read_text())
    query=subprocess.check_output(['inkscape',str(SRC),'--query-all'],text=True,stderr=subprocess.DEVNULL)
    new,report=gather(b,ex,query)
    if not write:
        if new['cells']!=b['cells'] or new['definitiveTerrainAudit']!=b.get('definitiveTerrainAudit'):
            raise ValueError('Kiev terrain not synchronized with explicit definitive source terrain')
        if report!=json.loads(AUDIT.read_text()):raise ValueError('Kiev terrain source audit is stale')
    else:
        MAP.write_text(json.dumps(new,indent=2,ensure_ascii=False)+'\n')
        AUDIT.write_text(json.dumps(report,indent=2)+'\n')
    return report
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');args=p.parse_args()
    rep=reconcile(args.write)
    print(json.dumps({k:rep[k] for k in ['counts','sourceCertifiedHexes','cityOverlayWithoutBaseSymbol','correctedTerrainHexes']},indent=2))
