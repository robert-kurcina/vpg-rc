#!/usr/bin/env python3
"""Diagnostics only: tiny rings over the *approved* exported PNG. No SVG restyling."""
import json,pathlib,subprocess
from PIL import Image,ImageDraw,ImageFont
ROOT=pathlib.Path(__file__).resolve().parents[1]
audit=json.loads((ROOT/'rules/audit/kiev-definitive-city-river-v429.json').read_text())
js='''const T=require('./core/terrain_tiles'),m=require('./maps/kiev.json');console.log(JSON.stringify(T.gridSegmentData(m).filter(s=>s.neighborId).map(s=>({pair:[s.cellId,s.neighborId].sort().join(':'),a:s.a,b:s.b}))));'''
segs=json.loads(subprocess.check_output(['node','-e',js],cwd=ROOT,text=True))
lookup={r['pair']:r for r in segs}
base=Image.open(ROOT/'exports/kiev.png').convert('RGB'); image=base.copy();draw=ImageDraw.Draw(image)
for rec in audit['riverHexsides']:
 e=lookup[rec['hexPair']];x=(e['a'][0]+e['b'][0])/2;y=(e['a'][1]+e['b'][1])/2
 # Renderer output includes -35px SVG viewBox margin. Derive from SVG viewBox.
 # For current Kiev export, x,y is in original map coords +35 each.
 x+=35;y+=35
 color='#0b3271' if rec['kind']=='majorRiver' else '#21c6ed'
 rad=4 if rec['kind']=='majorRiver' else 3
 draw.ellipse((x-rad,y-rad,x+rad,y+rad),outline=color,width=2)
# Legend outside the approved map area.
footer=Image.new('RGB',(image.width,52),'white');d=ImageDraw.Draw(footer)
d.text((16,13),'River hexsides: cyan rings = 72 ordinary | dark-blue rings = 10 Major River. Source geometry only; game rule gate closed.',fill='#222222')
result=Image.new('RGB',(image.width,image.height+52),'white');result.paste(image,(0,0));result.paste(footer,(0,image.height))
out=ROOT/'rules/audit/visual/kiev-source-river-hexsides-v429.png';out.parent.mkdir(parents=True,exist_ok=True);result.save(out)
print(out)
