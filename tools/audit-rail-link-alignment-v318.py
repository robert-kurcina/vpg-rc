#!/usr/bin/env python3
"""Non-authorizing, source-registered rail-link geometry diagnostics.

Uses previously recorded SVG-to-engine transforms and the actual authored path data.
No candidate is promoted to executable railway movement by this audit.
"""
import argparse, hashlib, json, math, pathlib, sys
from collections import Counter
from fontTools.svgLib.path import parse_path
from importlib.machinery import SourceFileLoader

ROOT = pathlib.Path(__file__).resolve().parents[1]
old = SourceFileLoader('rail_path_audit', str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()

def distance_to_segments(p, points):
    best=float('inf')
    for a,b in zip(points,points[1:]):
        dx=b[0]-a[0];dy=b[1]-a[1];norm=dx*dx+dy*dy
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/norm)) if norm else 0
        best=min(best,math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy))
    return best

def compute(name, map_path=None):
    path=pathlib.Path(map_path) if map_path else ROOT/'maps'/f'{name}.json'
    board=json.loads(path.read_text())
    vectors=board['authoredSourceVectors'];reg=vectors['registration'];cell={c['id']:c for c in board['cells']}
    definitive=(name=='kiev' and board.get('authoritativeRailPolylineGeometry'))
    source=({p['sourceSvgId']:p for p in board['sourceRailRoutes']} if definitive
            else {p['id']:p for p in vectors['railways']})
    measured=[];issues=[]
    for link in board['hexCenterRailConnections']:
        a=cell[link['from']]['pixelCenter'];b=cell[link['to']]['pixelCenter']
        middle=[(a[0]+b[0])/2,(a[1]+b[1])/2]
        evidence=[]
        for svg_id in link['sourceSvgIds']:
            entry=source.get(svg_id)
            if entry is None:
                issues.append({'from':link['from'],'to':link['to'],'issue':'missing-registered-path','svgId':svg_id});continue
            if definitive:
                points=entry['points']
            else:
                pen=old.SamplePen();parse_path(entry['d'],pen)
                points=[(x*reg['scaleX']+reg['translateX'],y*reg['scaleY']+reg['translateY']) for x,y in pen.points]
            if len(points)<2: raise ValueError('degenerate path '+svg_id)
            evidence.append({'svgId':svg_id,'fromDistancePx':round(distance_to_segments(a,points),3),
                'toDistancePx':round(distance_to_segments(b,points),3),
                'midpointDistancePx':round(distance_to_segments(middle,points),3)})
        if not evidence:continue
        nearest=min(evidence,key=lambda e:max(e['fromDistancePx'],e['toDistancePx'],e['midpointDistancePx']))
        measured.append({'from':link['from'],'to':link['to'],'sourceSvgIds':link['sourceSvgIds'],
            'bestReferencedPath':nearest,'allPathMeasurements':evidence,
            'status':'measured-candidate-not-gameplay-certified'})
    measured.sort(key=lambda r:(r['from'],r['to']))
    max_end=[max(x['bestReferencedPath']['fromDistancePx'],x['bestReferencedPath']['toDistancePx']) for x in measured]
    mid=[x['bestReferencedPath']['midpointDistancePx'] for x in measured]
    def count_gt(vals,threshold):return sum(v>threshold for v in vals)
    return {'map':name,'sourceMapSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
      'referenceSvgSha256':(board['standaloneKievRailGeometryAudit']['sourceSvgSha256'] if definitive else vectors.get('sourceSvgSha256')),
      'registration':reg,'totalCandidateLinks':len(board['hexCenterRailConnections']),
      'measuredLinks':len(measured),'issues':issues,
      'diagnostics':{'maximumEndpointDistancePx':round(max(max_end,default=0),3),
      'maximumMidpointDistancePx':round(max(mid,default=0),3),
      'endpointMaxGreaterThan10Px':count_gt(max_end,10),
      'endpointMaxGreaterThan20Px':count_gt(max_end,20),
      'midpointGreaterThan10Px':count_gt(mid,10),
      'midpointGreaterThan20Px':count_gt(mid,20)},
      'candidates':measured,
      'limitations':['The affine registration was previously derived from authored SVG/board alignment; it is reused, not independently recertified.',
      'Center proximity alone cannot prove uninterrupted rail traversal through the hexside or junction identity.',
      'All candidate rail links remain unapproved for executable movement.']}

def main():
    p=argparse.ArgumentParser();p.add_argument('--write',action='store_true');p.add_argument('--map',choices=['arduous','kiev']);p.add_argument('--fixture-map');args=p.parse_args()
    names=[args.map] if args.map else ['arduous','kiev']
    data={'schemaVersion':1,'type':'rail-svg-candidate-alignment-non-authorizing',
          'maps':{n:compute(n,args.fixture_map if args.map else None) for n in names}}
    if args.write and not args.fixture_map:
        target=ROOT/'rules/audit/arduous-kiev-rail-link-alignment-v318.json'
        target.write_text(json.dumps(data,indent=2)+'\n')
        print('Wrote',target.relative_to(ROOT))
    print(json.dumps({n:{k:v for k,v in x.items() if k in ('totalCandidateLinks','measuredLinks','issues','diagnostics')} for n,x in data['maps'].items()},indent=2))
    return 1 if any(x['issues'] or x['measuredLinks']!=x['totalCandidateLinks'] for x in data['maps'].values()) else 0
if __name__=='__main__':sys.exit(main())
