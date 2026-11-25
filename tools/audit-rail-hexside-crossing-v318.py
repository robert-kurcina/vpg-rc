#!/usr/bin/env python3
"""Diagnose whether registered SVG railway polylines cross candidate hex bisectors.

This is geometric evidence only, not authorization to use a railway for movement.
"""
import argparse, hashlib, json, math, pathlib, sys
from importlib.machinery import SourceFileLoader
from fontTools.svgLib.path import parse_path

ROOT=pathlib.Path(__file__).resolve().parents[1]
vector=SourceFileLoader('rail_geometry_for_crossings',str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()

def crossings(points,a,b):
    """Intersect each sampled path segment with the perpendicular bisector AB.

    Signed scalar dot(P-midpoint, B-A) changes sign at the shared bisector.
    The signed lateral offset is measured along the hexside (normal to AB).
    """
    dx=b[0]-a[0];dy=b[1]-a[1]; length=math.hypot(dx,dy)
    if not length: raise ValueError('same point centers')
    mid=((a[0]+b[0])/2,(a[1]+b[1])/2)
    out=[]
    for p,q in zip(points,points[1:]):
        s=(p[0]-mid[0])*dx+(p[1]-mid[1])*dy
        t=(q[0]-mid[0])*dx+(q[1]-mid[1])*dy
        if (s<0 and t<0) or (s>0 and t>0):continue
        if abs(s-t)<1e-10:continue
        ratio=s/(s-t)
        if not -1e-8<=ratio<=1+1e-8:continue
        x=p[0]+ratio*(q[0]-p[0]);y=p[1]+ratio*(q[1]-p[1])
        offset=((x-mid[0])*(-dy)+(y-mid[1])*dx)/length
        candidate={'intersection':[round(x,3),round(y,3)],'offsetPx':round(offset,3),'absoluteOffsetPx':round(abs(offset),3)}
        if not out or all(math.dist(candidate['intersection'],prev['intersection'])>0.05 for prev in out):out.append(candidate)
    return sorted(out,key=lambda x:x['absoluteOffsetPx'])

def compute(name):
    path=ROOT/'maps'/f'{name}.json';mapdata=json.loads(path.read_text()); vec=mapdata['authoredSourceVectors'];reg=vec['registration']
    cells={x['id']:x for x in mapdata['cells']}
    if name=='kiev' and mapdata.get('authoritativeRailPolylineGeometry'):
        sample_cache={p['sourceSvgId']:p['points'] for p in mapdata['sourceRailRoutes']}
    else:
        paths={x['id']:x['d'] for x in vec['railways']}
        sample_cache={}
        for key,d in paths.items():
            pen=vector.SamplePen();parse_path(d,pen)
            sample_cache[key]=[(x*reg['scaleX']+reg['translateX'],y*reg['scaleY']+reg['translateY']) for x,y in pen.points]
    records=[]
    for link in mapdata['hexCenterRailConnections']:
        a=cells[link['from']]['pixelCenter'];b=cells[link['to']]['pixelCenter']
        hits=[]
        for source_id in link['sourceSvgIds']:
            if source_id not in sample_cache:raise ValueError('missing svg path '+source_id)
            for hit in crossings(sample_cache[source_id],a,b):hits.append({'svgId':source_id,**hit})
        hits.sort(key=lambda x:x['absoluteOffsetPx'])
        records.append({'from':link['from'],'to':link['to'],'sourceSvgIds':link['sourceSvgIds'],
                        'crossesInfiniteBisector':bool(hits),'nearestCrossing':hits[0] if hits else None,
                        'crossingCount':len(hits),
                        'halfHexsidePx':round(math.dist(a,b)/(2*math.sqrt(3)),3),
                        'finiteHexsideAssessment':('no-crossing' if not hits else
                          'on-segment' if hits[0]['absoluteOffsetPx']<=math.dist(a,b)/(2*math.sqrt(3)) else
                          'borderline' if hits[0]['absoluteOffsetPx']<=math.dist(a,b)/(2*math.sqrt(3))+2 else
                          'outside-segment'),
                        'status':'geometry-only-not-gameplay-certified'})
    records.sort(key=lambda r:(r['from'],r['to']))
    return {'sourceMapSha256':hashlib.sha256(path.read_bytes()).hexdigest(), 'candidateCount':len(records),
            'bisectorCrossings':sum(x['crossesInfiniteBisector'] for x in records),
            'finiteHexsideAssessmentCounts':{v:sum(x['finiteHexsideAssessment']==v for x in records) for v in ['on-segment','borderline','outside-segment','no-crossing']},
            'missingBisectorCrossings':[{'from':x['from'],'to':x['to']} for x in records if not x['crossesInfiniteBisector']],
            'crossingsOffsetGt10Px':[{'from':x['from'],'to':x['to'],'offsetPx':x['nearestCrossing']['absoluteOffsetPx']} for x in records if x['nearestCrossing'] and x['nearestCrossing']['absoluteOffsetPx']>10],
            'links':records,'limitations':['Finite shared hexside estimated from regular hex-center spacing: half-length = centerDistance / (2*sqrt(3)); this geometric approximation is not independent cartographic certification.',
              'Polyline sampling can miss very short curves or tangencies.',
              'Multiple crossings or nearby rail junctions require contextual interpretation.',
              'No railway is promoted to executable movement by this diagnostic.']}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--write',action='store_true');arg=parser.parse_args()
    result={'schemaVersion':1,'type':'rail-bisector-crossing-diagnostic','maps':{key:compute(key) for key in ['arduous','kiev']}}
    if arg.write:
        dest=ROOT/'rules/audit/arduous-kiev-rail-hexside-crossings-v318.json';dest.write_text(json.dumps(result,indent=2)+'\n')
        print('Wrote',dest.relative_to(ROOT))
    print(json.dumps({k:{'candidateCount':v['candidateCount'],'bisectorCrossings':v['bisectorCrossings'],
               'missingBisectorCrossings':len(v['missingBisectorCrossings']), 'finiteHexsideAssessmentCounts':v['finiteHexsideAssessmentCounts'],'crossingsOffsetGt10Px':len(v['crossingsOffsetGt10Px'])} for k,v in result['maps'].items()},indent=2))
if __name__=='__main__':main()
