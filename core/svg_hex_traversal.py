"""Source-first SVG polyline to finite Voronoi hexside crossings.

Geometry only: never grants gameplay movement. Input coordinates must already be
registered to the same coordinate space as cell centers. Every source path is
traversed independently, so one SVG path can generate arbitrarily many links.
"""
from math import hypot, isfinite
from shapely.geometry import LineString, Point

EPS=1e-8

def shared_side(centers, a, b):
    """Finite Voronoi boundary between neighboring hex centers (not infinite bisector).

    Returns two endpoints or None when centers do not share a side.
    Infinite outer-map rays are capped at 1.5 center-to-center distances,
    and flagged separately by the caller; no candidate is automatically authorized.
    """
    ax,ay=centers[a];bx,by=centers[b]
    vx,vy=bx-ax,by-ay; distance=hypot(vx,vy)
    if distance<EPS: return None
    mid=((ax+bx)/2,(ay+by)/2); nx,ny=-vy/distance,vx/distance
    lo,hi=-1.5*distance,1.5*distance
    for k,(cx,cy) in centers.items():
        if k in (a,b):continue
        dx,dy=cx-ax,cy-ay
        coef=2*(nx*dx+ny*dy)
        rhs=cx*cx+cy*cy-ax*ax-ay*ay-2*(mid[0]*dx+mid[1]*dy)
        if abs(coef)<EPS:
            if rhs < -1e-6:return None
            continue
        bound=rhs/coef
        if coef>0:hi=min(hi,bound)
        else:lo=max(lo,bound)
        if hi-lo<EPS:return None
    return ((mid[0]+lo*nx,mid[1]+lo*ny),(mid[0]+hi*nx,mid[1]+hi*ny))

def _segment_intersections(path,side):
    p=LineString(path);s=LineString(side)
    geom=p.intersection(s)
    if geom.is_empty:return [],False
    if geom.geom_type in ('LineString','MultiLineString'):
        return [],True  # along-boundary geometry needs explicit interpretation
    if geom.geom_type=='Point':return [(geom.x,geom.y)],False
    if geom.geom_type=='MultiPoint':return [(v.x,v.y) for v in geom.geoms],False
    return [],True

def trace(paths, centers, allowed_pairs, endpoint_tolerance=0.35):
    """Return one record per geometric crossing and a distinct adjacency registry.

    allowed_pairs: geometric neighbor pairs from the existing grid, NOT railroad
    candidates. Near vertices/endpoints are marked ambiguous rather than certified.
    """
    sides={}
    for a,b in allowed_pairs:
        if a not in centers or b not in centers:raise ValueError('unknown hex ID')
        key=tuple(sorted((a,b)))
        side=shared_side(centers,*key)
        if side:sides[key]=side
    records=[];ambiguous=[]
    for path_id,pts in sorted(paths.items()):
        if len(pts)<2:continue
        if not all(isfinite(n) for p in pts for n in p):raise ValueError('nonfinite geometry')
        path_line=LineString(pts)
        if path_line.length<EPS:continue
        for (a,b),side in sides.items():
            hits,overlap=_segment_intersections(pts,side)
            if overlap:
                ambiguous.append({'sourceSvgId':path_id,'hexPair':[a,b],'reason':'runs-along-hexside'})
                continue
            for x,y in hits:
                pos=path_line.project(Point(x,y));side_len=hypot(side[1][0]-side[0][0],side[1][1]-side[0][1]);
                endpoint_distance=min(hypot(x-e[0],y-e[1]) for e in side)
                # Cross-boundary rather than merely touch: sample on either side of hit
                delta=min(max(path_line.length*0.0001,0.08),0.4)
                before=path_line.interpolate(max(0,pos-delta));after=path_line.interpolate(min(path_line.length,pos+delta))
                ax,ay=centers[a];bx,by=centers[b]
                def signed(pt):return (pt.x-(ax+bx)/2)*(bx-ax)+(pt.y-(ay+by)/2)*(by-ay)
                s0,s1=signed(before),signed(after)
                if endpoint_distance<=endpoint_tolerance:reason='near-hex-vertex'
                elif pos<=delta or pos>=path_line.length-delta:reason='path-endpoint-on-boundary'
                elif s0*s1>=-1e-4:reason='touch-without-crossing'
                elif side_len<EPS:reason='degenerate-side'
                else:reason=None
                rec={'sourceSvgId':path_id,'hexPair':[a,b],'intersection':[round(x,3),round(y,3)],'pathDistance':round(pos,3)}
                if reason:ambiguous.append({**rec,'reason':reason})
                else:records.append(rec)
    # prevent duplicate intersection from same source path/side in short overlaps
    records.sort(key=lambda r:(r['sourceSvgId'],r['pathDistance'],r['hexPair']))
    pairs={tuple(r['hexPair']) for r in records}
    return {'crossings':records,'adjacencyPairs':[list(p) for p in sorted(pairs)],'ambiguous':ambiguous,'sideCount':len(sides)}
