#!/usr/bin/env python3
"""Use definitive source ONLY as semantic geometry, never as a parallel renderer."""
import json, pathlib, re, math, collections
from lxml import etree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]; mp=ROOT/'maps'; p=mp/'odessa-extension.json'
e=json.loads(p.read_text()); b=json.loads((mp/'kiev.json').read_text())
overrides=e['authoritativeCellOverrides']; candidates=e['authoritativeWaterEdgeCandidates']; source=e['authoritativeCompositeSvg']
# All source city symbols sit on open terrain, regardless of separate terrain swatches.
cityids=set(e['v289SourceImportAudit']['cities']['minor']['hexIds']+e['v289SourceImportAudit']['cities']['major']['hexIds'])
for cid,c in overrides.items():
 if cid in cityids:
  c['terrain']='open';c['terrainStatus']='authoritative-user-clarification-city-is-open-v290'
 c.pop('terrainTextureOpacityMultiplier',None)
 # Remove obsolete legacy river/coast effects; only source-derived edges survive.
 c['hexsideFeatures']={d:v for d,v in (c.get('hexsideFeatures') or {}).items() if v.get('type') not in ('river','majorRiver','coast','lake')}
 c['tileEdges']={d:[x for x in (arr if isinstance(arr,list) else [arr]) if x.get('kind') not in ('river','majorRiver','coast','lake')] for d,arr in (c.get('tileEdges') or {}).items()}
# Reconstruct each unique physical river hexside; major river takes priority.
# Source-derived candidate edges have 0..4.5 px geometric deviation from the author vectors.
byid={c['id']:c for c in b['cells']+e['cells']}; byid={cid:c for cid,c in byid.items() if cid in overrides}; dirs={'N':'S','NE':'SW','SE':'NW','S':'N','SW':'NE','NW':'SE'}
priority={'river':1,'majorRiver':2,'coast':3}; selected={}; conflicts=[]
for feature in candidates:
 for hit in feature['hexsideCandidates']:
  cell, d, neighbor=hit['cellId'],hit['dir'],hit.get('neighborId')
  if cell not in overrides:continue
  key=tuple(sorted([cell+':'+d,(neighbor+':'+dirs[d]) if neighbor in overrides else cell+':'+d]))
  existing=selected.get(key); entry={**hit,'kind':feature['kind'],'sourceSvgId':feature['sourceId']}
  if existing and existing['kind']!=entry['kind']:
   conflicts.append({'edge':key,'existing':existing['kind'],'new':entry['kind']})
  if not existing or priority[entry['kind']]>priority[existing['kind']] or (priority[entry['kind']]==priority[existing['kind']] and hit['offsetPx']<existing['offsetPx']):selected[key]=entry
shore=[]; river=collections.Counter()
for item in selected.values():
 cid,d,neighbor,kind=item['cellId'],item['dir'],item.get('neighborId'),item['kind']
 if kind=='coast': shore.append({'cellId':cid,'dir':d,'kind':'coast','sourceSvgId':item['sourceSvgId'],'sourceOffsetPx':item['offsetPx']});continue
 river[kind]+=1
 for tid,td in [(cid,d)]+([(neighbor,dirs[d])] if neighbor in overrides else []):
  arr=overrides[tid].setdefault('tileEdges',{}).setdefault(td,[])
  if not any(f.get('kind')==kind for f in arr):arr.append({'kind':kind,'status':'definitive-user-svg-hexside-v290','sourceSvgId':item['sourceSvgId']})
e['authoredShoreHexsides']=shore
# Source rail polylines are from user SVG geometry, not the old Kiev/extension scans.
r=ET.parse(str(mp/'source/user-svg/kiev-odessa-main.svg')); root=r.getroot(); ns='{http://www.inkscape.org/namespaces/inkscape}'
layer=next(x for x in root.iter() if x.get(ns+'label')=='railways' and x.get(ns+'groupmode')=='layer')
nums=r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[Ee][-+]?\d+)?';tok=re.compile(r'[MmLlHhVvZz]|'+nums)
# Traverses the simple M/L/H/V commands used by all 24 authored rail paths.
def flatten(d):
 t=tok.findall(d); i=0; cmd=None; xy=[0.,0.]; pts=[];start=[0.,0.]
 arity={'M':2,'L':2,'H':1,'V':1,'Z':0}
 while i<len(t):
  if t[i].isalpha():cmd=t[i];i+=1
  if not cmd:break
  kind=cmd.upper();n=arity[kind]
  if kind=='Z':xy=start.copy();pts.append(xy.copy());cmd=None;continue
  if i+n>len(t):break
  v=list(map(float,t[i:i+n]));i+=n;rel=cmd.islower()
  if kind in ('L','M'):xy=[xy[j]+v[j] if rel else v[j] for j in range(2)]
  elif kind=='H':xy[0]=xy[0]+v[0] if rel else v[0]
  elif kind=='V':xy[1]=xy[1]+v[0] if rel else v[0]
  if kind=='M':start=xy.copy();cmd='l' if rel else 'L'
  pts.append(xy.copy())
 return pts
# The layer is translated by 92.629061,130.33038 millimeters.
match=re.search(r'translate\(([^,)]+)[, ]+([^,)]+)\)',layer.get('transform') or '')
tx,ty=(float(match[1]),float(match[2])) if match else (0,0)
scale=96/25.4
rails=[]
for node in layer:
 if ET.QName(node.tag).localname!='path':continue
 pts=flatten(node.get('d',''))
 if len(pts)<2:continue
 rails.append({'sourceSvgId':node.get('id'),'points':[[round((x+tx)*scale,4),round((y+ty)*scale,4)] for x,y in pts], 'source':'definitive-kiev-odessa-main-svg','registration':'authored-coordinates'})
e['authoritativeRailRoutes']=rails
# Metadata remains for provenance but is not a live drawing instruction.
e['authoritativeCompositeOverride']=False
e['waterRenderingMode']='hexside-wavelets'; e['riverRenderingMode']='hexside-procedural'; e['sourceSeaInteriorMode']='no-sea-polygons'
e['waterPresentation']['topologySource']='user definitive SVG hexside geometry; no sea polygons'
e['v290GeometryAudit']={'cityHexOpen':len(cityids),'physicalRiverEdges':dict(river),'coastEdges':len(shore),'sourceRailPaths':len(rails),'candidateConflicts':conflicts,'sourceSha256':source['sha256'],'policy':'canonical engine svgMap; bitmap tiles; reciprocal river hexsides; procedural water; authored rail points; no sea polygons'}
p.write_text(json.dumps(e,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({'river':dict(river),'shore':len(shore),'rails':len(rails),'conflicts':len(conflicts),'cities':len(cityids)},indent=2))
