#!/usr/bin/env python3
"""Read-only SVG rail geometry diagnostics. Does not certify gameplay edges."""
import argparse, hashlib, json, math, pathlib, sys
from collections import defaultdict
from xml.etree import ElementTree as ET
from fontTools.svgLib.path import parse_path
from fontTools.pens.basePen import BasePen

ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCES={'arduous':'arduous-map-temp(3).svg','kiev':'kiev-map-temp(5).svg'}
INK='{http://www.inkscape.org/namespaces/inkscape}'

class SamplePen(BasePen):
 def __init__(self): super().__init__(None);self.points=[];self.start=None;self.last=None
 def _moveTo(self,p): self.points.append(p);self.start=p;self.last=p
 def _lineTo(self,p): self.points.append(p);self.last=p
 def _curveToOne(self,p1,p2,p3):
  a=self.last
  for i in range(1,21):
   t=i/20;u=1-t
   self.points.append((u*u*u*a[0]+3*u*u*t*p1[0]+3*u*t*t*p2[0]+t*t*t*p3[0],u*u*u*a[1]+3*u*u*t*p1[1]+3*u*t*t*p2[1]+t*t*t*p3[1]))
  self.last=p3
 def _qCurveToOne(self,p1,p2):
  a=self.last
  for i in range(1,21):
   t=i/20;u=1-t
   self.points.append((u*u*a[0]+2*u*t*p1[0]+t*t*p2[0],u*u*a[1]+2*u*t*p1[1]+t*t*p2[1]))
  self.last=p2
 def _closePath(self):
  if self.start is not None:self.points.append(self.start);self.last=self.start

def inspect_svg(name,svg_path,map_path):
 svg=svg_path.read_bytes(); root=ET.fromstring(svg)
 data=json.loads(map_path.read_text());refs=defaultdict(list)
 for rec in data.get('hexCenterRailConnections',[]):
  for id in rec.get('sourceSvgIds',[]):refs[id].append(':'.join(sorted((rec['from'],rec['to']))))
 parent={child:p for p in root.iter() for child in p}; by_id={e.get('id'):e for e in root.iter() if e.get('id')}
 results=[];failures=[]
 for id in sorted(refs):
  e=by_id.get(id)
  if e is None: failures.append({'id':id,'issue':'missing-id'});continue
  layers=[];cur=e;hidden=False;transform=[]
  while cur is not None:
   if cur.get(INK+'label'):layers.append(cur.get(INK+'label'))
   style=cur.get('style','').replace(' ','').lower()
   if 'display:none' in style or 'visibility:hidden' in style or cur.get('display')=='none':hidden=True
   if cur.get('transform'):transform.append(cur.get('transform'))
   cur=parent.get(cur)
  issues=[]
  if e.tag.rsplit('}',1)[-1]!='path':issues.append('not-svg-path')
  if 'railways' not in layers: issues.append('outside-railways-layer')
  if hidden:issues.append('hidden')
  style=e.get('style','').replace(' ','').lower()
  if 'stroke:none' in style or e.get('stroke')=='none':issues.append('no-stroke')
  d=e.get('d',''); pen=SamplePen()
  if not d:issues.append('missing-path-data')
  else:
   try:parse_path(d,pen)
   except Exception as exc:issues.append('unparseable-path:'+type(exc).__name__)
  pts=pen.points
  length=sum(math.hypot(b[0]-a[0],b[1]-a[1]) for a,b in zip(pts,pts[1:]))
  if length<=0.01:issues.append('zero-length')
  bbox=([round(min(x for x,y in pts),3),round(min(y for x,y in pts),3),round(max(x for x,y in pts),3),round(max(y for x,y in pts),3)] if pts else None)
  item={'sourceSvgId':id,'referenceCount':len(refs[id]),'candidatePairs':sorted(refs[id]),'elementType':e.tag.rsplit('}',1)[-1],'railLayer': 'railways' in layers,'transforms':transform,'localPathBounds':bbox,'approxLocalPathLength':round(length,3),'issues':issues,'status':'vector-geometry-inspected-not-hex-pair-certified'}
  results.append(item)
  if issues:failures.append({'id':id,'issues':issues})
 return {'sourceSvg':str(svg_path.relative_to(ROOT)) if svg_path.is_relative_to(ROOT) else svg_path.name,'sourceSvgSha256':hashlib.sha256(svg).hexdigest(),'candidatePairs':sum(len(v) for v in refs.values()),'uniqueReferencedPaths':len(refs),'inspectedPaths':len(results),'issues':failures,'paths':results,'limitations':['Local path length/bounds are before SVG group transforms; they cannot certify hex-center alignment.','No pixel-to-SVG registration or path-to-each-candidate-pair certification is asserted.','All movement-source candidates remain provisional.']}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--write',action='store_true');ap.add_argument('--fixture-svg');ap.add_argument('--fixture-map');a=ap.parse_args()
 if a.fixture_svg:
  d=inspect_svg('fixture',pathlib.Path(a.fixture_svg),pathlib.Path(a.fixture_map))
  print(json.dumps(d));return 1 if d['issues'] else 0
 records={}
 for name,filename in SOURCES.items():records[name]=inspect_svg(name,ROOT/'maps/source/user-svg'/filename,ROOT/'maps'/f'{name}.json')
 output={'schemaVersion':1,'scope':'Railway SVG path-vector geometry and railway-layer integrity only; not gameplay certification','maps':records}
 if a.write:
  p=ROOT/'rules/audit/arduous-kiev-rail-vector-geometry-v318.json';p.write_text(json.dumps(output,indent=2)+'\n');print('Wrote',p.relative_to(ROOT))
 else:
  print(json.dumps({name:{k:v for k,v in rec.items() if k in ('candidatePairs','uniqueReferencedPaths','inspectedPaths','issues')} for name,rec in records.items()},indent=2))
 return 1 if any(rec['issues'] for rec in records.values()) else 0
if __name__=='__main__':sys.exit(main())
