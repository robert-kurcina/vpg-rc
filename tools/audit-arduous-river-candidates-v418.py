#!/usr/bin/env python3
"""Extract ONLY sustained side-follow river candidates from the authored SVG.

Incidental point touches and short near-side contacts are not river hexsides;
ignore them entirely. This report never certifies movement or combat rules.
"""
import hashlib, json, pathlib
from importlib.machinery import SourceFileLoader
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=ROOT/'tools/extract-arduous-svg-side-occupancy-v318.py'
MAP=ROOT/'maps/arduous.json'
OUT=ROOT/'rules/audit/arduous-river-candidates-v418.json'


def audit():
 extractor=SourceFileLoader('arduous_river_v412_source',str(SRC)).load_module()
 source=extractor.build()
 mapraw=MAP.read_bytes();board=json.loads(mapraw)
 assert source['sourceMapSha256']==hashlib.sha256(mapraw).hexdigest()
 assert source['sourceSvgSha256']==board['authoredSourceVectors']['sourceSvgSha256']
 pathids={p['id'] for p in board['authoredSourceVectors']['rivers']}
 records=[]
 for key,edge in sorted(source['edges'].items()):
  obs=[o for o in edge['observations'] if o['kind']=='river']
  if not obs: continue
  for o in obs:
   if o['sourceSvgId'] not in pathids or not o.get('visualOnly'):
    raise ValueError('unregistered-river-source-or-unsupported-legality')
  following=[o for o in obs if o['relation']=='side-follow-candidate']
  if not following: continue
  classification='side-follow-review'
  records.append({'edgeKey':key,'members':edge['members'],'classification':classification,
                  'sources':sorted({o['sourceSvgId'] for o in obs}),
                  'observations':[{'svgId':o['sourceSvgId'],'relation':o['relation'],
                                  'nearbyLengthPx':o['nearbyLengthPx'],
                                  'sideProjectionFraction':o['sideProjectionFraction'],
                                  'minimumDistancePx':o['minimumDistancePx']} for o in following],
                  'internalPair':len(edge['members'])==2,
                  'certifiedRiverCrossing':False})
 follow=[r for r in records if r['classification']=='side-follow-review']
 return {'schemaVersion':2,'checkpoint':184,'sourceMapSha256':source['sourceMapSha256'],
         'sourceSvgSha256':source['sourceSvgSha256'],'scope':'Only sustained side-follow river candidates; no gameplay legality assigned',
         'coverage':{'riverSourcePaths':len(pathids),'observedHexsides':len(records),
                     'sideFollowCandidates':len(follow),
                     'internalSideFollowCandidates':sum(r['internalPair'] for r in follow),
                     'exteriorSideFollowCandidates':sum(not r['internalPair'] for r in follow),
                     'unreviewedForGameRules':len(records)},
         'sideObservations':records,'authorizedForMovement':False,
         'limitations':['A visually followed side does not yet establish a combat river crossing.',
          'Only sustained side-following paths may enter the candidate graph.',
          'All candidates remain unverified until gameplay river rules are certified.']}

if __name__=='__main__':
 r=audit()
 import sys
 if '--write' in sys.argv:OUT.write_text(json.dumps(r,indent=2)+'\n')
 print(json.dumps(r['coverage'],indent=2))
