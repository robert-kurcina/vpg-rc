#!/usr/bin/env python3
"""Import user's definitive Inkscape vector map into explicit engine configuration.
Requires Inkscape query-all for rendered element coordinates. Does not interpret unlabelled placeholder hexnumbers as real IDs.
"""
from lxml import etree as ET
from collections import Counter, defaultdict
import os, json, math, re, hashlib, subprocess, pathlib, copy
ROOT=pathlib.Path(__file__).resolve().parents[1]
SRC=pathlib.Path(os.environ.get('AUTHORITATIVE_SVG','/mnt/data/kiev-odessa-main.svg'))
MAPS=ROOT/'maps'
BASE=json.loads((MAPS/'kiev.json').read_text())
EXT=json.loads((MAPS/'odessa-extension.json').read_text())
CELLS={c['id']:c for c in BASE['cells']+EXT['cells']}
query=subprocess.check_output(['inkscape',str(SRC),'--query-all'],stderr=subprocess.DEVNULL,text=True)
boxes={}
for line in query.splitlines():
 parts=line.split(',')
 if len(parts)!=5: continue
 try: boxes[parts[0]]=tuple(map(float,parts[1:]))
 except ValueError: pass
ns='{http://www.inkscape.org/namespaces/inkscape}'
root=ET.parse(str(SRC)).getroot()
layer_by_name={g.get(ns+'label'):g for g in root.iter() if g.get(ns+'groupmode')=='layer'}
scale=96/25.4
coords={cid:tuple(c['pixelCenter']) for cid,c in CELLS.items()}
def closest(cx,cy,maxdist=8):
 d,cid=min((math.hypot(cx-x,cy-y),cid) for cid,(x,y) in coords.items())
 return cid if d<maxdist else None

def assign(layer,terrain=None,marker=None):
 match=[];miss=[]
 for child in layer.iter():
  if child is layer: continue
  if ET.QName(child.tag).localname not in ('use','path','circle','rect'):continue
  key=child.get('id')
  if key not in boxes:continue
  x,y,w,h=boxes[key]
  # use elements carry an exact hex-sized frame; paths may be railway features or geometry
  if not (60<w<82 and 58<h<75):continue
  cid=closest(x+w/2,y+h/2,6)
  if not cid: miss.append(key);continue
  match.append((cid,key))
  if terrain:
   CELLS[cid]['terrain']=terrain; CELLS[cid]['terrainStatus']='authoritative-user-svg-'+terrain+'-v289'
  if marker:
   CELLS[cid].setdefault('tileMarkers',[])
   if not any(q.get('kind')==marker for q in CELLS[cid]['tileMarkers']): CELLS[cid]['tileMarkers'].append({'kind':marker,'sourceSvgId':key,'status':'user-definitive-svg-v289'})
 return match,miss
# Source explicit terrain definitions: open first, forest/swamp override.
for c in CELLS.values():
 c['terrain']=None;c['terrainStatus']='unclassified-in-definitive-user-svg-v289'
 c['terrainTextureOpacityMultiplier']=0
terrain_audits={}
for name,kind in [('open','open'),('forests','forest'),('swamp','swamp')]:
 m,miss=assign(layer_by_name[name],terrain=kind)
 terrain_audits[name]={'objects':len(m),'uniqueHexes':len(set(cid for cid,_ in m)),'unmapped':miss}
# The source map distinguishes major and minor settlements by symbol, not by names.
city_audits={}
for name,kind in [('minor','city'),('major','majorCity')]:
 m,miss=assign(layer_by_name[name],marker=kind)
 city_audits[name]={'symbols':len(m),'hexIds':sorted(set(cid for cid,_ in m)),'unmapped':miss}
# Deployments symbols are not sized like terrain; match their bbox center to hex, but
# do not force a faction association not present in the artwork.
deploy=[]
for child in layer_by_name['deployments']:
 key=child.get('id');b=boxes.get(key)
 if b:
  x,y,w,h=b;cid=closest(x+w/2,y+h/2,24)
  deploy.append({'svgId':key,'cellId':cid,'bboxPx':[round(v,2) for v in b], 'status':'source-symbol-location-not-faction-certified'})
