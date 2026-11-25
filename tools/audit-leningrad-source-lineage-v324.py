#!/usr/bin/env python3
"""Inventory all bundled Leningrad SVG/scan source families without gameplay authorization."""
from pathlib import Path
from hashlib import sha256
import xml.etree.ElementTree as ET
import json

ROOT=Path(__file__).resolve().parents[1]
SOURCES=ROOT/'maps/source'
SVG_DIR=SOURCES/'user-svg'
HREF='{http://www.w3.org/1999/xlink}href'

def report(svg_dir=SVG_DIR, scans_dir=SOURCES):
    svg_files=sorted(svg_dir.glob('leningrad*.svg'))
    if len(svg_files)<2: raise ValueError('Need both SVG families')
    families={}
    for path in svg_files:
        data=path.read_bytes(); digest=sha256(data).hexdigest()
        root=ET.fromstring(data)
        matches=[]
        ids={}
        for e in root.iter():
            if e.get('id'): ids[e.get('id')]=ids.get(e.get('id'),0)+1
            if e.tag.rsplit('}',1)[-1]=='use':
                href=e.get(HREF) or e.get('href')
                if href in ('#g10','#symbol122'):
                    matches.append({'id':e.get('id'),'symbolId':href[1:],'transform':e.get('transform')})
        if any(ids.get(x['id'])!=1 for x in matches): raise ValueError('Ambiguous cross instance ID')
        group=families.setdefault(digest,{'sha256':digest,'files':[],'crossCount':len(matches),'crossInstances':matches})
        if group['crossInstances']!=matches: raise ValueError('Digest collision or inconsistent extraction')
        group['files'].append(str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else path.name)
    counts=sorted(x['crossCount'] for x in families.values())
    if counts!=[4,5]: raise ValueError(f'Unexpected authored families/counts: {counts}')
    scans=sorted(scans_dir.glob('leningrad-map-scan*.jpg'))
    scan_groups={}
    for p in scans:
        digest=sha256(p.read_bytes()).hexdigest()
        scan_groups.setdefault(digest,[]).append(str(p.relative_to(ROOT)))
    if not scans: raise ValueError('Original scan missing')
    return {'schemaVersion':1,'scenario':'leningrad',
            'families':sorted(families.values(),key=lambda x:x['crossCount']),
            'scanDigests':[{'sha256':d,'files':paths} for d,paths in sorted(scan_groups.items())],
            'printedRulesCrossCount':5,
            'visualScanObservation':'Five German cross symbols visible near East Prussia in the bundled board scan; visual observation is not an independent hex-coordinate registration.',
            'inference':'The 5-cross main.svg family agrees with the rules and visible scan cross count. Duplicate copies are identical bytes, not independent witnesses. Hex placements and unit identity are not authorized.',
            'sourceAuthority':'main-five-cross-candidate-not-promoted',
            'historicalSetupAuthorized':False}

if __name__=='__main__':
    out=ROOT/'rules/audit/leningrad-source-lineage-v324.json'
    out.write_text(json.dumps(report(),indent=2)+'\n')
    print(out.relative_to(ROOT))
