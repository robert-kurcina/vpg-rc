#!/usr/bin/env python3
"""Extract river *visual geometry* from the user-provided Odessa bitmap.

Bitmap is topological/cartographic evidence, not a game rule source. The mask
is restricted to dark-blue river ink near the supplied river SVG paths; purple
sea is excluded. All contour coordinates are transformed to existing engine
map units. The original artwork is never modified. This is a reproducible,
source-derived vectorization and NOT generative art.
"""
from pathlib import Path
import hashlib, json, re
import cv2
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parent.parent
j=ROOT/'maps/odessa-extension.json'; data=json.loads(j.read_text())
imgp=ROOT/'maps/source/odessa-map-scan.webp'
rg=data['v260SourceRegistration']['browserPixelsToEnginePixels']
unit=3.779527559
origin_x=rg['translateX']+(8.5149956+22.507218)*unit*rg['scaleX']
origin_y=rg['translateY']+16.176113*unit*rg['scaleY']
scale_x=249.16441*unit/771*rg['scaleX']
scale_y=196.58513*unit/595*rg['scaleY']
I=np.asarray(Image.open(imgp).convert('RGB')).astype(np.int16)
r,g,b=I.transpose(2,0,1)
# Excludes the mauve/purple sea (generally B >= 155 and R >= 100)
mask=((r<105)&(g<145)&(b>r+15)&(b>g+8)&(b>=55)&(b<=155)).astype(np.uint8)
mask=cv2.morphologyEx(mask,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
ref=np.zeros(mask.shape,np.uint8)
for item in data['additionalSourceVectors'][0]['rivers']:
 pts=np.asarray([[(float(x)-origin_x)/scale_x,(float(y)-origin_y)/scale_y] for x,y in
        re.findall(r'(-?\d+\.\d+),(-?\d+\.\d+)',item['d'])],np.float32)
 if len(pts)>1:cv2.polylines(ref,[np.rint(pts).astype(np.int32)],False,1,2)
distance=cv2.distanceTransform(1-ref,cv2.DIST_L2,3)
count,labels,stats,_=cv2.connectedComponentsWithStats(mask,8)
visual=[];selected_pixels=0
for index in sorted(range(1,count),key=lambda i:-int(stats[i,cv2.CC_STAT_AREA])):
 area=int(stats[index,cv2.CC_STAT_AREA]);y,x=np.nonzero(labels==index)
 if area<50 or float(distance[y,x].min())>32:continue
 isolated=((labels==index)*255).astype(np.uint8)
 contours,h=cv2.findContours(isolated,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
 if h is None:continue
 # Single compound path per connected component; even-odd fill preserves
 # holes, including the island at the southern river confluence.
 polygons=[]
 for c in contours:
  simplified=cv2.approxPolyDP(c,epsilon=.75,closed=True)[:,0,:]
  if len(simplified)<3:continue
  pts=[[round(origin_x+float(px)*scale_x,2),round(origin_y+float(py)*scale_y,2)] for px,py in simplified]
  polygons.append(pts)
 if not polygons:continue
 bbox=list(map(int,stats[index,:4]));
 visual.append({'componentId':index,'pixelCount':area,'bitmapBounds':bbox,'distanceToAuthoredRiverMinPx':round(float(distance[y,x].min()),2),'rings':polygons})
 selected_pixels+=area
obj={'mode':'source-registered-vector-river-ink','status':'VISUAL_CANDIDATE_UNVERIFIED_GAME_RULES','sourceBitmap':'maps/source/odessa-map-scan.webp',
 'sourceSHA256':hashlib.sha256(imgp.read_bytes()).hexdigest(),
 'authorSvg':'maps/source/user-svg/odessa-map-temp(4).svg',
 'registration':{'pixelOriginInEngine':[round(origin_x,6),round(origin_y,6)],'engineUnitsPerSourcePixel':[round(scale_x,9),round(scale_y,9)]},
 'classification':'dark-blue printed river ink near authored source-river vectors; purple sea excluded; no OCR',
 'sourcePixelCandidates':int(mask.sum()),'selectedPixels':selected_pixels,'components':visual,
 'limitations':['Visual river fill is bitmap-derived, not a certified hexside rules graph.',
                'Very narrow or pale printed tributaries can be omitted by the conservative color threshold.',
                'Source colors around dense symbols, rail crossings and southern river mouth require manual review.',
                'Do not use this mask to alter Coast/Lake wavelet topology or legal movement/combat.']}
# This replaces *display* paths, not the authoritative SVG source or rules edges.
data['sourceBitmapRiverInk']=obj
data['riverRenderingMode']='source-bitmap-ink-vectors'
j.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
print('components',len(visual),'pixels',selected_pixels,'of',int(mask.sum()))
