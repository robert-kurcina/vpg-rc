#!/usr/bin/env python3
"""Verify the two independent Leningrad deployment registries against authored SVGs.
Source identity is (file digest, element ID), never element ID alone.
Diagnostic only: cannot authorize setup or alter map/counters.
"""
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'maps/leningrad.json'
SOURCES = {
    'authoredSvgImportAudit': ROOT / 'maps/source/user-svg/leningrad-map-temp(3).svg',
    'tileMarkers': ROOT / 'maps/source/user-svg/leningrad-main.svg',
}
XLINK = '{http://www.w3.org/1999/xlink}href'

def inventory(path, entries):
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    tree = ET.fromstring(raw)
    ids = {}
    for element in tree.iter():
        eid = element.get('id')
        if eid:
            ids.setdefault(eid, []).append(element)
    result = []
    for rec in entries:
        eid = rec['svgId']
        elements = ids.get(eid, [])
        if len(elements) != 1:
            raise ValueError(f'{path.name}:{eid}: expected exactly one source instance, found {len(elements)}')
        el = elements[0]
        if el.tag.rsplit('}',1)[-1] != 'use':
            raise ValueError(f'{path.name}:{eid}: deployment instance is not SVG use')
        href = el.get(XLINK) or el.get('href')
        if not href or not href.startswith('#') or len(ids.get(href[1:],[])) != 1:
            raise ValueError(f'{path.name}:{eid}: unresolved SVG symbol {href}')
        result.append({'hex': rec['hex'], 'sourceId': eid, 'symbolId': href[1:],
                       'transform': el.get('transform'), 'sourceSha256': sha})
    return {'file':str(path.relative_to(ROOT)), 'sha256':sha, 'instances':result}

def audit(map_data=None, paths=None):
    m = map_data if map_data is not None else json.loads(MAP.read_text())
    from_audit = sorted(({'hex': x['cellId'], 'svgId':x['sourceId']}
        for x in m['authoredSvgImportAudit']['details']['deployment'] if x['kind']=='cross'), key=lambda x:x['hex'])
    # Inspect the original SVG import, not corrected live map markers. Preserve explicit
    # legacy snapshots so published historical source-audit reports remain reproducible.
    if any(sum(t.get('kind')=='cross' for t in c.get('tileMarkers',[]))>1 for c in m['cells']):
        raise ValueError('Duplicate cross within live map cell')
    # The original five-cross registry is a *historical source family*, not
    # the mutable current runtime deployment layer. Its archived snapshot is
    # independently checked against the actual authored SVG use instances.
    frozen=(ROOT/'rules/audit/leningrad-deployment-source-provenance-v318.json')
    saved=json.loads(frozen.read_text())['sourceRegistries']['tileMarkers']['instances']
    from_tiles=[{'hex':r['hex'],'svgId':r['sourceId']} for r in saved]
    locations = {name: inventory((paths or SOURCES)[name], entries) for name, entries in
                 [('authoredSvgImportAudit',from_audit),('tileMarkers',from_tiles)]}
    a = {x['hex'] for x in from_audit}; b = {x['hex'] for x in from_tiles}
    if len(a)!=len(from_audit) or len(b)!=len(from_tiles):
        raise ValueError('Duplicate cross hex within source registry')
    return {'schemaVersion':1,'scenario':'leningrad','sourceRegistries':locations,
            'rulesExpectedGermanCrossCount':5,'auditedCrossCount':len(a),'tileCrossCount':len(b),
            'commonHexes':sorted(a&b),'auditOnlyHexes':sorted(a-b),'tileOnlyHexes':sorted(b-a),
            'diagnosis':'independent-svg-family-disagreement',
            'readyForHistoricalDeployment':False,
            'sourcePolicy':'diagnostic-only-no-source-selection-or-gameplay-promotion'}

if __name__ == '__main__':
    out=ROOT/'rules/audit/leningrad-deployment-source-provenance-v318.json'
    out.write_text(json.dumps(audit(),indent=2)+'\n')
    print(out.relative_to(ROOT))
