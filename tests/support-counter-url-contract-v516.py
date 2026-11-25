#!/usr/bin/env python3
"""Verify Support PNG URL resolution for the original shipped game pages.

The historical browser builds a ../../../assets/support-counters/<face>.png
relative path for the shared Support Window; this test checks the actual folder
layout, every source front/back face, and its binary image signature.
"""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
PAGES={
 'kiev':ROOT/'games/kiev/setup-preview/index.html',
 'arduous':ROOT/'games/arduous/native-preview/index.html',
 'leningrad':ROOT/'games/leningrad/native-preview/index.html',
}
checks=0
for name,filename in [('kiev','kiev.json'),('arduous','arduous.json'),('leningrad','leningrad.json'),('odessa','odessa-extension.json')]:
 faces=json.loads((ROOT/'maps/counter-configs'/filename).read_text())['faces']
 for side in ('front','back'):
  for face in faces[side]:
   if face.get('visualTranscription',{}).get('kind') not in ('air-support','air-marker','naval-marker'):
    continue
   face_id=face['faceId']
   # Odessa has source artwork but no active standalone historical UI yet.
   # The source counter itself must still exist.
   art=(ROOT/'assets/support-counters'/(face_id+'.png')).resolve()
   assert art.is_file() and art.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'),(name,face_id,art)
   checks+=1
   if name in PAGES:
    target=(PAGES[name].parent/'../../../assets/support-counters'/f'{face_id}.png').resolve()
    assert target==art,(name,face_id,target,art)
    checks+=1
source=(ROOT/'core/historical_browser_app.js').read_text()
assert "'../../../assets/support-counters/'+encodeURIComponent(artFace)+'.png'" in source
assert "'../../../assets/support-counters/'+encodeURIComponent(face)+'.png'" in source
checks+=2
support=(ROOT/'core/support_window.js').read_text()
assert support.count("img.loading='eager'")==2
checks+=1
print('PASS v516 Support image path contract:',checks,'assertions; every sourced air/Fleet face maps to a valid PNG')
