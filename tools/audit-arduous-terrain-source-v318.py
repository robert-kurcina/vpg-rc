#!/usr/bin/env python3
"""Reconcile authored Arduous terrain markers against the ORIGINAL SVG layers.

Source-integrity/readiness evidence only. Never infer 'open' from a missing marker,
or promote a visual geometry registration into movement certification.
"""
import argparse, collections, hashlib, json, pathlib, xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parents[1]
SVG = ROOT / 'maps/source/user-svg/arduous-map-temp(3).svg'
MAP = ROOT / 'maps/arduous.json'
OUT = ROOT / 'rules/audit/arduous-terrain-source-reconciliation-v318.json'
INK = '{http://www.inkscape.org/namespaces/inkscape}'

def inspect(map_path=MAP, svg_path=SVG):
    raw_map = pathlib.Path(map_path).read_bytes()
    raw_svg = pathlib.Path(svg_path).read_bytes()
    board = json.loads(raw_map)
    tree = ET.fromstring(raw_svg)
    parent = {child: p for p in tree.iter() for child in p}
    elements = {}
    for e in tree.iter():
        if e.get('id'):
            if e.get('id') in elements:
                raise ValueError('duplicate-svg-id:' + e.get('id'))
            elements[e.get('id')] = e
    cells = {c['id']: c for c in board['cells']}
    if len(cells) != len(board['cells']): raise ValueError('duplicate-map-cell')
    source = board['authoredSvgImportAudit']
    if hashlib.sha256(raw_svg).hexdigest() != source['sourceSvgSha256']:
        raise ValueError('svg-source-checksum-mismatch')
    reports, used, problems = [], set(), []
    for terrain, layer in [('forest', 'forests'), ('swamp', 'swamp')]:
        entries = source['details']['terrain'][terrain]
        if len(entries) != source[terrain + 'Markers']:
            raise ValueError('marker-count-mismatch:' + terrain)
        for item in entries:
            ident, hid = item['sourceSvgId'], item['cellId']
            if ident in used: raise ValueError('duplicate-marker:' + ident)
            used.add(ident)
            if hid not in cells: raise ValueError('marker-cell-missing:' + hid)
            cell = cells[hid]
            if cell.get('terrain') != terrain or cell.get('terrainStatus') != 'user-svg-authored-' + terrain:
                raise ValueError('marker-terrain-disagreement:' + hid)
            e = elements.get(ident)
            if e is None: raise ValueError('marker-svg-id-missing:' + ident)
            labels = []
            node = e
            while node is not None:
                if node.get(INK + 'label'): labels.append(node.get(INK + 'label'))
                node = parent.get(node)
            if layer not in labels: raise ValueError('marker-wrong-svg-layer:' + ident)
            if not e.get('d'): raise ValueError('marker-missing-path:' + ident)
            if e.tag.rsplit('}', 1)[-1] != 'path': raise ValueError('marker-not-path:' + ident)
            reports.append({'hexId':hid,'terrain':terrain,'sourceSvgId':ident,'sourceLayer':layer,
                            'registrationErrorPxRecorded':item['registrationErrorPx'],
                            'pathDataSha256':hashlib.sha256(e.get('d').encode()).hexdigest(),
                            'status':'authored-svg-marker-confirmed-not-gameplay-certified'})
    indexed = {r['hexId']:r for r in reports}
    if len(indexed) != len(reports): raise ValueError('multiple-markers-in-one-hex')
    for c in board['cells']:
        if c['terrainStatus'].startswith('user-svg-authored-') and c['id'] not in indexed:
            raise ValueError('authored-cell-unaccounted:' + c['id'])
    groups = collections.defaultdict(list);reviewed=[]
    for c in board['cells']:
        if c['id'] in indexed: continue
        if c.get('terrainStatus')=='source-svg-scan-reviewed-open-v412':
            if c.get('terrain')!='open':raise ValueError('reviewed-open-mismatch:'+c['id'])
            reviewed.append(c['id']);continue
        status = c.get('terrainStatus') or 'missing-status'
        groups[status].append({'hexId':c['id'], 'candidateTerrain':c.get('terrain'),
                               'sourceTerrainConfidence':c.get('sourceTerrainConfidence'),
                               'reviewReason': ('missing-terrain-transcription' if c.get('terrain') is None
                                                else 'no-explicit-authored-terrain-marker')})
    expected_by_layer = {}
    for kind, layer in [('forest','forests'), ('swamp','swamp')]:
        layer_nodes = [e for e in tree.iter() if e.get(INK+'label') == layer]
        if len(layer_nodes) != 1: raise ValueError('missing-or-duplicate-svg-layer:'+layer)
        expected_by_layer[kind] = len([e for e in layer_nodes[0].iter() if e.tag.rsplit('}',1)[-1]=='path'])
        if expected_by_layer[kind] != source[kind+'Markers']:
            raise ValueError('unregistered-source-markers:'+kind)
    return {'schemaVersion':1,'scope':'Arduous authored forest/swamp source and per-hex review; NOT movement certification',
            'sourceMapSha256':hashlib.sha256(raw_map).hexdigest(), 'sourceSvgSha256':hashlib.sha256(raw_svg).hexdigest(),
            'coverage':{'hexes':len(cells),'verifiedSourceMarkerRecords':len(reports),
                        'sourceLayerPathCounts':expected_by_layer,'provisionalHexes':sum(map(len,groups.values())),
                        'reviewedOpenHexes':len(reviewed),
                        'provisionalByStatus':{k:len(v) for k,v in sorted(groups.items())}},
            'authoredTerrainEvidence':sorted(reports,key=lambda x:x['hexId']),
            'unresolvedByStatus':{k:sorted(v,key=lambda x:x['hexId']) for k,v in sorted(groups.items())},
            'reviewedOpenHexIds':sorted(reviewed),
            'blockingEvidence':['Arduous source SVG references an external scan image absent from this package',
                               'Reviewed open cells are source-scan corroborations, not proof of whole-map movement legality',
                               'Visual registration and railway/river/hexside legality remain uncertified'],
            'authorizedForMovement':False}

def main():
    p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');args=p.parse_args()
    result=inspect()
    if args.write:
        OUT.write_text(json.dumps(result,indent=2)+'\n')
        print('wrote',OUT.relative_to(ROOT))
    print(json.dumps(result['coverage'],indent=2))
if __name__=='__main__':main()
