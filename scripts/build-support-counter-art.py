#!/usr/bin/env python3
"""Crop source-photographed air and Fleet markers, unaltered, into UI thumbnails.
No redraws or generated counter designs; SVG and map exports are untouched.
"""
from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
out=root/'assets/support-counters'
out.mkdir(parents=True,exist_ok=True)
# Display-only cropping overrides correct source-sheet strips inadvertently
# included in the old Support thumbnails. Never change gameplay face crops.
override_data=json.loads((out/'crop-overrides.json').read_text())
overrides=override_data['faces']
assert isinstance(overrides,dict) and all(isinstance(v,list) and len(v)==4 and
 isinstance(k,str) and all(isinstance(n,int) for n in v) for k,v in overrides.items())
consumed=set()
count=0
for name,config in [('kiev','kiev.json'),('leningrad','leningrad.json'),('arduous','arduous.json'),('odessa','odessa-extension.json')]:
 faces=json.loads((root/'maps/counter-configs'/config).read_text())['faces']
 for side in ('front','back'):
  src=root/f'assets/official-counters/source-sheets/counters-{name}-{side}.jpg'
  sheet=Image.open(src)
  for face in faces[side]:
   trans=face.get('visualTranscription') or {}
   if trans.get('kind') not in ('air-support','air-marker','naval-marker'): continue
   faceid=face['faceId'];assert faceid.startswith(name+'-') and faceid.replace('-','').replace('_','').isalnum()
   x,y,w,h=overrides.get(faceid,face['crop'])
   if faceid in overrides: consumed.add(faceid)
   assert min(x,y)>=0 and min(w,h)>0 and x+w<=sheet.width and y+h<=sheet.height,(faceid,sheet.size,face['crop'])
   piece=sheet.crop((x,y,x+w,y+h)).convert('RGB')
   # Preserve the source pixels exactly; no rescaling or recoloring.
   piece.save(out/(faceid+'.png'),optimize=True)
   count+=1
assert consumed==set(overrides), 'Unknown Support crop override IDs: '+str(set(overrides)-consumed)
print(f'{count} source counter faces cropped into {out.relative_to(root)} ({len(consumed)} presentation-only Fleet crop corrections)')

# The standalone Chromium proof pages use set_content() (about:blank), which
# has no filesystem URL base. Bundle the *same* source-photo PNG bytes as a
# small browser-side image lookup. This is a packaging format, not new artwork.
# Production and offline pages share identical counter pixels.
import base64
faces=sorted(out.glob('*.png'))
assert len(faces)==count
bundle=root/'core/support_counter_art_bundle.js'
data={f.stem:base64.b64encode(f.read_bytes()).decode('ascii') for f in faces}
bundle.write_text('''/* GENERATED FROM shipped source-photograph crops by scripts/build-support-counter-art.py.
 * An offline/browser-safe representation of the identical PNG bytes. */
(function(root){'use strict';
const faces=Object.freeze('''+json.dumps(data,sort_keys=True,separators=(',',':'))+''');
root.WargameSupportCounterArt=Object.freeze({
 url:faceId=>Object.prototype.hasOwnProperty.call(faces,faceId)?'data:image/png;base64,'+faces[faceId]:null,
 has:faceId=>Object.prototype.hasOwnProperty.call(faces,faceId)
});
})(typeof globalThis!=='undefined'?globalThis:this);
''')
print('Bundled',len(data),'original Support PNGs into',bundle.relative_to(root))
