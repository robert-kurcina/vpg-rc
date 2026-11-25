#!/usr/bin/env python3
"""Reproducible non-authorizing geometric crossing tests."""
import importlib.util, json, pathlib, math
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('rail_cross',ROOT/'tools/audit-rail-hexside-crossing-v318.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
ledger=json.loads((ROOT/'rules/audit/arduous-kiev-rail-hexside-crossings-v318.json').read_text())
for game, count in [('arduous',85),('kiev',93)]:
    actual=mod.compute(game)
    assert actual==ledger['maps'][game], f'{game} source audit changed unexpectedly'
    assert actual['candidateCount']==count
    assert actual['bisectorCrossings']==count
    assert sum(actual['finiteHexsideAssessmentCounts'].values())==count
    assert all(x['status']=='geometry-only-not-gameplay-certified' for x in actual['links'])
    print(game,actual['finiteHexsideAssessmentCounts'])
# Geometric positive, negative and offset fixtures; no executable movement permission.
assert mod.crossings([(-2,0),(2,0)],(-2,0),(2,0))[0]['absoluteOffsetPx']==0
assert mod.crossings([(-2,5),(2,5)],(-2,0),(2,0))[0]['absoluteOffsetPx']==5
assert not mod.crossings([(-3,0),(-1,0)],(-2,0),(2,0))
assert not mod.crossings([(-3,1),(-3,-1)],(-2,0),(2,0))
assert all(math.isfinite(x['nearestCrossing']['absoluteOffsetPx']) for x in ledger['maps']['kiev']['links'])
assert ledger['maps']['arduous']['finiteHexsideAssessmentCounts']['outside-segment']==0
assert ledger['maps']['kiev']['finiteHexsideAssessmentCounts']['outside-segment']==0
print('rail hexside geometric diagnostic PASS')
