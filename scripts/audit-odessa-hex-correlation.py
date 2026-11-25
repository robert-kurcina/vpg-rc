#!/usr/bin/env python3
"""Generate a *diagnostic* source-bitmap/hex-ID correlation inventory.

Neither the pixel classification nor the affine registration is accepted as
rules terrain without independent review. No OCR, image generation, or source
image modification is used. Outputs point back to source pixels and cell IDs.
"""
from __future__ import annotations
import csv, json, hashlib
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'evidence-v286';OUT.mkdir(exist_ok=True)
D=json.loads((ROOT/'maps/odessa-extension.json').read_text())
SOURCE=ROOT/'maps/source/odessa-map-scan.webp'
A=np.asarray(Image.open(SOURCE).convert('RGB'),dtype=np.int16)
# Diagnostic registration anchored to source-printed row labels.
# v2.83 incorrectly compressed source Y by 1/1.184467132 and added 25px.
# This caused e.g. engine 1016 to be drawn over source hex 1015.
# The same source-grid registration applies on both axes. v2.84 retained
# a provisional horizontal compression (1/1.152992236) and a +25px offset,
# moving 0718 toward the NE corner and 1914 about a hex width west.
# Both sides now use the engine/source coordinate translation at unit scale.
# This remains a diagnostic grid alignment, not authoritative terrain data.
origin_engine_x=476.877206
source_y_engine_translation=660.0
rows=[]
reviewed={r['hex']:r for r in D['v283HexCorrelation']['appliedTerrainCorrections']}
reviewed.update({r['hex']:r for r in D['v286SourceRegistration']['changes'] if r.get('hex')})
for c in sorted(D['cells'],key=lambda x:x['id']):
 x=c['pixelCenter'][0]-origin_engine_x
 y=c['pixelCenter'][1]-source_y_engine_translation
 px=[]
 for yy in range(max(0,round(y)-19),min(A.shape[0],round(y)+20)):
  for xx in range(max(0,round(x)-24),min(A.shape[1],round(x)+25)):
   if abs(xx-x)/24+abs(yy-y)/19*.55<1:
    px.append(A[yy,xx])
 if px:
  arr=np.asarray(px);r,g,b=arr.T
  forest=float(np.mean((g-r>15)&(r<175)&(g>b+7)))
  sea=float(np.mean((b>r+16)&(b>g+17)))
 else:forest=sea=0.0
 rows.append({'hex':c['id'],'source_pixel_x_candidate':round(x,2),'source_pixel_y_candidate':round(y,2),
 'engine_terrain':c['terrain'],'forest_ink_fraction_diagnostic':round(forest,3),
 'sea_ink_fraction_diagnostic':round(sea,3),
 'review_status':'SOURCE_REVIEWED_CANDIDATE_NOT_RULES_CERTIFIED' if c['id'] in reviewed else 'NOT_INDEPENDENTLY_SOURCE_CERTIFIED',
 'source':str(SOURCE.relative_to(ROOT))})
with (OUT/'odessa-hex-correlations.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=list(rows[0]));writer.writeheader();writer.writerows(rows)
(OUT/'odessa-hex-correlations.json').write_text(json.dumps({
 'source':str(SOURCE.relative_to(ROOT)),
 'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'diagnosticAffine':{
  'x':'engineX - 476.877206',
  'y':'engineY - 660.0'},
 'registrationStatus':'V285_REGISTERED_GRID_WITH_V286_SOURCE_REVIEW_STILL_NOT_RULES_CERTIFIED',
 'registrationCorrection':'v2.85 corrected both x/y registration from hex IDs 0718 and 1914. v2.86 uses this transform to recheck erroneous terrain and River features. Full gameplay topology remains provisional.',
 'warning':'Source pixel fractions include urban, labels, River, and forest artwork; they are diagnostic, not automatic terrain classification. v286 applies separately reviewed changes. One formerly full land hex, 1416, is excluded as offboard.',
 'cells':rows},indent=2)+'\n')
im=Image.open(SOURCE).convert('RGB').resize((1542,1190))
draw=ImageDraw.Draw(im)
try:font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',14)
except OSError:font=ImageFont.load_default()
for v in rows:
 x,y=2*v['source_pixel_x_candidate'],2*v['source_pixel_y_candidate']
 if 5<x<1535 and 5<y<1180:
  color='#f9d448' if v['review_status'].startswith('SOURCE_REVIEWED') else '#ff7769'
  draw.ellipse((x-3,y-3,x+3,y+3),fill=color,outline='black',width=1)
  label=v['hex']
  bbox=draw.textbbox((0,0),label,font=font,stroke_width=2)
  tw=bbox[2]-bbox[0]
  draw.text((x-tw/2,y-23),label,font=font,fill='white',stroke_width=2,stroke_fill='black')
im.save(OUT/'odessa-hex-ids-diagnostic.png')
# Regression: projected hex centers maintain source grid pitch in BOTH axes.
by_id={r['hex']:r for r in rows}
for lo,hi in [('1013','1014'),('1014','1015'),('1015','1016'),('1016','1017')]:
 observed=by_id[hi]['source_pixel_y_candidate']-by_id[lo]['source_pixel_y_candidate']
 assert abs(observed-66.51) < 0.04, (lo,hi,observed)
assert 396 < by_id['1016']['source_pixel_y_candidate'] < 430, by_id['1016']
assert 329 < by_id['1015']['source_pixel_y_candidate'] < 363, by_id['1015']
for lo,hi in [('0718','0818'),('1015','1115'),('1812','1912')]:
 observed=by_id[hi]['source_pixel_x_candidate']-by_id[lo]['source_pixel_x_candidate']
 assert abs(observed-56.29)<0.04,(lo,hi,observed)
# Independent outer-column cross-check against printed hex centers:
# prior v2.84 had 0718 near upper-right edge and 1914 left of its host hex.
assert 49 < by_id['0718']['source_pixel_x_candidate'] < 53,by_id['0718']
assert 724 < by_id['1914']['source_pixel_x_candidate'] < 729,by_id['1914']
print('Corrected two-axis source correlation diagnostic written for',len(rows),'extension hexes; previous terrain candidates requiring recheck:',len(reviewed))
