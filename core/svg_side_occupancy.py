"""Classify source SVG vector relationships to finite, canonical hexsides.

No gameplay interpretation: proximity, crossing and longitudinal coverage are
separate measurements. A path may cover multiple sides, and an edge is
represented once with two optional reciprocal hex-side members.
"""
from math import hypot, isfinite
from shapely.geometry import LineString, Point


def evaluate(path_points, start, end, corridor_px=3.0, fraction_required=0.55):
    if not (0 < fraction_required <= 1) or corridor_px <= 0:
        raise ValueError('invalid side occupancy parameters')
    if len(path_points) < 2 or not all(isfinite(v) for pt in path_points for v in pt):
        raise ValueError('invalid source path')
    side=LineString((start,end));path=LineString(path_points)
    if side.length < 1e-7 or path.length < 1e-7:
        raise ValueError('degenerate geometry')
    # A tube around the *finite* hexside, not its unbounded supporting line.
    near=path.intersection(side.buffer(corridor_px,cap_style=2,join_style=2))
    coverage_length=near.length
    coverage_ratio=coverage_length/side.length
    # A long diagonal path may pass through a side tube. Require a meaningful
    # projection span on the side as well as the nearby length.
    coords=[]
    def collect(g):
        if g.is_empty:return
        if g.geom_type=='LineString':coords.extend([g.coords[0],g.coords[-1]])
        elif hasattr(g,'geoms'):
            for item in g.geoms:collect(item)
    collect(near)
    span=0.0
    if coords:
        vals=[side.project(Point(p)) for p in coords]
        span=(max(vals)-min(vals))/side.length
    direct=path.intersection(side)
    if not direct.is_empty and direct.geom_type in ('Point','MultiPoint'):
        topology='crosses-or-touches'
    elif not direct.is_empty:
        topology='overlaps-exact-side'
    else:
        topology='near-side' if near.length else 'separated'
    # A path that runs along a side might be offset slightly by the authored pen.
    # Measurement is not proof of user intent; label as a plausible side trace.
    if span >= fraction_required and coverage_ratio >= fraction_required:
        relation='side-follow-candidate'
    elif topology=='crosses-or-touches':
        relation='point-crossing-or-touch'
    elif coverage_length>0:
        relation='short-near-side'
    else:
        relation='not-near-side'
    return {'relation':relation,'intersectionTopology':topology,
            'nearbyLengthPx':round(coverage_length,3),'sideLengthPx':round(side.length,3),
            'nearbyToSideLengthRatio':round(coverage_ratio,3),
            'sideProjectionFraction':round(span,3),
            'minimumDistancePx':round(path.distance(side),3),
            'midpointDistancePx':round(path.distance(side.interpolate(.5,normalized=True)),3),
            'corridorPx':corridor_px}
