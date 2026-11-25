#!/usr/bin/env python3
"""Audit original bundled Arduous board scan against SVG-authored terrain.

Raster evidence is observational: an interior color sample cannot certify all
hexside rules, multi-hex boundaries, lakes, or movement legality.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
MAP=ROOT/'maps/arduous.json'
SCAN=ROOT/'maps/source/arduous-map-scan.webp'
OUT=ROOT/'rules/audit/arduous-bundled-scan-terrain-v318.json'

# Ratios validated against every explicitly authored forest/swamp hex.
# The center ellipse deliberately excludes the hex border; a black road/label
# may diminish color coverage, so results are evidence, not certification.
def sample(image, center):
    cx,cy=map(round,center)
    n=green=swamp=0
    for dy in range(-15,16):
        for dx in range(-17,18):
            if (dx/17)**2+(dy/15)**2>=1: continue
            x,y=cx+dx,cy+dy
            if not (0<=x<image.width and 0<=y<image.height):
                raise ValueError('sample-outside-scan')
            r,g,b=image.getpixel((x,y))
            n+=1
            green+=bool(g>r*1.09 and g>b*1.02)
            swamp+=bool(r>b*1.13 and g>b*1.10)
    return {'pixelCount':n,'greenFraction':round(green/n,6),
            'yellowBrownFraction':round(swamp/n,6)}

def inspect(map_path=MAP, scan_path=SCAN):
    map_bytes=Path(map_path).read_bytes()
    scan_bytes=Path(scan_path).read_bytes()
    board=json.loads(map_bytes)
    expected=board['sourceImageSHA256']
    actual=hashlib.sha256(scan_bytes).hexdigest()
    if actual!=expected:raise ValueError('scan-source-checksum-mismatch')
    if board['sourceImage']!=Path(scan_path).name:raise ValueError('scan-name-mismatch')
    with Image.open(scan_path) as src:
        img=src.convert('RGB')
    if (img.width,img.height)!=(900,575):
        raise ValueError('unexpected-scan-dimensions')
    records=[]
    for cell in board['cells']:
        scores=sample(img,cell['pixelCenter'])
        # High-majority center pixels: deliberately not a general terrain classifier.
        visually=('forest-color-dominant' if scores['greenFraction']>=0.5 else
                  'swamp-color-dominant' if scores['yellowBrownFraction']>=0.5 else
                  'neither-forest-nor-swamp-color-dominant')
        authored=cell['terrainStatus'].startswith('user-svg-authored-')
        if authored and ((cell['terrain']=='forest')!=(visually=='forest-color-dominant') or
                        (cell['terrain']=='swamp')!=(visually=='swamp-color-dominant')):
            raise ValueError('authored-marker-raster-contradiction:'+cell['id'])
        records.append({'hexId':cell['id'],'currentTerrain':cell.get('terrain'),
                        'currentStatus':cell['terrainStatus'],
                        'centerPx':cell['pixelCenter'],
                        'rasterObservation':visually,'sample':scores,
                        'authoredSvgTerrain':authored,
                        'movementCertifiedByThisAudit':False})
    count=lambda label:sum(r['rasterObservation']==label for r in records)
    coverage={'hexes':len(records),'authoredForestCorroborated':sum(r['authoredSvgTerrain'] and r['currentTerrain']=='forest' for r in records),
              'authoredSwampCorroborated':sum(r['authoredSvgTerrain'] and r['currentTerrain']=='swamp' for r in records),
              'unresolvedWithoutForestOrSwampCenterColor':sum(not r['authoredSvgTerrain'] and r['rasterObservation']=='neither-forest-nor-swamp-color-dominant' for r in records),
              'unresolvedWithDominantForestOrSwampCenterColor':sum(not r['authoredSvgTerrain'] and r['rasterObservation']!='neither-forest-nor-swamp-color-dominant' for r in records),
              'stillUntranscribed':sum(r['currentTerrain'] is None for r in records)}
    return {'schemaVersion':1,'scope':'Arduous bundled source scan and authored SVG terrain corroboration; not gameplay certification',
            'sourceMapSha256':hashlib.sha256(map_bytes).hexdigest(),
            'sourceScanSha256':actual,'sourceScanPath':'maps/source/arduous-map-scan.webp',
            'scanDimensions':[img.width,img.height],
            'sampleMethod':{'shape':'ellipse','radiusX':17,'radiusY':15,'greenThreshold':0.5,'yellowBrownThreshold':0.5,
                            'limitations':'Samples hex centers only; roads, text, coastlines and boundaries require independent interpretation'},
            'coverage':coverage,'hexEvidence':records,
            'previousBlockerCorrection':'The original source scan IS bundled at maps/source/arduous-map-scan.webp; the SVG relative PNG href is a different missing filename.',
            'remainingTasks':['review and explicitly transcribe unclassified cells, notably 0211 and 0907',
                              'confirm whole-hex terrain with SVG layers and board, not color alone',
                              'independently validate boundary, rail, river and reinforcement game semantics'],
            'authorizedForMovement':False}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--write',action='store_true')
    args=parser.parse_args()
    output=inspect()
    if args.write:
        OUT.write_text(json.dumps(output,indent=2)+'\n')
        print('wrote',OUT.relative_to(ROOT))
    print(json.dumps(output['coverage'],indent=2))
if __name__=='__main__': main()
