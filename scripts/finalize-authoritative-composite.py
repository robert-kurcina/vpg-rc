#!/usr/bin/env python3
"""Isolate authoritative source data in composite extension, preserving Kiev-only map."""
import json,pathlib,zipfile,collections,subprocess,re,math
ROOT=pathlib.Path(__file__).resolve().parents[1];MAPS=ROOT/'maps';p=MAPS/'odessa-extension.json';e=json.loads(p.read_text());b=json.loads((MAPS/'kiev.json').read_text())
current=b['cells']+e['cells']; byid={c['id']:c for c in current}
# Snapshot only scenario semantics that user SVG can inform; do not replace unrelated engine metadata.
keys=['terrain','terrainStatus','tileMarkers','city','tileEdges','hexsideFeatures','terrainTextureOpacityMultiplier']
e['authoritativeCellOverrides']={cid:{k:c.get(k) for k in keys} for cid,c in byid.items()}
unknown=[cid for cid,c in byid.items() if c.get('terrain') is None]
e['v289SourceImportAudit']['unclassifiedHexes']=sorted(unknown)
e['v289SourceImportAudit']['unclassifiedCount']=len(unknown)
# Deprecated game link graph is retained as evidence only; new author SVG is visual truth.
# The existing rail links may still be useful if later verified against exact paths.
e['authoritativeRailStatus']='original-rail-center-graph-provisional-and-not-recertified-against-new-svg'
e['authoritativeRiverStatus']='source-vector-hexside-candidates-visual-not-gameplay-certified'
# Inherit the imported original hex grid SVG; an older import helper may omit this.
if not e['authoritativeCompositeSvg'].get('gridSvg'):
 from lxml import etree as ET
 r=ET.parse(str(MAPS/'source/user-svg/kiev-odessa-main.svg'))
 g=r.xpath('//*[local-name()="g" and @id="layer9"]')[0]
 e['authoritativeCompositeSvg']['gridSvg']=ET.tostring(g,encoding='unicode')
# Reset the standalone base to the actual v288 source, not our provisional composite mutations.
archive=pathlib.Path('/mnt/data/hex_wargame_v288_KIEV_ODESSA_WATER_FIXES.zip')
with zipfile.ZipFile(archive) as z:
 original=json.loads(z.read('hex_wargame_v288/maps/kiev.json'))
(MAPS/'kiev.json').write_text(json.dumps(original,indent=2,ensure_ascii=False)+'\n')
p.write_text(json.dumps(e,indent=2,ensure_ascii=False)+'\n')
print('isolated composite overrides',len(e['authoritativeCellOverrides']),'unclassified',len(unknown),sorted(unknown))
