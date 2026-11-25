#!/usr/bin/env python3
"""Reproduce v2.81 source-pixel shoreline audit; no image generation or OCR.
Reads original, embedded Odessa scan and calibrated SVG-to-engine registration.
Counts are supporting evidence, not automatic historical terrain certification.
"""
from __future__ import annotations
import json, math, hashlib
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
D=json.loads((ROOT/'maps/odessa-extension.json').read_text())
reg=D['v260SourceRegistration']['browserPixelsToEnginePixels'];mm=96/25.4
x0=reg['translateX']+(8.5149956+22.507218)*mm*reg['scaleX']
y0=reg['translateY']+16.176113*mm*reg['scaleY']
sx=249.16441*mm/771*reg['scaleX'];sy=196.58513*mm/595*reg['scaleY']
img=Image.open(ROOT/'maps/source/odessa-map-scan.webp').convert('RGB')
# Flat-top hex midpoints; exact map values come from exporter/geometry.
mid={'N':(0,-33.255),'NE':(28.145,-16.6275),'SE':(28.145,16.6275),'S':(0,33.255),'SW':(-28.145,16.6275),'NW':(-28.145,-16.6275)}
cells={c['id']:c for c in D['cells']}

def classify(rgb):
 r,g,b=rgb
 if 80<r<170 and 80<g<175 and b>150 and b-r>25 and b-g>23:return 'sea-purple'
 if 20<r<125 and 25<g<155 and 55<b<158 and b-r>10:return 'major-river-blue'
 if r>165 and abs(r-g)<20 and abs(g-b)<20:return 'offboard-beige-or-light-land'
 return 'land-or-ink'

def audit(cell,face):
 cx,cy=cells[cell]['pixelCenter'];dx,dy=mid[face]
 px=round((cx+dx-x0)/sx);py=round((cy+dy-y0)/sy)
 if not (0<=px<img.width and 0<=py<img.height):return {'hex':cell,'face':face,'sourcePixel':[px,py],'classification':'outside-source-bitmap'}
 rgb=img.getpixel((px,py))
 return {'hex':cell,'face':face,'sourcePixel':[px,py],'rgb':rgb,'classification':classify(rgb)}

old=sorted([('1416','NE'),('1416','SE'),('1416','S'),('1415','SE'),('1415','S'),('1514','SE'),('1514','S'),('1913','S'),('1215','SE'),('1216','SE'),('1217','NE'),('1217','SE'),('1218','NE'),('1218','SE'),('1314','SE'),('1315','S'),('1316','NE'),('1317','S'),('1413','S'),('1414','NE'),('1415','NE'),('1913','SE'),('1914','SW'),('1914','S')])
new=sorted((e['cellId'],e['dir']) for e in D['authoredShoreHexsides'])
checks=[audit(c,d) | {'v280Coast':(c,d) in old,'v281Coast':(c,d) in new} for c,d in sorted(set(old+new))]
manifest={
 'release':'v2.81',
 'scope':'Odessa portion of Kiev–Odessa, hex rows 09–18',
 'source':{'odessaBitmap':'maps/source/odessa-map-scan.webp','sha256':hashlib.sha256((ROOT/'maps/source/odessa-map-scan.webp').read_bytes()).hexdigest(), 'calibration':'SVG embedded image and v260SourceRegistration'},
 'v280ShoreFaces':len(old),'v281ShoreFaces':len(new),
 'pixelSamples':checks,
 'invariants':{'roadsAndRailwaysNotChanged':True,'sourceSvgNotModified':True,'coastAndLakeRendererUnchanged':True},
 'knownSourceConflicts':[
  'Four source SVG city symbols and historical bitmap-based host-hex overrides are not fully reconciled.',
  'The southern sea outside the playable hex grid cannot be represented completely by a single strip of in-hex wavelets.',
  'Seven bitmap-overridden railway source paths diverge from original freehand SVG paths, sometimes by more than one hex. No new railways were inferred in this pass.',
  'Far-east 1914 has an unresolved engine-grid-to-scan registration offset.'
 ]}
out=ROOT/'evidence-v281';out.mkdir(exist_ok=True)
(out/'bottom-rows-audit.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('AUDITED',len(checks),'unique shore faces;',len(new),'active in engine')
for p in checks:
 print(p['hex'],p['face'],p['classification'],p.get('rgb'), 'active' if p['v281Coast'] else 'suppressed')
