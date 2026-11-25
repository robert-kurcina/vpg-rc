#!/usr/bin/env python3
"""Derive per-hex Arduous terrain overlays directly from authored SVG paths.

Original authored artwork is authoritative. The map's SVG->pixel registration
is retained (and its residuals disclosed), not independently certified here.
An absent forest/swamp overlay is a visual fact, not a gameplay rule.
"""
import argparse, hashlib, json, math, pathlib, re, xml.etree.ElementTree as ET
from importlib.machinery import SourceFileLoader

ROOT=pathlib.Path(__file__).resolve().parents[1]
MAP=ROOT/'maps/arduous.json'
SVG=ROOT/'maps/source/user-svg/arduous-map-temp(3).svg'
OUT=ROOT/'rules/audit/arduous-svg-terrain-per-hex-v318.json'
INK='{http://www.inkscape.org/namespaces/inkscape}'
PATH=SourceFileLoader('cp76_sample',str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()

# Affine representation: (a,b,c,d,e,f), x' = a*x+c*y+e, y'=b*x+d*y+f.
IDENT=(1.,0.,0.,1.,0.,0.)
def compose(u,v):
 a,b,c,d,e,f=u;A,B,C,D,E,F=v
 return (a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f)
def point(m,p):
 a,b,c,d,e,f=m;x,y=p;return (a*x+c*y+e,b*x+d*y+f)
def transform(s):
 m=IDENT
 for name,raw in re.findall(r'([a-zA-Z]+)\s*\(([^)]*)\)',s or ''):
  v=[float(x) for x in re.split(r'[\s,]+',raw.strip()) if x]
  if name=='matrix' and len(v)==6:t=tuple(v)
  elif name=='translate' and len(v) in (1,2):t=(1,0,0,1,v[0],v[1] if len(v)>1 else 0)
  elif name=='scale' and len(v) in (1,2):t=(v[0],0,0,v[1] if len(v)>1 else v[0],0,0)
  elif name=='rotate' and len(v) in (1,3):
   a=math.radians(v[0]);c=math.cos(a);s=math.sin(a);r=(c,s,-s,c,0,0)
   if len(v)==3:t=compose(compose((1,0,0,1,v[1],v[2]),r),(1,0,0,1,-v[1],-v[2]))
   else:t=r
  else:raise ValueError('unsupported-svg-transform:'+name)
  m=compose(m,t)
 return m

def inspect(map_path=MAP,svg_path=SVG):
 raw_map=pathlib.Path(map_path).read_bytes();raw_svg=pathlib.Path(svg_path).read_bytes()
 board=json.loads(raw_map);root=ET.fromstring(raw_svg)
 reg=board['authoredSourceVectors']['registration']
 if hashlib.sha256(raw_svg).hexdigest()!=board['authoredSvgImportAudit']['sourceSvgSha256']:
  raise ValueError('source-SVG-checksum-mismatch')
 parents={c:p for p in root.iter() for c in p}; nodes={}
 for e in root.iter():
  if e.get('id'):
   if e.get('id') in nodes:raise ValueError('duplicate-svg-id')
   nodes[e.get('id')]=e
 cells={c['id']:c for c in board['cells']}
 if len(cells)!=len(board['cells']):raise ValueError('duplicate-hex-id')
 center={cid:tuple(c['pixelCenter']) for cid,c in cells.items()}
 records=[]; seen=set()
 for kind in ('forest','swamp'):
  for entry in board['authoredSvgImportAudit']['details']['terrain'][kind]:
   ident=entry['sourceSvgId']; e=nodes.get(ident)
   if e is None or not e.get('d'):raise ValueError('missing-authored-vector:'+ident)
   if ident in seen:raise ValueError('duplicate-source-vector:'+ident)
   seen.add(ident)
   chain=[];cur=e
   while cur is not None:
    chain.append(cur);cur=parents.get(cur)
   chain.reverse()
   if not any(x.get(INK+'label')==('forests' if kind=='forest' else 'swamp') for x in chain):
    raise ValueError('wrong-terrain-layer:'+ident)
   m=IDENT
   # The existing map registration was calibrated in layer-local SVG coordinates:
   # root layer6 translation is already accounted for in the registration.
   # Apply transforms inside the feature path, not the enclosing layer.
   layer_index=next(i for i,x in enumerate(chain) if x.get(INK+'label') in ('forests','swamp'))
   for x in chain[layer_index+1:]:m=compose(m,transform(x.get('transform')))
   pen=PATH.SamplePen();PATH.parse_path(e.get('d'),pen)
   if len(pen.points)<3:raise ValueError('empty-terrain-vector:'+ident)
   pts=[point(m,p) for p in pen.points]
   # This is the actual vector polygon's centroid, not a raster sample.
   # The marker is a filled hexagon; fallback to vertex mean only for invalid outlines.
   area=0.;sx=0.;sy=0.
   for (x,y),(X,Y) in zip(pts,pts[1:]+pts[:1]):
    cross=x*Y-X*y;area+=cross;sx+=(x+X)*cross;sy+=(y+Y)*cross
   if abs(area)<1e-8:raise ValueError('degenerate-terrain-polygon:'+ident)
   svgcenter=(sx/(3*area),sy/(3*area))
   pix=(svgcenter[0]*reg['scaleX']+reg['translateX'],svgcenter[1]*reg['scaleY']+reg['translateY'])
   nearest=sorted(((math.dist(pix,xy),hid) for hid,xy in center.items()))
   hid=nearest[0][1]
   if hid!=entry['cellId']:raise ValueError('vector-to-hex-mismatch:'+ident+':'+hid+':'+entry['cellId'])
   if cells[hid].get('terrain')!=kind:raise ValueError('vector-terrain-mismatch:'+hid)
   records.append({'hexId':hid,'feature':kind,'sourceSvgId':ident,'visualGeometry':'transformed-filled-svg-path',
     'vectorCentroidPx':[round(v,4) for v in pix],'centerResidualPx':round(nearest[0][0],4),
     'nextNearestHexId':nearest[1][1],'nextNearestDistancePx':round(nearest[1][0],4)})
 byhex={}
 for r in records:
  if r['hexId'] in byhex:raise ValueError('multiple-terrain-markers:'+r['hexId'])
  byhex[r['hexId']]=r
 output=[]
 for hid in sorted(cells):
  c=cells[hid];marker=byhex.get(hid)
  output.append({'hexId':hid,'terrainOverlay':marker['feature'] if marker else None,
   'sourceSvgIds':[marker['sourceSvgId']] if marker else [],
   'visualClassification':'authored-svg-feature' if marker else 'no-authored-forest-or-swamp-overlay',
   'previousTerrainValue':c.get('terrain'),'previousTerrainStatus':c.get('terrainStatus'),
   'gameplayTerrainCertified':False})
 return {'schemaVersion':1,'scope':'SVG-first per-hex forest/swamp overlays; no raster color sampling; no gameplay certification',
  'mapId':'arduous','sourceSvgSha256':hashlib.sha256(raw_svg).hexdigest(),'sourceMapSha256':hashlib.sha256(raw_map).hexdigest(),
  'registrationStatus':'existing-map-SVG-to-pixel-registration-not-independently-certified',
  'counts':{'hexes':len(cells),'forest':sum(r['feature']=='forest' for r in records),
    'swamp':sum(r['feature']=='swamp' for r in records),'noAuthoredOverlay':len(cells)-len(records),
    'maxMarkerCenterResidualPx':max(round(x['centerResidualPx'],4) for x in records)},
  'authoredGeometry':sorted(records,key=lambda r:r['hexId']),'hexes':output,
  'untranscribedHexes':[r['hexId'] for r in output if r['previousTerrainValue'] is None],
  'assumptions':['The authored forests/swamp layers are exhaustive for those two visual overlays.',
   'A hex without those overlays is not asserted to lack other features or to allow movement.',
   'Source SVG paths have higher visual authority than original scanned artwork.'],
  'authorizedForMovement':False}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--write',action='store_true');args=ap.parse_args()
 result=inspect()
 if args.write:OUT.write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result['counts']))
if __name__=='__main__':main()
