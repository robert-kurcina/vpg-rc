#!/usr/bin/env python3
"""Annotate the actual shared-engine Arduous PNG with candidate markers only.

Source: current 45-side candidate list and shared geometry. Nothing else is
reconstructed or recolored. No rejected-contact history is shipped.
"""
from pathlib import Path
import json,subprocess
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
node_code=r"""const map=require('./maps/arduous.json'),G=require('./core/terrain_tiles');
const audit=require('./rules/audit/arduous-topology-v418.json');
const keys=new Set(audit.riverCandidatePairs.map(p=>p.slice().sort().join(':')));
const segments=G.gridSegmentData(map).filter(s=>s.neighborId&&keys.has([s.cellId,s.neighborId].sort().join(':')));
console.log(JSON.stringify(segments));"""
segments=json.loads(subprocess.check_output(['node','-e',node_code],cwd=ROOT,text=True))
assert len(segments)==45,len(segments)
base=Image.open(ROOT/'exports/arduous.png').convert('RGBA')
assert base.size==(956,631)
header=58
out=Image.new('RGBA',(base.width,base.height+header),(250,250,249,255))
out.alpha_composite(base,(0,header))
d=ImageDraw.Draw(out)
d.rectangle((0,0,955,header-1),fill=(26,36,43,255))
try:
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
 small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
except OSError:font=small=ImageFont.load_default()
d.text((20,8),'THE ARDUOUS BEGINNING  |  River-side candidates',font=font,fill='white')
d.text((20,32),'45 blue rings mark river candidates; gameplay river status pending',font=small,fill=(230,234,238))
for s in segments:
 a,b=s['a'],s['b']
 mx=(a[0]+b[0])/2+28; my=(a[1]+b[1])/2+28+header
 dx=b[0]-a[0];dy=b[1]-a[1];length=(dx*dx+dy*dy)**.5
 nx=-dy/length;ny=dx/length
 x=mx+nx*7;y=my+ny*7;r=3.5
 d.ellipse((x-r-1,y-r-1,x+r+1,y+r+1),fill=(255,255,255,235))
 d.ellipse((x-r,y-r,x+r,y+r),outline=(19,93,202,255),width=2)
out.convert('RGB').save(ROOT/'rules/audit/visual/arduous-river-candidates.png',optimize=True)
print('Rendered 45 blue candidate markers over unchanged approved shared-engine PNG')
