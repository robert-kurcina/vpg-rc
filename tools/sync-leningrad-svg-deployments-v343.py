#!/usr/bin/env python3
"""Derive Leningrad deployment host cells directly from authored SVG symbol geometry.

Never uses scans, raster matching, textual hex numbers, or any historical marker
placement as a fitting anchor. Inkscape's original SVG <use> geometry is matched
against the existing physical cell-center lattice. Does not change the shared
renderer, hex numbering, terrain, or adjacency.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SVG = ROOT / 'maps/source/user-svg/leningrad-main.svg'
BOARD = ROOT / 'maps/leningrad.json'
AUDIT = ROOT / 'rules/audit/leningrad-svg-hostcells-v343.json'
XLINK = '{http://www.w3.org/1999/xlink}href'
SYMBOLS = {'g10': ('cross', 'german'), 'g11': ('star', 'soviet')}
TOL = 0.06


def bbox_index(svg: Path) -> dict[str, tuple[float, float, float, float]]:
    call = subprocess.run(['inkscape', str(svg), '--query-all'], text=True, capture_output=True, check=True)
    out = {}
    for line in call.stdout.splitlines():
        bits = line.split(',')
        if len(bits) == 5:
            try:
                out[bits[0]] = tuple(float(v) for v in bits[1:])
            except ValueError:
                continue
    if not out:
        raise ValueError('Inkscape returned no SVG bounding boxes')
    return out


def positions(svg=SVG, board=BOARD):
    raw = svg.read_bytes()
    source_sha = hashlib.sha256(raw).hexdigest()
    root = ET.fromstring(raw)
    by_id = {}
    for el in root.iter():
        k = el.get('id')
        if k:
            if k in by_id:
                raise ValueError(f'duplicate SVG ID {k}')
            by_id[k] = el
    for symbol in SYMBOLS:
        if symbol not in by_id:
            raise ValueError(f'missing source SVG symbol #{symbol}')
    rects = bbox_index(svg)
    data = json.loads(board.read_text())
    cells = data['cells']
    assignments = []
    for el in root.iter():
        if el.tag.rsplit('}', 1)[-1] != 'use':
            continue
        href = el.get(XLINK) or el.get('href')
        if not href or not href.startswith('#') or href[1:] not in SYMBOLS:
            continue
        sid = el.get('id')
        if not sid or sid not in rects:
            raise ValueError(f'source symbol use missing queryable SVG ID {sid}')
        x, y, w, h = rects[sid]
        if not (w > 0 and h > 0):
            raise ValueError(f'bad symbol geometry {sid}')
        center = (x + w/2, y + h/2)
        scored = sorted(((math.dist(center, c['pixelCenter']), c) for c in cells), key=lambda a: a[0])
        dist, host = scored[0]
        if dist > TOL:
            raise ValueError(f'SVG symbol {sid} center {center} does not match a physical hex center: distance {dist:.4f}')
        if len(scored) > 1 and scored[1][0] - dist < 10:
            raise ValueError(f'ambiguous nearest physical hex for {sid}')
        kind, faction = SYMBOLS[href[1:]]
        assignments.append({'sourceSvgId': sid, 'symbolId': href[1:], 'kind': kind, 'faction': faction,
                            'hostCell': host['id'], 'sourceSvgCenter': [round(c, 4) for c in center],
                            'hostPhysicalCenter': host['pixelCenter'], 'centerError': round(dist, 6)})
    assignments.sort(key=lambda a: (a['kind'], a['hostCell']))
    # The same authored SVG geometry also validates the pre-existing city host cells.
    # For cities, their source symbols are usually larger and their bounding-box
    # centers can differ slightly from hex centers. Nearest-cell association is
    # checked with a bounded 3-unit tolerance; no scan or printed label is used.
    cities = []
    for c in cells:
        for m in c.get('tileMarkers',[]):
            if m.get('kind') != 'city':
                continue
            sid = m.get('sourceSvgId') or m.get('originalSourceSvgId')
            if not sid or sid not in rects:
                raise ValueError(f'city {m.get("label")} missing SVG source element ID')
            x, y, w, h = rects[sid]
            center = [x+w/2, y+h/2]
            scored = sorted(((math.dist(center, cc['pixelCenter']), cc) for cc in cells), key=lambda a: a[0])
            distance, host = scored[0]
            if distance > 3:
                raise ValueError(f'city {m.get("label")} SVG center does not match physical grid ({distance:.3f})')
            cities.append({'name':m.get('label'),'sourceSvgId':sid, 'previousHostCell':c['id'],
                          'hostCell':host['id'],'centerError':round(distance,4)})
    if (sum(a['kind']=='cross' for a in assignments), sum(a['kind']=='star' for a in assignments)) != (5, 5):
        raise ValueError('authored SVG must contain exactly five cross and five star use instances')
    if len({a['hostCell'] for a in assignments}) != 10:
        raise ValueError('source SVG symbols are not in ten distinct host cells')
    return data, {'schemaVersion': 1, 'source': 'maps/source/user-svg/leningrad-main.svg',
                  'sourceSHA256': source_sha, 'basis': 'authored SVG use-element rendered bounding-box centers',
                  'matching': 'nearest existing physical cell pixelCenter within 0.06 SVG units',
                  'usesScans': False, 'modifiesRenderer': False, 'gameplayCertified': False,
                  'assignments': assignments, 'cityAssignments':cities}


def build_map(data, report):
    # Delete only *active* cross/star marker registrations, not source evidence or non-deployment features.
    for c in data['cells']:
        c['tileMarkers'] = [m for m in c.get('tileMarkers',[]) if m.get('kind') not in {'cross','star'}]
    cells = {c['id']:c for c in data['cells']}
    # Move a city only when its current host differs from its SVG geometric host.
    for city in report['cityAssignments']:
        if city['previousHostCell'] == city['hostCell']:
            continue
        old,new = cells[city['previousHostCell']],cells[city['hostCell']]
        if new.get('city') or any(m.get('kind')=='city' for m in new.get('tileMarkers',[])):
            raise ValueError(f'city target already occupied: {city}')
        marker = next(m for m in old['tileMarkers'] if m.get('kind')=='city' and m.get('label')==city['name'])
        old['tileMarkers'].remove(marker)
        marker.update({'sourceSvgId':city['sourceSvgId'], 'status':'authored-svg-geometry-v343'})
        new['tileMarkers'].append(marker)
        town=old.pop('city')
        town.update({'locationStatus':'authored-svg-geometry-v343','sourceSvgId':city['sourceSvgId']})
        new['city']=town
    for a in report['assignments']:
        cells[a['hostCell']].setdefault('tileMarkers', []).append({
            'kind': a['kind'], 'faction': a['faction'],
            'hostCell': a['hostCell'], 'sourceSvgId': a['sourceSvgId'],
            'sourceSymbolId': a['symbolId'], 'sourceSvgCenter': a['sourceSvgCenter'],
            'status': 'authored-svg-geometry-v343'})
    prior_city_changes=data.get('v343SourceSvgHostCells',{}).get('cityHostCorrections',[])
    data['v343SourceSvgHostCells'] = {
        'status': 'live-SVG-geometry-host-cells; historical-setup-not-yet-certified',
        'source': report['source'], 'sourceSHA256': report['sourceSHA256'],
        'hostCellAssignments': [{k: a[k] for k in ('kind','sourceSvgId','hostCell')} for a in report['assignments']],
        'cityHostCorrections': prior_city_changes or [c for c in report['cityAssignments'] if c['previousHostCell']!=c['hostCell']],
        'rendererPolicy': 'universal-unchanged', 'scanEvidenceUsed': False,
        'supersedesActive': ['v342GridRegisteredDeployment'],
        'remaining': ['canonical printed ID re-key','source SVG versus board-scan conflict, if historical setup requires resolution']}
    return data


def check_live(data, report):
    expected = sorted((a['kind'],a['hostCell'],a['sourceSvgId']) for a in report['assignments'])
    actual = sorted((m['kind'],c['id'],m.get('sourceSvgId')) for c in data['cells']
                    for m in c.get('tileMarkers',[]) if m.get('kind') in {'cross','star'})
    if expected != actual:
        raise ValueError(f'active deployment markers differ from authored source SVG: expected {expected}, got {actual}')
    for record in report['cityAssignments']:
        active = [c['id'] for c in data['cells'] if any(m.get('kind')=='city' and m.get('label')==record['name'] for m in c.get('tileMarkers',[]))]
        if active != [record['hostCell']]:
            raise ValueError(f'city host differs from authored source SVG: {record["name"]} {active} != {record["hostCell"]}')
    if data.get('geometry',{}).get('deploymentMarkerPlacement') is not None:
        raise ValueError('scenario-specific marker renderer option prohibited')


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--apply',action='store_true')
    p.add_argument('--check',action='store_true')
    args=p.parse_args()
    data,report=positions()
    if args.apply:
        if data.get('v345UserApprovedLeftRender',{}).get('active'):
            raise ValueError('Cannot overwrite user-approved v345 host cells; active registry is locked')
        if data.get('v344UserDeploymentAuthority',{}).get('status','').startswith('active-'):
            raise ValueError('Cannot overwrite explicit user-authoritative v344 host cells with conflicting SVG-instance hosts')
        data=build_map(data,report)
        BOARD.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
        AUDIT.write_text(json.dumps(report,indent=2)+'\n')
    if args.check:
        if data.get('v345UserApprovedLeftRender',{}).get('active'):
            check_live(data,report)
        elif data.get('v344UserDeploymentAuthority',{}).get('status','').startswith('active-'):
            try:
                from importlib.util import spec_from_file_location, module_from_spec
                path=ROOT/'tools/apply-leningrad-user-hostcells-v344.py'
                spec=spec_from_file_location('user_hosts',path); module=module_from_spec(spec); spec.loader.exec_module(module)
                module.check(data)
            except Exception as exc:
                raise ValueError('Explicit user host-cell check failed') from exc
        else: check_live(data,report)
    user_authority=bool(data.get('v345UserApprovedLeftRender',{}).get('active') or data.get('v344UserDeploymentAuthority',{}).get('status','').startswith('active-'))
    active_hosts={k:sorted(c['id'] for c in data['cells'] for m in c.get('tileMarkers',[]) if m.get('kind')==k) for k in ('cross','star')}
    print(json.dumps({'sourceSHA256': report['sourceSHA256'],
                      'authoredSvgInstanceHostsAuditOnly': {k:sorted(a['hostCell'] for a in report['assignments'] if a['kind']==k) for k in ('cross','star')},
                      'liveHostAuthority': ('user-approved-left-v345' if data.get('v345UserApprovedLeftRender',{}).get('active') else ('explicit-user-v344' if user_authority else 'svg-v343')), 
                      'activeHosts': active_hosts,
                      'maxSourceGeometryError':max(a['centerError'] for a in report['assignments']),
                      'checked':args.check,'applied':args.apply}, indent=2))

if __name__=='__main__':main()
