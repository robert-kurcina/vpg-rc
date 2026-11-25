#!/usr/bin/env python3
"""Independent calibration of historical Leningrad deployment markers.

Six original board-scan hex *grid centers* provide the transformation; the
cross/star observations do not participate in the fit. The image is supplied
board-scan evidence. Registry IDs remain engine-internal until full rekey.
"""
from __future__ import annotations
import hashlib,json,math,pathlib,subprocess
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAP=ROOT/'maps/leningrad.json'
SCAN=ROOT/'rules/audit/visual/leningrad-east-prussia-scan-crop-v324.png'
# Grid-centroid measurements (pixel X/Y) directly from scan crop, *not* marker positions.
GRID_ANCHORS={
 '0209': (345.,208.), '0309': (514.,310.), '0409': (684.,209.),
 '0210': (345.,410.), '0310': (515.,508.), '0410': (684.,410.)
}
# Symbol centers manually transcribed from original board scan crop (pixel X/Y).
MARKER_CENTERS=[
 ('star',(175.,105.)),('star',(345.,215.)),('star',(515.,312.)),
 ('star',(680.,420.)),('star',(858.,532.)),
 ('cross',(178.,311.)),('cross',(352.,397.)),('cross',(519.,500.)),
 ('cross',(320.,626.)),('cross',(670.,578.))
]

def solve3(A,b):
 a=[list(row)+[value] for row,value in zip(A,b)]
 for i in range(3):
  piv=max(range(i,3),key=lambda j:abs(a[j][i]))
  if abs(a[piv][i])<1e-8:raise ValueError('degenerate grid registration')
  a[i],a[piv]=a[piv],a[i]
  div=a[i][i]; a[i]=[z/div for z in a[i]]
  for j in range(3):
   if i!=j:
    s=a[j][i];a[j]=[v-s*w for v,w in zip(a[j],a[i])]
 return [r[3] for r in a]

# Source-SVG symbol instance IDs from the supplied authored Leningrad SVG.
AUTHORED_SYMBOLS={
 'cross':['use1-1','use495','use496','use497','use498'],
 'star':['use1-6','use499','use500','use501','use502']
}

def source_svg_instance_hosts(cells):
 """Inspect actual authored SVG geometry; do NOT confuse SVG with original scan."""
 svg=ROOT/'maps/source/user-svg/leningrad-main.svg'
 result=subprocess.run(['inkscape',str(svg),'--query-all'],capture_output=True,text=True,check=True)
 ids={}
 for line in result.stdout.splitlines():
  parts=line.split(',')
  if len(parts)==5:
   try:ids[parts[0]]=[float(parts[1])+float(parts[3])/2.,float(parts[2])+float(parts[4])/2.]
   except ValueError:pass
 output=[]
 for kind,sources in AUTHORED_SYMBOLS.items():
  for sid in sources:
   if sid not in ids:raise ValueError('Authored SVG symbol instance missing: '+sid)
   center=ids[sid]
   ranking=sorted(((math.dist(center,c['pixelCenter']),cid) for cid,c in cells.items()))
   if ranking[0][0]>0.2:raise ValueError('Authored SVG instance not at a hex center: '+sid)
   output.append({'kind':kind,'sourceSvgId':sid,'svgCenter':[round(v,3) for v in center],
        'hostCell':ranking[0][1],'centerError':round(ranking[0][0],3)})
 return output

def audit(data=None):
 if data is None:data=json.loads(MAP.read_text())
 cells={c['id']:c for c in data['cells']}
 if not SCAN.exists():raise ValueError('original scan crop missing')
 xmat=[[*pt,1.] for pt in GRID_ANCHORS.values()]
 ym=[cells[hid]['pixelCenter'] for hid in GRID_ANCHORS]
 normal=[[sum(row[i]*row[j] for row in xmat) for j in range(3)] for i in range(3)]
 cf=[solve3(normal,[sum(row[i]*tar[dim] for row,tar in zip(xmat,ym)) for i in range(3)]) for dim in range(2)]
 def xy(src):return [sum(coeff[i]*[*src,1][i] for i in range(3)) for coeff in cf]
 residual=[math.dist(xy(pos),cells[hid]['pixelCenter']) for hid,pos in GRID_ANCHORS.items()]
 if max(residual)>2.0: raise ValueError('source grid calibration exceeds tolerance')
 assignments=[]
 for kind,source in MARKER_CENTERS:
  dst=xy(source)
  ranking=sorted(((math.dist(dst,c['pixelCenter']),cid) for cid,c in cells.items()))
  nearest,second=ranking[:2]
  assignments.append({'kind':kind,'scanXY':list(source),'projectedEngineXY':[round(v,3) for v in dst],
      'hostCell':nearest[1],'distancePx':round(nearest[0],3),'runnerUpCell':second[1],
      'runnerUpDistancePx':round(second[0],3)})
  if nearest[0]>15 or second[0]-nearest[0]<30:
   raise ValueError('ambiguous deployment geometry at '+str(source))
 groups={kind:sorted(x['hostCell'] for x in assignments if x['kind']==kind) for kind in ('cross','star')}
 actual={kind:sorted(c['id'] for c in data['cells'] for m in c.get('tileMarkers',[]) if m.get('kind')==kind) for kind in ('cross','star')}
 if any(len(v)!=5 for v in groups.values()) or len(set(groups['cross']+groups['star']))!=10:
  raise ValueError('source marker hosts collide')
 if actual!=groups:raise ValueError(f'live marker registry disagrees with independently measured grid: expected {groups}, actual {actual}')
 return {'schemaVersion':1,'sourceScan':'rules/audit/visual/leningrad-east-prussia-scan-crop-v324.png',
  'scanSha256':hashlib.sha256(SCAN.read_bytes()).hexdigest(),
  'sourceSVG':'maps/source/user-svg/leningrad-main.svg',
  'sourceSvgSha256':hashlib.sha256((ROOT/'maps/source/user-svg/leningrad-main.svg').read_bytes()).hexdigest(),
  'method':'least-squares affine fit of six physical hex-grid centers; marker coordinates excluded from calibration',
  'gridAnchors':[{'hostCell':k,'scanXY':list(v),'engineXY':cells[k]['pixelCenter']} for k,v in GRID_ANCHORS.items()],
  'affineXY':cf,'gridResidualPx':[round(v,3) for v in residual],
  'observations':assignments,'derivedHosts':groups,'actualHosts':actual,
  'authoredSVGInstanceHosts':source_svg_instance_hosts(cells),
  'warning':'Authored main SVG cross positions differ from printed board scan. Scan governs candidate historical deployment; all source artifacts preserved.',
  'historicalSetupAuthorized':False}

if __name__=='__main__':
 d=audit()
 out=ROOT/'rules/audit/leningrad-independent-grid-registration-v342.json'
 out.write_text(json.dumps(d,indent=2)+'\n')
 print(json.dumps({'status':'PASS','derived':d['derivedHosts'],'maxGridResidualPx':max(d['gridResidualPx'])}))
