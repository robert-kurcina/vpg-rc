#!/usr/bin/env python3
"""All Support Window photos are unaltered crops from source counter sheets."""
from pathlib import Path
from PIL import Image, ImageChops
import json
ROOT=Path(__file__).resolve().parents[1]
checks=0
for name,config in [('kiev','kiev.json'),('leningrad','leningrad.json'),('arduous','arduous.json'),('odessa','odessa-extension.json')]:
 faces=json.loads((ROOT/'maps/counter-configs'/config).read_text())['faces']
 for side in ['front','back']:
  source=Image.open(ROOT/f'assets/official-counters/source-sheets/counters-{name}-{side}.jpg').convert('RGB')
  for face in faces[side]:
   if face.get('visualTranscription',{}).get('kind') not in ('air-support','air-marker'):continue
   x,y,w,h=face['crop'];expected=source.crop((x,y,x+w,y+h))
   actual=Image.open(ROOT/'assets/support-counters'/(face['faceId']+'.png')).convert('RGB')
   assert actual.size==(w,h),('crop-size',face['faceId'])
   assert ImageChops.difference(actual,expected).getbbox() is None,('source-pixel-mismatch',face['faceId'])
   checks+=2
assert checks==32,(checks,'all 16 source counter faces must be present')
romanian=Image.open(ROOT/'assets/support-counters/odessa-back-r01c02.png')
assert romanian.size[0]>0 and romanian.size[1]>0
print('PASS source-photo Support Window assets:',checks+1,'checks; Romanian REFIT reverse included')
