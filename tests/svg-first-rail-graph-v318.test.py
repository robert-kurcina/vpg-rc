#!/usr/bin/env python3
"""Source-first multi-hex and SVG rail graph regression; geometry only."""
import importlib.util, json, pathlib, math
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('railfirst',ROOT/'tools/derive-svg-rail-graph-v318.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
from core.svg_hex_traversal import trace,shared_side

# One source polyline traverses four hex centers; no per-hex SVG split necessary.
centers={str(i):(float(i*10),0.) for i in range(4)}
pairs=[(str(i),str(i+1)) for i in range(3)]
r=trace({'single_svg_path':[(-3.,0.),(33.,0.)]},centers,pairs)
assert r['adjacencyPairs']==[['0','1'],['1','2'],['2','3']],r
assert len(r['crossings'])==3 and not r['ambiguous']
assert {x['sourceSvgId'] for x in r['crossings']}=={'single_svg_path'}
# A path endpoint on a boundary cannot establish interior traversal.
r=trace({'stub':[(0.,0.),(5.,0.)]},centers,pairs)
assert not r['adjacencyPairs'] and any(x['reason']=='path-endpoint-on-boundary' for x in r['ambiguous'])
# A path merely touching a boundary then returning is not a connection.
r=trace({'touch':[(0.,0.),(5.,0.),(0.,0.)]},centers,pairs)
assert not r['adjacencyPairs']
# Same geometry run exactly along the hexside must be flagged, not counted.
r=trace({'side':[(5.,-3.),(5.,3.)]},centers,pairs)
assert not r['adjacencyPairs'] and r['ambiguous']
# Pairwise non-neighbors must not produce an inferred jump.
r=trace({'rail':[(0.,0.),(30.,0.)]},centers,[('0','3')])
assert not r['adjacencyPairs']
# Verified real-map fixture is deterministic and does not authorize movement.
fixture=json.loads((ROOT/'rules/audit/arduous-kiev-svg-first-rail-graph-v318.json').read_text())
for name in ('arduous','kiev'):
    actual=mod.derive(name)
    assert actual==fixture['maps'][name],name
    assert actual['status']=='diagnostic-only-not-gameplay-certified'
    assert all(set(r['hexPair'])<=set(c['id'] for c in json.loads((ROOT/'maps'/f'{name}.json').read_text())['cells']) for r in actual['crossings'])
assert fixture['maps']['arduous']['candidateNotDerived']==[]
assert fixture['maps']['kiev']['candidateNotDerived']==[]
assert fixture['maps']['kiev']['derivedNotCandidate']==[]
assert fixture['maps']['kiev']['derivedCount']==93
print('svg-first multi-hex traversal PASS; source-derived edges are diagnostic only')
