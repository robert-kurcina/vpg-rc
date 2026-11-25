import json,math,pathlib,re
from lxml import etree as E
root=pathlib.Path(__file__).resolve().parents[1];p=root/'maps/odessa-extension.json';ext=json.loads(p.read_text())
segs=json.loads(pathlib.Path('/mnt/data/work_v289/boundary_segments.json').read_text())
svg=E.parse(str(root/'maps/source/user-svg/kiev-odessa-main.svg')); ns='{http://www.inkscape.org/namespaces/inkscape}'
layer=next(x for x in svg.iter() if x.get(ns+'label')=='reinforcements' and x.get(ns+'groupmode')=='layer')
num=r'[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[Ee][-+]?\d+)?';token=re.compile(r'[MmLlHhVvZz]|'+num)
def flatten(d):
 t=token.findall(d);i=0;cmd=None;xy=[0.,0.];start=[0,0];pts=[]
 while i<len(t):
  if t[i].isalpha():cmd=t[i];i+=1
  if not cmd:break
  k=cmd.upper();n={'M':2,'L':2,'H':1,'V':1,'Z':0}[k]
  if k=='Z':xy=start.copy();pts.append(xy.copy());cmd=None;continue
  v=list(map(float,t[i:i+n]));i+=n;rel=cmd.islower()
  if k in ('L','M'):xy=[xy[j]+v[j] if rel else v[j] for j in range(2)]
  elif k=='H':xy[0]=xy[0]+v[0] if rel else v[0]
  elif k=='V':xy[1]=xy[1]+v[0] if rel else v[0]
  if k=='M':start=xy.copy();cmd='l' if rel else 'L'
  pts.append(xy.copy())
 return pts
tr=layer.get('transform');m=re.search(r'translate\(([^,)]+)[, ]+([^,)]+)\)',tr);tx,ty=float(m[1]),float(m[2]);fac=96/25.4
paths=[]
for child in layer:
 if E.QName(child.tag).localname=='path':
  points=[[(x+tx)*fac,(y+ty)*fac] for x,y in flatten(child.get('d',''))]
  paths.append((child.get('id'),points))
def dist(pt,a,b):
 dx=b[0]-a[0];dy=b[1]-a[1];t=max(0,min(1,((pt[0]-a[0])*dx+(pt[1]-a[1])*dy)/(dx*dx+dy*dy or 1)));return math.hypot(pt[0]-a[0]-t*dx,pt[1]-a[1]-t*dy)
for id,pts in paths:
 ds=[]
 for e in segs:
  mid=[(e['a'][i]+e['b'][i])/2 for i in [0,1]]
  ds.append(min(dist(mid,pts[j],pts[j+1]) for j in range(len(pts)-1)))
 print(id,'near 3',sum(d<=3 for d in ds),'near 5',sum(d<=5 for d in ds),'near 8',sum(d<=8 for d in ds),'range',min(ds),max(ds))
# The source outline has two separate identified German and Soviet paths.
# Identify top/north-west perimeter as German, east/south-east as Soviet.
entry={}
for sourceid,pts in paths:
 side='german' if sum(p[0] for p in pts)/len(pts)<700 else 'soviet'
 for edge in segs:
  mid=[(edge['a'][i]+edge['b'][i])/2 for i in [0,1]]
  distance=min(dist(mid,pts[j],pts[j+1]) for j in range(len(pts)-1))
  if distance<=4.5:
   key=edge['cellId']+':'+edge['dir']
   entry[key]={'cellId':edge['cellId'],'dir':edge['dir'],'side':side,'sourceSvgId':sourceid,'offsetPx':round(distance,2)}
ext['authoritativeEntryEdges']=list(entry.values())
ext['v290GeometryAudit']['entryEdgeCounts']={side:sum(q['side']==side for q in entry.values()) for side in ['german','soviet']}
p.write_text(json.dumps(ext,indent=2,ensure_ascii=False)+'\n')
