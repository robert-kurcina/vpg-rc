#!/usr/bin/env python3
"""Diagnostic only: overlay changed source-registered hexsides on actual exporter PNG.
No drawing of a replacement map, no SVG/editor/renderer modifications.
"""
from PIL import Image,ImageDraw,ImageFont
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[1]
board=json.loads((R/'maps/kiev.json').read_text());audit=json.loads((R/'rules/audit/kiev-rail-reconstruction-v427.json').read_text());coords={c['id']:c['pixelCenter'] for c in board['cells']}
image=Image.open(R/'exports/kiev.png').convert('RGBA');w,h=image.size
out=Image.new('RGBA',(w,h+105),'#fafafa');out.alpha_composite(image,(0,105));d=ImageDraw.Draw(out)
try: font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',18);bold=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',21)
except OSError:font=ImageFont.load_default();bold=font
d.text((25,15),'Objective: Kiev  |  Rail graph corrected from definitive SVG',font=bold,fill='#1e293b')
d.ellipse((28,64,48,84),outline='#149753',width=4);d.text((58,63),f'New source crossing ({len(audit["definitiveMissingFromRegistered"])})',font=font,fill='#155d36')
d.line((400,65,421,86),fill='#cd4545',width=4);d.line((421,65,400,86),fill='#cd4545',width=4);d.text((430,63),f'Old registration removed ({len(audit["registeredMissingFromDefinitive"])})',font=font,fill='#8b2222')
d.text((790,65),'Base: actual shared-engine map',font=font,fill='#3f5360')
for kind,links in [('removed',audit['registeredMissingFromDefinitive']),('added',audit['definitiveMissingFromRegistered'])]:
 for i,link in enumerate(links):
  a,b=link.split(':');x=(coords[a][0]+coords[b][0])/2;y=(coords[a][1]+coords[b][1])/2+105
  if kind=='removed':
   d.line((x-9,y-9,x+9,y+9),fill='#f9f9f9',width=7);d.line((x+9,y-9,x-9,y+9),fill='#f9f9f9',width=7)
   d.line((x-9,y-9,x+9,y+9),fill='#cd4545',width=4);d.line((x+9,y-9,x-9,y+9),fill='#cd4545',width=4)
  else:
   d.ellipse((x-10,y-10,x+10,y+10),fill='#f9f9f9',outline='#149753',width=4)
output=R/'rules/audit/visual/kiev-rail-source-reconciliation-v427.png';output.parent.mkdir(parents=True,exist_ok=True);out.convert('RGB').save(output)
print(output)
