#!/usr/bin/env python3
"""Restore source-scan mapped Leningrad deployments, never infer from displaced labels."""
import json,hashlib,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'maps/leningrad.json'
d=json.loads(p.read_text())
source=ROOT/'rules/audit/visual/leningrad-east-prussia-scan-crop-v324.png'
assert source.exists()
# Cross positions are original scanned image coordinates from the archived v325 review.
# Targets are computed via physical-centre fit, NOT the drawn hex-number layer.
anchors=[('0109',178,311),('0210',352,397),('0310',519,500),('0211',320,626),('0411',670,578)]
# The following approximate centres are a separate visual transcription of
# the stars in the same original scan crop (not OCR).
stars=[('0108',175,105),('0209',345,215),('0309',515,312),('0410',680,420),('0510',858,532)]
# Least-squares 2D affine, to avoid a new dependency on NumPy at runtime.
def solve(matrix,vals):
 a=[list(row)+[float(v)] for row,v in zip(matrix,vals)]
 n=len(vals)
 for i in range(n):
  pivot=max(range(i,n),key=lambda j: abs(a[j][i]))
  a[i],a[pivot]=a[pivot],a[i]
  if abs(a[i][i])<1e-10:raise ValueError('singular registration')
  z=a[i][i];a[i]=[v/z for v in a[i]]
  for j in range(n):
   if j==i:continue
   z=a[j][i];a[j]=[v-z*q for v,q in zip(a[j],a[i])]
 return [r[-1] for r in a]
cells={c['id']:c for c in d['cells']}
M=[[float(x),float(y),1.] for _,x,y in anchors]
co=[]
for axis in range(2):
 gram=[[sum(row[i]*row[j] for row in M) for j in range(3)] for i in range(3)]
 target=[sum(row[i]*float(cells[hid]['pixelCenter'][axis]) for row,(hid,_,_) in zip(M,anchors)) for i in range(3)]
 co.append(solve(gram,target))
def xy(px,py):return [sum(x*y for x,y in zip(coeff,[px,py,1.])) for coeff in co]
def nearest(px,py):
 q=xy(px,py)
 values=sorted((math.dist(q,c['pixelCenter']),c['id']) for c in d['cells'])
 return q,values[:2]
observations=[]
for kind,source_list in [('cross',anchors),('star',stars)]:
 for hid,x,y in source_list:
  projected,candidates=nearest(x,y)
  if candidates[0][1]!=hid or candidates[0][0]>30 or candidates[1][0]-candidates[0][0]<15:
   raise ValueError(f'ambiguous source registration {kind} {hid}: {candidates}')
  observations.append({'kind':kind,'scanPixelCenter':[x,y],'mappedHex':hid,'projectedEngineCenter':[round(z,3) for z in projected],'nearestDistance':round(candidates[0][0],3),'secondDistance':round(candidates[1][0],3)})
# Remove all candidate star/cross placements, not the city's separate glyphs.
old=[{'hex':c['id'],'markers':[m for m in c.get('tileMarkers',[]) if m.get('kind') in ('star','cross')]} for c in d['cells'] if any(m.get('kind') in ('star','cross') for m in c.get('tileMarkers',[]))]
for c in d['cells']:
 c['tileMarkers']=[m for m in c.get('tileMarkers',[]) if m.get('kind') not in ('star','cross')]
for kind,positions in [('cross',anchors),('star',stars)]:
 for hid,x,y in positions:
  cells[hid].setdefault('tileMarkers',[]).append({'kind':kind,'faction':'german' if kind=='cross' else 'soviet','status':'scan-affine-registered-provisional-v333','source':'rules/audit/visual/leningrad-east-prussia-scan-crop-v324.png','sourceScanPixelCenter':[x,y]})
# Undo presentation-only compensation that obscured physical cell ownership.
prior_shift=d['geometry']['hexNumbers'].pop('rowShift',None)
record={'status':'source-scan-affine-matched-presentation-only;historical-gameplay-not-authorized',
 'sourceScanCrop':'rules/audit/visual/leningrad-east-prussia-scan-crop-v324.png','sourceScanCropSHA256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'method':'least-squares two-dimensional affine mapping of manually reviewed original-scan cross centers to explicit engine hex pixelCenter; then independently check stars against nearest physical hex',
 'coefficientsXY':co,'markerObservations':observations,
 'crossHexes':sorted(x[0] for x in anchors),'starHexes':sorted(x[0] for x in stars),
 'priorPresentationRowShift':prior_shift,'supersedesRuntimeChanges':['v330UserSourceImageReview','v331HexNumberVerticalAlignment','v332DeploymentOverrides'],
 'previousRuntimeMarkers':old,'limitations':['Original board scan is a raster. Cross/Star centers are manually transcribed and only this southwest sector is geometrically corroborated.','Original SVG source g10/g11 instance registrations have not been promoted into scenario setup.','The full 197-versus-199-cell discrepancy remains open.','Number positions and geography outside the examined crop are not certified.']}
d['v333SourceRegistrationRepair']=record
p.write_text(json.dumps(d,indent=2)+'\n')
report=ROOT/'rules/audit/leningrad-source-affine-registration-v333.json'
report.write_text(json.dumps({k:v for k,v in record.items() if k!='previousRuntimeMarkers'},indent=2)+'\n')
print(f'Crosses {record["crossHexes"]}; stars {record["starHexes"]}; max distance {max(x["nearestDistance"] for x in observations)}')
