#!/usr/bin/env python3
"""Apply the user's explicit Leningrad host-cell assignment; do not infer from scans or SVG IDs.

The universal renderer places symbols relative to the physical center of their host
cell. Authored SVG instance locations are recorded separately, not promoted over
an explicit user correction. Idempotent, with a hard fail on duplicate/missing hosts.
"""
from __future__ import annotations
from copy import deepcopy
from pathlib import Path
import argparse
import json

ROOT = Path(__file__).resolve().parents[1]
BOARD = ROOT / 'maps/leningrad.json'
CROSSES = ('0109','0210','0310','0411','0211')
STARS = ('0108','0209','0309','0410','0510')
EXPECTED = {'cross':CROSSES,'star':STARS}

def live(board):
    return {kind: sorted(c['id'] for c in board['cells'] for m in c.get('tileMarkers',[])
                         if m.get('kind')==kind) for kind in EXPECTED}

def check(board):
    if board.get('v345UserApprovedLeftRender',{}).get('active'):
        raise ValueError('v344 has been superseded by user-approved left v345 render')
    required = {k:sorted(v) for k,v in EXPECTED.items()}
    actual = live(board)
    if actual != required:
        raise ValueError(f'User-authoritative Leningrad deployment mismatch: {actual} != {required}')
    if len(set(required['cross']+required['star'])) != 10:
        raise ValueError('German/Soviet host overlap')
    cells={c['id']: c for c in board['cells']}
    for kind,hosts in EXPECTED.items():
        for host in hosts:
            if host not in cells: raise ValueError(f'unknown host {host}')
            found=[m for m in cells[host].get('tileMarkers',[]) if m.get('kind')==kind]
            if len(found)!=1 or found[0].get('faction') != ('german' if kind=='cross' else 'soviet'):
                raise ValueError(f'invalid {kind} in {host}')
            if found[0].get('hostCell') != host:
                raise ValueError(f'marker hostCell field does not match owner for {kind} {host}')
    if board.get('geometry',{}).get('deploymentMarkerPlacement') is not None:
        raise ValueError('scenario-specific renderer is forbidden')
    return actual

def apply(board):
    if board.get('v345UserApprovedLeftRender',{}).get('active'):
        raise ValueError('v344 has been superseded by user-approved left v345 render')
    cells={c['id']:c for c in board['cells']}
    if len(cells)!=len(board['cells']):raise ValueError('duplicate cell IDs')
    for host in CROSSES+STARS:
        if host not in cells:raise ValueError(f'unknown host: {host}')
    if len(set(CROSSES+STARS))!=10:raise ValueError('duplicate host assignment')
    before=live(board)
    snapshots=[{'cell':c['id'],'marker':deepcopy(m)} for c in board['cells']
                for m in c.get('tileMarkers',[]) if m.get('kind') in EXPECTED]
    for c in board['cells']:
        c['tileMarkers']=[m for m in c.get('tileMarkers',[]) if m.get('kind') not in EXPECTED]
    for kind,hosts in EXPECTED.items():
        for host in hosts:
            cells[host].setdefault('tileMarkers',[]).append({
                'kind':kind, 'faction':'german' if kind=='cross' else 'soviet',
                'hostCell':host, 'status':'user-explicit-hostcell-v344'
            })
    source=board.get('v343SourceSvgHostCells',{}).get('hostCellAssignments',[])
    svg_host={kind:sorted(x['hostCell'] for x in source if x['kind']==kind) for kind in EXPECTED}
    board['v344UserDeploymentAuthority']={
        'status':'active-explicit-user-host-cells; historical-gameplay-still-gated',
        'authority':'User-provided exact German cross/Soviet star host-cell list',
        'germanCrosses':list(CROSSES), 'sovietStars':list(STARS),
        'supersedesActive':['v343SourceSvgHostCells','v342GridRegisteredDeployment','v338DeploymentColumnCorrection'],
        'previousLiveHosts':before,'previousLiveMarkers':snapshots,
        'svgGeometricHostsAuditOnly':svg_host,
        'svgDisagreements':{kind:{'explicitOnly':sorted(set(EXPECTED[kind])-set(svg_host[kind])),
                                  'svgOnly':sorted(set(svg_host[kind])-set(EXPECTED[kind]))}
                            for kind in EXPECTED},
        'unchanged':['physical pixelCenter','cell IDs','printed label offsets','cities',
                     'terrain','rivers','railways','movement adjacency','shared renderer'],
        'sourceSvgPreserved':True,
        'historicalSetupAuthorized':False,
    }
    check(board)
    return board

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--check',action='store_true')
    p.add_argument('--apply',action='store_true')
    a=p.parse_args()
    data=json.loads(BOARD.read_text())
    if a.apply:
        apply(data)
        BOARD.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
    if a.check or not a.apply: check(data)
    print(json.dumps({'active':live(data), 'authority':data.get('v344UserDeploymentAuthority',{}).get('authority')}))

if __name__=='__main__': main()
