#!/usr/bin/env python3
"""Pixel-level check from the genuine shared-engine Kiev PNG: continuous
city perimeter at y=top and larger round dots protruding below that path.
This is not a reimplementation or synthesized rendering of the map.
"""
from pathlib import Path
from itertools import groupby
import re
from PIL import Image

root=Path(__file__).resolve().parents[1]
svg=(root/'exports/kiev.svg').read_text()
def polygon(which):
 m=re.search(r'<polygon class="city-hex-'+which+r'" data-city-hex="0706"[^>]*>',svg)
 assert m, 'Tarnopol 0706 city '+which+' polygon missing'
 return m.group(0)
base=polygon('border');dots=polygon('highlight')
assert 'stroke-width="2.80"' in base and 'stroke-width="6.00"' in dots
assert 'stroke-dasharray="0.1 14.10"' in dots
assert re.search('points="([^"]+)"',base).group(1)==re.search('points="([^"]+)"',dots).group(1)
pts=[tuple(map(float,p.split(','))) for p in re.search('points="([^"]+)"',base).group(1).split()]
y=min(p[1] for p in pts)
xs=sorted(x for x,py in pts if abs(py-y)<.01)
assert len(xs)==2
left,top,width,_=map(float,re.search(r'viewBox="([^"]+)"',svg).group(1).split())
im=Image.open(root/'exports/kiev.png').convert('RGB')
scale=im.width/width
start=round((xs[0]-left)*scale)+8
end=round((xs[1]-left)*scale)-8
assert end-start>=25
# The real PNG is fully black along the continuous base path.
def mask(dy):
 row=round((y+dy-top)*scale)
 return [max(im.getpixel((x,row)))<92 for x in range(start,end)]
line=mask(0)
assert sum(line)>=.90*len(line),f'City base line is not continuous: {sum(line)}/{len(line)}'
# At an offset beyond the base stroke, only the larger round dots extend;
# gaps prove the dots are visible and distinct atop (not beside) the base.
lobes=mask(2.0)
runs=[(dark,len(list(segment))) for dark,segment in groupby(lobes)]
black=sum(1 for dark,n in runs if dark and n>=2)
gaps=sum(1 for dark,n in runs if not dark and n>=5)
assert black>=2 and gaps>=2,f'Expected protruding black dots and visible spaces: {runs}'
print(f'PASS v454 raster: {len(line)} solid black path pixels, {black} protruding dot lobes and {gaps} clear spaces')
