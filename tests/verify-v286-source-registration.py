#!/usr/bin/env python3
"""Independent source-registered geometry checks. NO text recognition or image generation.

The River bitmap ink was extracted in v282, but its vector vertices were stored in
an obsolete scaled source frame. Validate their corrected source-pixel positions
against the original bitmap and require no unsupported certainty claims.
"""
from pathlib import Path
import json,hashlib
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
ROOT=Path(__file__).resolve().parent.parent
j=json.loads((ROOT/'maps/odessa-extension.json').read_text())
source=ROOT/'maps/source/odessa-map-scan.webp'
assert hashlib.sha256(source.read_bytes()).hexdigest()=='21e497a932131d839cbb6e54bed27be4ac422641ca4b07b1a0f604909d5482a8'
I=np.asarray(Image.open(source).convert('RGB'),dtype=np.int16)
r,g,b=np.moveaxis(I,-1,0)
# Conservative dark-blue printed River pigment. Purple sea excluded by red<105.
ink=(b>r+13)&(b>g+8)&(g<145)&(r<105)
distance=distance_transform_edt(~ink)
D=j['sourceBitmapRiverInk']
assert D['registration']['engineUnitsPerSourcePixel']==[1,1]
assert D['registration']['pixelOriginInEngine']==[476.877206,660.0]
P=np.asarray([p for c in D['components'] for ring in c['rings'] for p in ring])
assert len(P)==983,len(P)
old=np.asarray(D['registrationPrevious']['pixelOriginInEngine'])
scale=np.asarray(D['registrationPrevious']['engineUnitsPerSourcePixel'])
new=np.asarray(D['registration']['pixelOriginInEngine'])
# What *the v282 stored coords* would have been if treated as correctly registered.
old_coords=(P-new)*scale+old

def score(pts):
 source_xy=np.rint(pts-new).astype(int)
 bounds=(source_xy[:,0]>=0)&(source_xy[:,1]>=0)&(source_xy[:,0]<I.shape[1])&(source_xy[:,1]<I.shape[0])
 q=source_xy[bounds];dist=distance[q[:,1],q[:,0]]
 return {'within_source':round(float(bounds.mean()),4),'median_distance_px':round(float(np.median(dist)),3),'mean_distance_px':round(float(np.mean(dist)),3),'within_3_px':round(float((dist<=3).mean()),4)}
previous=score(old_coords);corrected=score(P)
assert corrected['within_3_px']>.99,corrected
assert corrected['median_distance_px']<=1,corrected
assert previous['within_3_px']<.4,previous
assert previous['median_distance_px']>=10,previous
IDs={c['id']:c for c in j['cells']}
assert len(IDs)==69
for absent in ['1416','1515','1613','1713']:assert absent not in IDs
assert IDs['1514']['terrain']=='open' and IDs['1514'].get('sourceCoastWaterCandidate')
assert IDs['1211']['terrain']=='open'
assert IDs['1014']['tileMarkers'] and any(m['kind']=='cross' for m in IDs['1014']['tileMarkers'])
for coast in j['authoredShoreHexsides']:assert coast['cellId'] in IDs,coast
assert j['waterRenderingMode']=='hexside-wavelets'
out={'bitmap_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'river_vertices':len(P),'before':previous,'after':corrected,'method':'Independent RGB dark-blue printed River ink proximity; visual geometry only, no River rules topology inferred','status':'River source pixel registration verified; semantic coast/railway crossings provisional'}
dest=ROOT/'evidence-v286'/'river-geometry-registration.json';dest.parent.mkdir(exist_ok=True);dest.write_text(json.dumps(out,indent=2)+'\n')
print('PASS v286',out)
