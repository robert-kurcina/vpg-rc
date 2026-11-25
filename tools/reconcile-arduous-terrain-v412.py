#!/usr/bin/env python3
"""Review Arduous whole-cell base terrain using the exact authored SVG AND supplied board scan.

This is a source transcription of open/forest/swamp, NOT river, hexside, movement,
or historical placement certification. Source vectors take priority. Unmarked
cells are admitted as open only if their scan centers are independently unlike
both forest and swamp, and the SVG terrain layer IDs match the checked source.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/'maps/arduous.json'
SVG=ROOT/'maps/source/user-svg/arduous-map-temp(3).svg'
SCAN=ROOT/'maps/source/arduous-map-scan.webp'
OUT=ROOT/'rules/audit/arduous-whole-hex-terrain-v412.json'
REVIEW_STATUS='source-svg-scan-reviewed-open-v412'
OLD_STATUSES={'source-resampled-provisional','source-SVG-not-marked-forest-or-swamp-unverified-open','not-transcribed'}
ORIGINAL_SHA='21e0a071a6734e533b89fba0ef7368d1eac631836619c006e422f0fadf20e1f4'

def digest(blob):return hashlib.sha256(blob).hexdigest()

def load_scan_module():
 path=ROOT/'tools/audit-arduous-scan-terrain-v318.py'
 spec=importlib.util.spec_from_file_location('arduous_scan_v318',path)
 mod=importlib.util.module_from_spec(spec)
 spec.loader.exec_module(mod)
 return mod

def build(board,svg_bytes,scan_bytes):
 if digest(svg_bytes)!=board['authoredSvgImportAudit']['sourceSvgSha256'] or digest(svg_bytes)!=board['authoredSourceVectors']['sourceSvgSha256']:
  raise ValueError('SVG checksum disagreement')
 if digest(scan_bytes)!=board['sourceImageSHA256']:
  raise ValueError('Board-scan checksum disagreement')
 tree=ET.fromstring(svg_bytes)
 INK='{http://www.inkscape.org/namespaces/inkscape}'
 layers={}
 for e in tree.iter():
  label=e.get(INK+'label')
  if label in ('forests','swamp'):
   if label in layers:raise ValueError('Duplicate authored terrain layer')
   layers[label]=[p.get('id') for p in e.iter() if p.tag.rsplit('}',1)[-1]=='path']
 if set(layers)!={'forests','swamp'} or any(len(ids)!=len(set(ids)) for ids in layers.values()):
  raise ValueError('Missing or duplicate terrain markers')
 from io import BytesIO
 with Image.open(BytesIO(scan_bytes)) as im:
  scan=im.convert('RGB')
 if scan.size!=(900,575):raise ValueError('Unknown scan size')
 sample=load_scan_module().sample
 expected={}
 for terrain,layer in [('forest','forests'),('swamp','swamp')]:
  records=board['authoredSvgImportAudit']['details']['terrain'][terrain]
  ids=[record['sourceSvgId'] for record in records]
  if len(ids)!=len(layers[layer]) or set(ids)!=set(layers[layer]):
   raise ValueError('Authored marker layer not exhaustive: '+terrain)
  for r in records:
   if r['cellId'] in expected:raise ValueError('Duplicate authored terrain cell: '+r['cellId'])
   if r['registrationErrorPx']>=4.1:raise ValueError('Unreliable vector-to-hex registration: '+r['cellId'])
   expected[r['cellId']]=(terrain,r['sourceSvgId'])
 if len(expected)!=50:raise ValueError('Unexpected source terrain count')
 cells={c['id']:c for c in board['cells']}
 if len(cells)!=155 or len(cells)!=len(board['cells']):raise ValueError('Unexpected topology or duplicate cells')
 records=[]
 for id,c in sorted(cells.items()):
  colors=sample(scan,c['pixelCenter'])
  if id in expected:
   terrain,marker=expected[id]
   if c.get('terrain')!=terrain or c.get('terrainStatus')!='user-svg-authored-'+terrain:
    raise ValueError('Marker conflicts with map terrain: '+id)
   if colors['greenFraction']<0.5 and terrain=='forest' or colors['yellowBrownFraction']<0.5 and terrain=='swamp':
    raise ValueError('Authored marker conflicts with board scan: '+id)
   records.append({'hexId':id,'terrain':terrain,'sourceSvgId':marker,'review':'authored-source-svg-marker',
    'greenFraction':colors['greenFraction'],'swampFraction':colors['yellowBrownFraction']})
  else:
   if colors['greenFraction']>=0.5 or colors['yellowBrownFraction']>=0.5:
    raise ValueError('Unmarked candidate open cell shows major forest/swamp pigment: '+id)
   if c.get('terrain') not in ('open',None):raise ValueError('Unmarked non-open terrain: '+id)
   if c['terrainStatus'] not in OLD_STATUSES|{REVIEW_STATUS}:
    raise ValueError('Unexpected unmarked status: '+id)
   records.append({'hexId':id,'terrain':'open','review':'SVG-without-forest-or-swamp-overlay + independently corroborating supplied board scan',
    'previousTerrain':c.get('terrain'),'previousStatus':c['terrainStatus'],
    'greenFraction':colors['greenFraction'],'swampFraction':colors['yellowBrownFraction'],
    'cityMarker':any(t.get('kind') in ('city','majorCity') for t in c.get('tileMarkers',[]))})
 return {
  'schemaVersion':1,'checkpoint':178,'scope':'Arduous whole-cell base terrain source transcription; not gameplay graph certification',
  'sourceSvgSha256':digest(svg_bytes),'sourceScanSha256':digest(scan_bytes),
  'counts':{'hexes':155,'forest':30,'swamp':20,'reviewedOpen':105,'currentlyUnclassified':sum(c.get('terrain') is None for c in board['cells']),
    'openCityHexes':['0211','0907']},
  'method':{'primary':'Exact authored forest/swamp layer paths and source-registered cell IDs',
    'corroboration':'SHA-256 pinned original board-scan whole-cell center color test',
    'threshold':0.5,'negativeEvidence':'Every one of the 105 unmarked hex centers is below forest and swamp majority thresholds',
    'limitations':['Center evidence alone does not settle every possible terrain boundary',
      'River and reinforcement hexsides, rail semantics and full game setup are separate',
      'Source SVG contains a missing embedded PNG reference; separately bundled original board scan is used']},
  'records':records,'terrainOnly':True,'authorizedForMovement':False
 }

def review(write=False):
 original=MAP.read_bytes();board=json.loads(original)
 result=build(board,SVG.read_bytes(),SCAN.read_bytes())
 all_reviewed=all(c['terrainStatus']==REVIEW_STATUS for c in board['cells'] if c['id'] not in
  {r['hexId'] for r in result['records'] if r['review']=='authored-source-svg-marker'})
 if write:
  if not all_reviewed and digest(original)!=ORIGINAL_SHA:
   raise ValueError('Unexpected source map preimage. Do not mutate a changed map.')
  for c in board['cells']:
   if c['terrainStatus'] in OLD_STATUSES:
    c['terrain']='open';c['terrainStatus']=REVIEW_STATUS
  board['v412TerrainEvidenceAudit']={
   'classification':'50 authored forest/swamp; 105 scan-corroborated source-unmarked open cells',
   'reviewReport':'rules/audit/arduous-whole-hex-terrain-v412.json',
   'sourceSvgSHA256':result['sourceSvgSha256'],'sourceScanSHA256':result['sourceScanSha256'],
   'priorMapSHA256':ORIGINAL_SHA,'priorUnclassifiedHexes':['0211','0907'],
   'status':'base terrain reviewed; river/rail/grid/playability remain separate and uncertified'}
  board['sourceStatus']='Source-reviewed whole-cell base terrain, full movement/hexside/setup not yet certified'
  board['playabilityStatus']='v412 terrain transcription complete; movement/setup graph still provisional'
  MAP.write_text(json.dumps(board,indent=2,ensure_ascii=False)+'\n')
  result=build(board,SVG.read_bytes(),SCAN.read_bytes())
  result['sourceMapSha256']=digest(MAP.read_bytes())
  OUT.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
 else:
  result['sourceMapSha256']=digest(original)
 return result

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true')
 args=parser.parse_args();r=review(write=args.write)
 print(json.dumps({'counts':r['counts'],'sourceMapSha256':r['sourceMapSha256']},indent=2))
