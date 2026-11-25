#!/usr/bin/env python3
"""Extract diagnostic rail connections from complete SVG paths, not candidate links."""
import sys,json,pathlib,hashlib
from importlib.machinery import SourceFileLoader
from fontTools.svgLib.path import parse_path
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from core.svg_hex_traversal import trace
vector=SourceFileLoader('rail_sampling_v318',str(ROOT/'tools/audit-rail-path-geometry-v318.py')).load_module()

def derive(name):
    src=ROOT/'maps'/f'{name}.json';data=json.loads(src.read_text())
    reg=data['authoredSourceVectors']['registration']; centers={c['id']:tuple(c['pixelCenter']) for c in data['cells']}
    paths={}
    if name=='kiev' and data.get('authoritativeRailPolylineGeometry'):
        # Current Kiev display uses the later definitive 24-route source SVG,
        # not the earlier 36-route temporary SVG. The v427 dedicated source
        # verifier independently checks these points against the exact XML.
        ext=json.loads((ROOT/'maps/odessa-extension.json').read_text())
        paths={r['sourceSvgId']:r['points'] for r in ext['authoritativeRailRoutes']}
    else:
        for item in data['authoredSourceVectors']['railways']:
            p=vector.SamplePen();parse_path(item['d'],p)
            paths[item['id']]=[(x*reg['scaleX']+reg['translateX'],y*reg['scaleY']+reg['translateY']) for x,y in p.points]
    # Obtain exact adjacency from the same shared function as the map renderer.
    # This excludes coincident-but-not-neighboring centers and preserves stagger.
    import subprocess
    script="""const fs=require('fs');const T=require('./core/terrain_tiles');const m=JSON.parse(fs.readFileSync(process.argv[1]));const by=new Set(m.cells.map(c=>c.id));let pairs=new Set();for(const c of m.cells)for(const dir of T.DIRS){const to=T.neighbor(c,dir,m.geometry);if(by.has(to))pairs.add([c.id,to].sort().join(':'));}process.stdout.write(JSON.stringify([...pairs].sort().map(x=>x.split(':'))));"""
    pairs=json.loads(subprocess.check_output(['node','-e',script,str(src.resolve())],cwd=ROOT,text=True))
    if name=='kiev' and data.get('authoritativeRailPolylineGeometry'):
        # Definitive Kiev rail geometry must use the finite hexsides from the
        # shared renderer. Unbounded Voronoi rays invent off-face crossings.
        module=SourceFileLoader('finite_kiev_v427',str(ROOT/'tools/rebuild-kiev-rails-v427.py')).load_module()
        result0=module.finite_crossings(paths,module.grid(data),centers,strict=True)
        result={'crossings':result0['crossings'],
                'adjacencyPairs':[key.split(':') for key in sorted(result0['links'])],
                'ambiguous':result0['ambiguous'],'sideCount':len(module.grid(data)['segments'])}
    else:
        result=trace(paths,centers,pairs)
    derived={tuple(p) for p in result['adjacencyPairs']}
    original={tuple(sorted((c['from'],c['to']))) for c in data['hexCenterRailConnections']}
    result.update({'map':name,'sourceMapSha256':hashlib.sha256(src.read_bytes()).hexdigest(),
      'svgPathCount':len(paths),'cellCount':len(centers),'geometricNeighborPairs':len(pairs),
      'candidateCount':len(original),'derivedCount':len(derived),
      'candidateNotDerived':[list(x) for x in sorted(original-derived)],
      'derivedNotCandidate':[list(x) for x in sorted(derived-original)],
      'status':'diagnostic-only-not-gameplay-certified',
      'limitations':['SVG curves are approximated by the existing 20-step curve sampler; crossings close to hex corners require review.',
       'Geometric railway crossings do not establish permitted rail movement or terrain classification.',
       'Hex centers and SVG registration are inherited from the approved map configuration.']})
    return result

if __name__=='__main__':
    result={'schemaVersion':1,'maps':{n:derive(n) for n in ('arduous','kiev')}}
    if '--write' in sys.argv:
        p=ROOT/'rules/audit/arduous-kiev-svg-first-rail-graph-v318.json';p.write_text(json.dumps(result,indent=2)+'\n');print('Wrote',p)
    for n,v in result['maps'].items():print(n,{k:v[k] for k in ('svgPathCount','geometricNeighborPairs','derivedCount','candidateCount')},'missing',len(v['candidateNotDerived']),'extra',len(v['derivedNotCandidate']),'ambiguous',len(v['ambiguous']))