# Explicit hex grid defines which 230 cells are on the board.
source_grid=[];unmapped=[]
for child in layer_by_name['hexgrid']:
 key=child.get('id'); b=boxes.get(key)
 if b:
  x,y,w,h=b;cid=closest(x+w/2,y+h/2,8)
  if cid:source_grid.append(cid)
  else:unmapped.append({'svgId':key,'center':[round(x+w/2,2),round(y+h/2,2)]})
allowed=set(source_grid)
source_only=sorted(allowed-set(CELLS))
engine_only=sorted(set(CELLS)-allowed)
# The board SVG is the definitive board mask: a cell that lacks a grid polygon
# is not silently retained merely because it existed in v288.
BASE['cells']=[c for c in BASE['cells'] if c['id'] in allowed]
EXT['cells']=[c for c in EXT['cells'] if c['id'] in allowed]
# Preserve original shape SVG (defs and groups) per feature in a JSON configuration;
# no raster image, external references, original text placeholders, or scan layer.
# JSON paths retain authored colors, widths, transforms and symbol geometry.
import copy
source_defs=root.find('{http://www.w3.org/2000/svg}defs')
def xml(node):return ET.tostring(node,encoding='unicode',with_tail=False)
features=[]
for label in ['open','forests','swamp','minor','major','river-minor','river-major','coasts','lakes','railways','fortifications','deployments','reinforcements']:
 layer=layer_by_name[label]
 features.append({'name':label,'svgId':layer.get('id'),'elementCount':len(layer),'vectorSvg':xml(layer),'status':'definitive-user-vector-import-v289'})
# Keep only symbols referenced; refs stay in source defs, but image nodes omitted.
vector={'sourceFile':'kiev-odessa-main.svg','sha256':hashlib.sha256(SRC.read_bytes()).hexdigest(),
 'units':'mm','pxPerMm':scale,'viewBox':root.get('viewBox'),'defsSvg':xml(source_defs),
 'layers':features,'gridSvg':xml(layer_by_name['hexgrid']),'renderPolicy':'render-source-vectors-with-engine-hex-number-overlay',
 'hexNumberPolicy':'derive-from-column-row; ignore source repeated 0101 placeholder',
 'waterPolicy':'authored-river-coast-centerlines-are-visual; hexside-gameplay-uncertified'}
EXT['authoritativeCompositeSvg']=vector
# Disable all previous, superseded bitmap/source geometry during composite render.
EXT['authoritativeCompositeOverride']=True
EXT['v289SourceImportAudit']={'sourceSha256':vector['sha256'],'sourceHexgridCount':len(source_grid),'sourceGridUnique':len(allowed),
 'sourceGridUnmapped':unmapped,'engineOnlyCellsRemoved':engine_only,'sourceOnlyCellsMissing':source_only,
 'terrain':terrain_audits,'cities':city_audits,'deployments':deploy,
 'layerCounts':{f['name']:f['elementCount'] for f in features},
 'notes':['Unlabelled/source-placeholder hex numbers generated by engine','River/coast paths definitive visual geometry, gameplay rules require hexside adjudication','Source lake and fortification layers have no geometry']}
# Clear old city and terrain marks that contradict new source? Preserve city names only where source indicates.
source_city=set(city_audits['minor']['hexIds']+city_audits['major']['hexIds'])
for c in BASE['cells']+EXT['cells']:
 if c['id'] not in source_city:
  c.pop('city',None)
  c['tileMarkers']=[m for m in c.get('tileMarkers',[]) if m.get('kind') not in ('city','majorCity')]
 else:
  # Preserve name only if previously assigned, otherwise refrain from inventing one.
  pass
# Authored shoreline geometry overrides quarantined old list; cannot infer gameplay edges.
EXT['authoredShoreHexsides']=[]
# Old sea and river bitmap is obsolete (keep review evidence in audit, not used in render).
EXT['sourceSeaInteriorMode']='definitive-user-svg-v289'
EXT['waterRenderingMode']='authoritative-svg'
EXT['riverRenderingMode']='authoritative-svg'
(MAPS/'source/user-svg/kiev-odessa-main.svg').write_bytes(SRC.read_bytes())
(MAPS/'kiev.json').write_text(json.dumps(BASE,indent=2,ensure_ascii=False)+'\n')
(MAPS/'odessa-extension.json').write_text(json.dumps(EXT,indent=2,ensure_ascii=False)+'\n')
print(json.dumps(EXT['v289SourceImportAudit'],indent=2))
