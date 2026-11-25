#!/usr/bin/env python3
"""Restore the visually approved left-hand v343 deployment from v344's archived marker snapshot.

The user identified the LEFT side of exports/leningrad-fresh-v343-v344-comparison.png
as correct. The left is v343. This tool does not use scans, fit a new model,
change hex numbering, or touch any renderer. Refuses changes outside deployment.
"""
from __future__ import annotations
import argparse
from copy import deepcopy
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
BOARD = ROOT/'maps/leningrad.json'
EXPECTED = {'cross': ['0210','0310','0311','0411','0511'],
            'star': ['0209','0309','0410','0510','0611']}

def hosts(data):
    return {kind: sorted(c['id'] for c in data['cells'] for m in c.get('tileMarkers',[])
                         if m.get('kind')==kind) for kind in EXPECTED}

def check(data):
    actual = hosts(data)
    if actual != EXPECTED:
        raise ValueError(f'Visually approved left-hand host registry mismatch: {actual} != {EXPECTED}')
    cells = {c['id']:c for c in data['cells']}
    assert len(cells) == len(data['cells'])
    svg_ids = set()
    for kind, positions in EXPECTED.items():
        for id in positions:
            found = [m for m in cells[id].get('tileMarkers',[]) if m.get('kind')==kind]
            if len(found)!=1:
                raise ValueError(f'expected one {kind} at {id}')
            m=found[0]
            if m.get('hostCell')!=id or m.get('faction')!=('german' if kind=='cross' else 'soviet'):
                raise ValueError(f'wrong ownership {kind} at {id}')
            sid=m.get('sourceSvgId')
            if not sid or sid in svg_ids:
                raise ValueError(f'missing or duplicate source SVG instance {kind} at {id}')
            svg_ids.add(sid)
    if data['geometry'].get('deploymentMarkerPlacement') is not None:
        raise ValueError('Leningrad-specific renderer is forbidden')
    if not data.get('v345UserApprovedLeftRender',{}).get('active'):
        raise ValueError('v345 visual-approval authority is not active')
    if data.get('v344UserDeploymentAuthority',{}).get('status','').startswith('active-'):
        raise ValueError('v344 rejected arrangement still marked active')
    if any(m.get('kind') in ('cross','star') for m in cells['0208'].get('tileMarkers',[])):
        raise ValueError('Liepaja host must not acquire a cross/star')
    return actual

def apply(data):
    old=data.get('v344UserDeploymentAuthority')
    if not old or len(old.get('previousLiveMarkers',[]))!=10:
        raise ValueError('missing original v343 marker snapshots in v344 archive')
    snapshots=deepcopy(old['previousLiveMarkers'])
    if {kind: sorted(row['cell'] for row in snapshots if row['marker'].get('kind')==kind)
        for kind in EXPECTED}!=EXPECTED:
        raise ValueError('archived left-hand marker snapshot does not match v343 expected hosts')
    cells={c['id']:c for c in data['cells']}
    for c in data['cells']:
        c['tileMarkers']=[m for m in c.get('tileMarkers',[]) if m.get('kind') not in EXPECTED]
    for item in snapshots:
        id=item['cell']
        cells[id].setdefault('tileMarkers',[]).append(item['marker'])
    old['status']='superseded-by-v345-user-approved-left-render'
    data['v345UserApprovedLeftRender']={
        'active': True,
        'userConfirmed': 'Left image in v343-v344 before/after comparison is correct; right v344 is incorrect',
        'sourceArtifact': 'exports/leningrad-fresh-v343-v344-comparison.png',
        'approvedSide': 'left', 'approvedVersion': 'v343',
        'rejectedVersion': 'v344',
        'authority': 'user visual confirmation of actual engine export',
        'germanCrosses': EXPECTED['cross'], 'sovietStars': EXPECTED['star'],
        'usesSourceSvgGeometry': True,
        'restorationSource':'v344UserDeploymentAuthority.previousLiveMarkers',
        'supersedesActive': ['v344UserDeploymentAuthority'],
        'preserves':['universal renderer','printed coordinate configuration',
                     'terrain','city assignments','hex grid','rivers','rails','movement adjacency'],
        'historicalSetupAuthorized': False,
    }
    check(data)
    return data

def main():
    p=argparse.ArgumentParser();p.add_argument('--apply',action='store_true');p.add_argument('--check',action='store_true');a=p.parse_args()
    data=json.loads(BOARD.read_text())
    if a.apply:
        if not data.get('v345UserApprovedLeftRender',{}).get('active'):
            data=apply(data)
            BOARD.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
    print(json.dumps(check(data),indent=2))

if __name__=='__main__':main()
