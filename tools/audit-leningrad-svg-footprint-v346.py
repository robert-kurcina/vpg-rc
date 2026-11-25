#!/usr/bin/env python3
"""Source-SVG geometric footprint audit for Leningrad. No gameplay mutation.

Uses Inkscape for bounding-box evidence of source paint coverage; source hex
centers themselves are calculated analytically from SVG vector geometry.
Historically printed numbers are deliberately NOT inferred from internal IDs.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'maps/source/user-svg/leningrad-main.svg'
MAP = ROOT / 'maps/leningrad.json'
REPORT = ROOT / 'rules/audit/leningrad-svg-footprint-v346.json'
SOD = '{http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd}'
INK = '{http://www.inkscape.org/namespaces/inkscape}'
NUM = r'[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?'
LAYER = {'layer14':'open', 'layer6':'forest', 'g416':'swamp', 'layer19':'sea'}

def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def transform(text):
    s = text.strip()
    if s.startswith('matrix(') and s.endswith(')'):
        v = list(map(float, re.findall(NUM, s[7:-1])))
        if len(v) != 6: raise ValueError('Malformed matrix')
        return v
    if s.startswith('translate(') and s.endswith(')'):
        v = list(map(float, re.findall(NUM, s[10:-1])))
        if len(v) not in (1,2): raise ValueError('Malformed translation')
        return [1,0,0,1,v[0],v[1] if len(v)==2 else 0]
    raise ValueError('Unsupported authored SVG transform: '+s)

def apply(t, pt):
    a,b,c,d,e,f = t
    x,y = pt
    return (a*x+c*y+e,b*x+d*y+f)

def source_centers(tree):
    svg = tree.getroot()
    width = svg.get('width','')
    if not width.endswith('mm'): raise ValueError('Unexpected SVG width units')
    # Authored mm source exported as 96 dpi SVG pixels by the same renderer.
    scale = 96/25.4
    layer = next((e for e in svg.iter() if e.get('id')=='layer9'), None)
    if layer is None or layer.get(INK+'label')!='hexgrid':
        raise ValueError('Missing authoritative SVG hexgrid layer')
    group = transform(layer.attrib['transform'])
    out = []
    for e in layer:
        path_id = e.get('id')
        if not path_id or e.tag.split('}')[-1] != 'path':
            raise ValueError('Unexpected non-path source grid element')
        x,y = float(e.get(SOD+'cx')),float(e.get(SOD+'cy'))
        x,y = apply(transform(e.attrib['transform']),(x,y))
        x,y = apply(group,(x,y))
        out.append({'svgPathId':path_id,'x':x*scale,'y':y*scale})
    return out

def query_bboxes(svg_path):
    proc = subprocess.run(['inkscape', str(svg_path), '--query-all'],capture_output=True,text=True,check=True)
    out={}
    for r in csv.reader(io.StringIO(proc.stdout)):
        if len(r)==5:
            try: out[r[0]]=tuple(float(v) for v in r[1:])
            except ValueError: pass
    if len(out)<300: raise ValueError('Incomplete source bbox export')
    return out

def painted_hits(root, boxes, point):
    hits={}
    for layer_id,terrain in LAYER.items():
        layer=next((e for e in root.iter() if e.get('id')==layer_id),None)
        if layer is None: raise ValueError('Missing terrain paint source layer '+layer_id)
        match=[]
        for e in layer.iter():
            if e is layer or len(e): continue  # only leaf geometry
            pid=e.get('id')
            if pid not in boxes: continue
            x,y,w,h=boxes[pid]
            if x<=point[0]<=x+w and y<=point[1]<=y+h:
                match.append(pid)
        hits[terrain]=sorted(match)
    return hits

def candidate_id(pt,cal):
    col=round((pt[0]-cal['originX'])/cal['pitchX'])+1
    # Current source physical grid has higher even *internal* columns;
    # this is a diagnostic slot name, not a historical printed coordinate.
    row=round((pt[1]-cal['originY']-(cal['staggerY'] if col%2==1 else 0))/cal['pitchY'])+1
    return f'{col:02}{row:02}'

def audit(source=SOURCE, map_file=MAP, *, bbox=None):
    source,map_file=Path(source),Path(map_file)
    board=json.loads(map_file.read_text())
    cells=board['cells']
    tree=ET.parse(source)
    centers=source_centers(tree)
    boxes=bbox if bbox is not None else query_bboxes(source)
    # Collapse only genuine overlapping authored path centers, never by guessed IDs.
    groups=[]
    for item in centers:
        found=next((g for g in groups if math.hypot(g['x']-item['x'],g['y']-item['y'])<0.01),None)
        if found:found['svgPathIds'].append(item['svgPathId'])
        else:groups.append({'x':item['x'],'y':item['y'],'svgPathIds':[item['svgPathId']]})
    candidates=[]
    seen=set()
    for g in groups:
        xy=(g['x'],g['y'])
        near=sorted((math.dist(xy,c['pixelCenter']),c['id']) for c in cells)
        distance,cid=near[0]
        if distance < 0.02:
            if cid in seen: raise ValueError('Multiple unique grid positions assigned to one runtime cell '+cid)
            seen.add(cid)
            candidates.append({'geometrySlot':cid,'runtimeCell':cid,'sourceSvgPaths':sorted(g['svgPathIds']), 'errorPx':round(distance,5)})
        else:
            slot=candidate_id(xy,board['geometry']['calibration'])
            hits=painted_hits(tree.getroot(),boxes,xy)
            candidates.append({'geometrySlot':slot,'runtimeCell':None,'sourceSvgPaths':sorted(g['svgPathIds']),
                'x':round(xy[0],3),'y':round(xy[1],3),
                'nearestRuntimeCell':cid,'nearestDistancePx':round(distance,3),'terrainPaintBBoxHits':hits})
    missing=sorted((c['id'] for c in cells if c['id'] not in seen))
    unregistered=sorted((c for c in candidates if c['runtimeCell'] is None),key=lambda o:o['geometrySlot'])
    duplicate=[{'svgPathIds':sorted(g['svgPathIds']),'physicalCenter':[round(g['x'],3),round(g['y'],3)]} for g in groups if len(g['svgPathIds'])>1]
    return {
      'schemaVersion':1,'sourceSvg':'maps/source/user-svg/leningrad-main.svg',
      'sourceSvgSHA256':sha(source),'runtimeMapSHA256':sha(map_file),
      'sourceGridPathCount':len(centers),'distinctSourceGridCenters':len(groups),
      'runtimeHexCells':len(cells),'matchedRuntimeCells':len(seen),
      'duplicateSvgGridPaths':duplicate,'gridOnlyUnpaintedOutlines':unregistered,
      'runtimeCellsWithoutSourceGridPosition':missing,
      'historicalLegacyCellCount':board['v301ImportAudit']['hexes'],
      'sourceFootprintReconciled':(
        len(centers)==200 and len(groups)==199 and len(cells)==197 and len(seen)==197 and
        not missing and len(duplicate)==1 and set(duplicate[0]['svgPathIds'])=={'path68','path172'} and
        [c['geometrySlot'] for c in unregistered]==['1801','2001'] and
        all(not any(c['terrainPaintBBoxHits'].values()) for c in unregistered)),
      'semanticBoundary':'200 SVG grid paths = 199 unique outlines including two unpainted north-edge outline-only slots. 197 runtime terrain cells is the backed terrain footprint; no unit/terrain/new hex registered. Geometry-slot names are internal coordinates, not certified historical printed IDs.',
      'approvedVisualBaseline':'v345 user-approved left render; preserved without mutation'
    }

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source',default=str(SOURCE));p.add_argument('--map',default=str(MAP));p.add_argument('--output',default=str(REPORT))
    a=p.parse_args()
    report=audit(a.source,a.map)
    Path(a.output).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['sourceGridPathCount','distinctSourceGridCenters','runtimeHexCells','matchedRuntimeCells','sourceFootprintReconciled']},indent=2))
    if not report['sourceFootprintReconciled']:raise SystemExit('NOT CERTIFIED: vector footprint mismatch')
if __name__=='__main__':main()
