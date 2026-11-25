#!/usr/bin/env python3
"""Import exact SVG railway polylines and deployments; don't replace the shared renderer."""
from pathlib import Path
from lxml import etree as ET
import json,hashlib,subprocess,re,math,collections
root=Path(__file__).resolve().parents[1]
source=Path('/mnt/data/kiev-odessa-main(1).svg')
extpath=root/'maps/odessa-extension.json'
ext=json.loads(extpath.read_text())
tree=ET.parse(str(source)); inkscape='{http://www.inkscape.org/namespaces/inkscape}'
source_sha=hashlib.sha256(source.read_bytes()).hexdigest()
# Calibrated author SVG coordinates in mm; engine uses 96 CSS pixels per inch.
scale=96/25.4
num=r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?'
token=re.compile(r'[MmLlHhVvZz]|'+num)
def flatten(d):
 t=token.findall(d);i=0;cmd=None;xy=[0.,0.];start=None;pts=[]
 while i<len(t):
  if t[i].isalpha():cmd=t[i];i+=1
  if cmd is None:raise ValueError('Missing path command')
  k=cmd.upper()
  if k=='Z':
   if start is not None:pts.append(start.copy());xy=start.copy()
   cmd=None;continue
  n={'M':2,'L':2,'H':1,'V':1}.get(k)
  if n is None:raise ValueError('Unknown railway command '+cmd)
  if i+n>len(t) or any(x.isalpha() for x in t[i:i+n]):raise ValueError('Incomplete railway command')
  v=list(map(float,t[i:i+n]));i+=n;relative=cmd.islower()
  if k in ['M','L']:xy=[xy[j]+v[j] if relative else v[j] for j in range(2)]
  elif k=='H':xy[0]=xy[0]+v[0] if relative else v[0]
  elif k=='V':xy[1]=xy[1]+v[0] if relative else v[0]
  if k=='M':start=xy.copy();cmd='l' if relative else 'L'
  if not pts or math.dist(pts[-1],xy)>1e-7:pts.append(xy.copy())
 return pts
rail_layer=tree.xpath('//*[@id="layer2"]')[0]
assert rail_layer.get(inkscape+'label')=='railways'
transform=rail_layer.get('transform');m=re.fullmatch(r'translate\(([^,]+),([^\)]+)\)',transform);tx,ty=map(float,m.groups())
rails=[]
for path in rail_layer:
 if ET.QName(path).localname!='path':continue
 pts=[[(p[0]+tx)*scale,(p[1]+ty)*scale] for p in flatten(path.get('d'))]
 if len(pts)<2:raise ValueError('railway has insufficient points '+path.get('id'))
 rails.append({'sourceSvgId':path.get('id'),'sourceSvgSha256':source_sha,'points':pts,'source':'kiev-odessa-main(1).svg','geometry':'exact-svg-polyline-no-spline'})
assert len(rails)==24,len(rails)
# Inkscape computes <use> instances with composed transforms, including symbol definitions.
query=subprocess.check_output(['inkscape',str(source),'--query-all'],text=True,stderr=subprocess.DEVNULL)
bboxes={a[0]:list(map(float,a[1:])) for line in query.splitlines() if len(a:=line.rsplit(',',4))==5}
# The v290 composite is the verified full hex mask. Use its exact centers.
composed=json.loads(subprocess.check_output(['node','-e',"const c=require('./maps/composer');const b=require('./maps/kiev.json'),x=require('./maps/odessa-extension.json');process.stdout.write(JSON.stringify(c.compose(b,x).cells.map(c=>({id:c.id,pixelCenter:c.pixelCenter}))));"],cwd=root,text=True))
byid={c['id']:c for c in composed}
use_layer=tree.xpath('//*[@id="layer8"]')[0]
assert use_layer.get(inkscape+'label')=='deployments'
xlink='{http://www.w3.org/1999/xlink}'
ref_to_kind={'g10':'cross','g11':'star','symbol65':'fixedInfantry','symbol66':'fixedMechanized','symbol63':'fixedCavalry'}
assignments=[];keyset=set()
for use in use_layer:
 if ET.QName(use).localname!='use':continue
 id=use.get('id');ref=use.get(xlink+'href','').removeprefix('#')
 if ref not in ref_to_kind:raise ValueError('Unrecognized deployment symbol '+ref+' '+id)
 if id not in bboxes:raise ValueError('Missing symbol geometry '+id)
 x,y,w,h=bboxes[id];point=[x+w/2,y+h/2]
 nearest=min(composed,key=lambda c:math.dist(c['pixelCenter'],point));dist=math.dist(nearest['pixelCenter'],point)
 if dist>4:raise ValueError('Deployment too far from hex center '+id+' '+str(dist))
 key=(nearest['id'],ref_to_kind[ref])
 if key in keyset:raise ValueError('Duplicated deployment assignment '+str(key))
 keyset.add(key)
 assignments.append({'sourceSvgId':id,'sourceSymbolId':ref,'cellId':nearest['id'],'kind':ref_to_kind[ref], 'sourcePixelCenter':point,'hexCenterDistancePx':round(dist,3)})
assert len(assignments)==36
kinds=set(ref_to_kind.values())
# Remove old placement records everywhere, and install source-only deployment mapping.
for cid,c in ext['authoritativeCellOverrides'].items():
 c['tileMarkers']=[m for m in c.get('tileMarkers',[]) if m.get('kind') not in kinds]
for a in assignments:
 c=ext['authoritativeCellOverrides'][a['cellId']]
 c.setdefault('tileMarkers',[]).append({'kind':a['kind'],'sourceSvgId':a['sourceSvgId'],'sourceSymbolId':a['sourceSymbolId'], 'sourcePixelCenter':a['sourcePixelCenter'],'status':'authoritative-2026-11-17-svg'})
# The 24 paths replace every pre-v291 path and cached railway exit/port stub.
ext['authoritativeRailRoutes']=rails
ext['authoritativeRailStatus']='exact-authoritative-svg-polyline-visual-geometry-no-legacy-splines'
ext['authoritativeRailPolylineGeometry']=True
ext['railwayBoundaryExits']=[]
ext['railwayCoastalTerminals']=[]
ext['v291SourceImportAudit']={ 'sourceFile':source.name,'sha256':source_sha,'railwayPaths':len(rails),'railwayVertices':sum(len(x['points']) for x in rails),'railGeometry':'author-drawn vertices mapped to engine coordinate system; no fitted spline or inferred connector','deploymentCount':len(assignments),'deploymentKindCounts':dict(collections.Counter(a['kind'] for a in assignments)),'deploymentMaximumCenterDeviationPx':max(a['hexCenterDistancePx'] for a in assignments),'deployments':assignments,'sourceLayerIds':{'railways':'layer2','deployments':'layer8'}}
ext['authoritativeCompositeSvg']['sourceFile']=source.name
ext['authoritativeCompositeSvg']['sha256']=source_sha
# Keep the authoritative source copy embedded within the archive for repeatability.
path=root/'maps/source/user-svg/kiev-odessa-main.svg';path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(source.read_bytes())
extpath.write_text(json.dumps(ext,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'rails':len(rails),'vertices':sum(len(x['points']) for x in rails),'deployments':len(assignments),'types':ext['v291SourceImportAudit']['deploymentKindCounts'],'maxCenterDeviationPx':ext['v291SourceImportAudit']['deploymentMaximumCenterDeviationPx']}))
