#!/usr/bin/env python3
"""Diagnostic annotation of actual shared-engine exported Kiev PNG; never a replacement renderer."""
import hashlib,json,pathlib
from PIL import Image,ImageDraw,ImageFont
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'exports/kiev.png'
OUT=ROOT/'rules/audit/visual/kiev-terrain-corrections-v428.png'
b=json.loads((ROOT/'maps/kiev.json').read_text())
audit=json.loads((ROOT/'rules/audit/kiev-definitive-terrain-v428.json').read_text())
img=Image.open(SOURCE).convert('RGB')
canvas=ImageDraw.Draw(img)
fontpath='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
font=ImageFont.truetype(fontpath,16)
origin=(-35,-35)
for id in audit['correctedTerrainHexes']:
 c=next(c for c in b['cells'] if c['id']==id)
 x=c['pixelCenter'][0]-origin[0];y=c['pixelCenter'][1]-origin[1]
 # Diagnostic only: small source-change ring that does not repaint terrain or rivers.
 canvas.ellipse((x-26,y-26,x+26,y+26),outline='#d95819',width=3)
 tx=x+28;ty=y-18
 canvas.rounded_rectangle((tx-2,ty-2,tx+47,ty+19),radius=3,fill='#fff5db',outline='#d95819',width=2)
 canvas.text((tx+2,ty),id,font=font,fill='#422609')
OUT.parent.mkdir(parents=True,exist_ok=True)
img.save(OUT)
print('Diagnostic over actual shared SVG export:',OUT,'sourceSHA256',hashlib.sha256(SOURCE.read_bytes()).hexdigest())
