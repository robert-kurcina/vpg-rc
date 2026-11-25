#!/usr/bin/env python3
"""Pinned source and rule-type regression for Objective: Kiev geometry."""
import copy, hashlib, json, pathlib, sys, tempfile
from collections import Counter
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tools'))
import importlib.util
sp=importlib.util.spec_from_file_location('kiev_city_river', ROOT/'tools/reconcile-kiev-city-river-v429.py')
mod=importlib.util.module_from_spec(sp);sp.loader.exec_module(mod)
board=json.loads(mod.MAP.read_text())
audit=json.loads(mod.AUDIT.read_text())
assert audit==mod.extract(board), 'Definitive SVG extraction drift'
assert mod.build(board,audit)['cells']==board['cells'],'City transcription drift (retain later user map overrides)'
assert len(board['cells'])==165
assert len(audit['riverHexsides'])==82
assert len({r['hexPair'] for r in audit['riverHexsides']})==82
assert Counter(x['kind'] for x in audit['riverHexsides'])=={'river':72,'majorRiver':10}
assert len(audit['cityGameplayTerrain'])==16
assert Counter(x['type'] for x in audit['cityGameplayTerrain'].values())=={'city':15,'major-city':1}
assert audit['cityGameplayTerrain']['1404']['type']=='major-city'
assert all(board['cells'][i]['terrainStatus']!=mod.CITY_STATUS for i in range(len(board['cells'])) if board['cells'][i]['id'] not in audit['cityGameplayTerrain'])
for c in board['cells']:
 if c['id'] in audit['cityGameplayTerrain']:
  assert c['terrain']=='open', 'The old display fallback must not mutate'
  assert c['terrainStatus']==mod.CITY_STATUS
  marker=next(m for m in c['tileMarkers'] if m['kind'] in ('city','majorCity'))
  assert marker['sourceSvgId']==audit['cityGameplayTerrain'][c['id']]['svgId']
  assert marker['kind']==('majorCity' if c['id']=='1404' else 'city')
  assert 'not explicit underlying Open' in c['sourceTerrainEvidence']['semantics']
 else:assert c['terrainStatus']==('user-adjudicated-terrain-v435' if c['id']=='1502' else 'definitive-user-svg-terrain-v428')
assert not audit['movementAuthorized'] and not audit['combatAuthorized']
assert board['semanticRiverAudit']['internalRivers']==72
assert board['semanticRiverAudit']['internalMajorRivers']==10
# Guard source bytes, map cells, and old provisional/incorrect underlay assumptions.
with tempfile.TemporaryDirectory() as td:
 bad=pathlib.Path(td)/'altered.svg'; bad.write_bytes(mod.SRC.read_bytes()+b'<!-- tampered -->')
 old=mod.SRC
 try:
  mod.SRC=bad
  try:mod.extract(board);assert False,'Source pin bypassed'
  except ValueError as e:assert 'SHA mismatch' in str(e)
 finally:mod.SRC=old
bad=copy.deepcopy(board)
next(c for c in bad['cells'] if c['id']=='1404')['terrain']='forest'
try:mod.build(bad,audit);assert False,'City source contradiction accepted'
except ValueError:pass
print('Kiev source city terrain and 82 finite SVG river hexsides: PASS')
