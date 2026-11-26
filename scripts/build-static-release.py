#!/usr/bin/env python3
"""Stage a private, repository-relative static release candidate (not publication).
Source redistribution permission remains required; rerun browser acceptance for changed releases.
"""
import argparse, hashlib, json, shutil, re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote, quote
from xml.etree import ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
ROUTES={"battle-for-moscow":"games/battle-for-moscow/native-preview", "arduous":"games/arduous/native-preview", "leningrad":"games/leningrad/native-preview", "kiev":"games/kiev/setup-preview", "kiev-odessa":"games/kiev-odessa/experimental-preview"}

def build(out):
    out=out.resolve()
    if out.exists() or out.is_relative_to(ROOT): raise ValueError('Output must be a new directory outside the source tree')
    out.mkdir(parents=True)
    def copy(rel):
        src=(ROOT/rel).resolve(); assert src.is_relative_to(ROOT) and src.is_file(), rel
        dst=out/src.relative_to(ROOT); dst.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(src,dst)
    def tree(rel, suffixes=None):
        for f in sorted((ROOT/rel).rglob('*')):
            if f.is_file() and (suffixes is None or f.suffix in suffixes): copy(f.relative_to(ROOT))
    def relative(base, value):
        p=(ROOT/base/unquote(value)).resolve(); assert p.is_relative_to(ROOT),value
        return p.relative_to(ROOT)
    copy('index.html'); tree('core',{'.js','.css'}); tree('supplied_assets/flat'); tree('assets/map-symbols'); tree('assets/support-counters'); tree('assets/terrain-chart'); tree('references/rules'); tree('exports')
    copy('maps/index.html'); copy('maps/composer.js'); copy('maps/registry.json'); copy('tools/terrain-effects-chart/index.html'); copy('maps/presentation/kiev-terrain-effects.json')
    for route in ROUTES.values():
        tree(route,{'.html','.css','.json'})
        config=json.loads((ROOT/route/'config.json').read_text())
        for key,value in config.items():
            if isinstance(value,str) and value.endswith(('.json','.svg')): copy(relative(route,value))
    for name in ['index.html','game.json','map.json','units.json','deployments.json','rules.json','objectives.json']:copy('games/battle-for-moscow/'+name)
    for item in json.loads((ROOT/'maps/registry.json').read_text())['maps']:
        for k in ['file','counterConfig']:
            if item.get(k):copy('maps/'+item[k])
        if item.get('compose'):copy('maps/'+item['compose']['extension'])
        if item.get('sourceImage'):copy('maps/source/'+item['sourceImage'])
        for k in ['fortificationArtwork','cityHexArtwork']:
            if item.get('renderOptions',{}).get(k):copy(item['renderOptions'][k])
    # No development-only routes in the staged website. Source project unchanged.
    p=out/'index.html'; p.write_text(re.sub(r'<footer><a href="mechanics-lab.html">.*?</a></footer>','',p.read_text()))
    for scenario in ['kiev','kiev-odessa']:
        p=out/ROUTES[scenario]/'index.html'; p.write_text(re.sub(r'<a href="../../../tools/(?:territory-review|movement-review)/index.html">.*?</a>','',p.read_text()))
    (out/'.nojekyll').touch()
    return verify(out)

class Links(HTMLParser):
    def __init__(self):super().__init__();self.refs=[];self.ids=set()
    def handle_starttag(self,tag,attrs):
        for k,v in attrs:
            if k=='id' and v:self.ids.add(v)
            if k in {'src','href','data-historical-config','data-native-map','data-native-registry','data-native-profile','data-native-ai-profile','data-native-ai-objective-profile','data-native-ai-capture-profile','data-native-ui-profile'} and v:self.refs.append(v)

def verify(out):
    out=out.resolve(); counts={'htmlReferences':0,'configReferences':0,'chartSpecimens':0,'registryReferences':0,'selfContainedMapExports':0}
    def check(base,value,category):
        url=urlsplit(value)
        if url.scheme or url.netloc: return
        assert not url.path.startswith('/'), (base,value,'absolute path is not repository-relative')
        target=(base.parent/unquote(url.path)).resolve() if url.path else base
        assert target.is_relative_to(out) and target.is_file(),(base,value)
        if url.fragment and target.suffix=='.html':
            parser=Links();parser.feed(target.read_text());assert unquote(url.fragment) in parser.ids,(base,value,'missing anchor')
        counts[category]+=1
    for p in sorted(out.rglob('*.html')):
        parser=Links();parser.feed(p.read_text())
        for v in parser.refs:check(p,v,'htmlReferences')
    for route in ROUTES.values():
        p=out/route/'config.json'
        for value in json.loads(p.read_text()).values():
            if isinstance(value,str) and value.endswith(('.json','.svg')):check(p,value,'configReferences')
    p=out/'maps/registry.json'
    for item in json.loads(p.read_text())['maps']:
        for key in ['file','counterConfig']:
            if item.get(key):check(p,item[key],'registryReferences')
        if item.get('compose'):check(p,item['compose']['extension'],'registryReferences')
        if item.get('sourceImage'):check(p,'source/'+item['sourceImage'],'registryReferences')
        for key in ['fortificationArtwork','cityHexArtwork']:
            if item.get('renderOptions',{}).get(key):check(p,'../'+item['renderOptions'][key],'registryReferences')
    p=out/'maps/presentation/kiev-terrain-effects.json'
    for row in json.loads(p.read_text())['rows']:check(p,'../../assets/terrain-chart/'+row.get('sampleMap','kiev')+'/'+row['id']+'.png','chartSpecimens')
    for scenario,route in ROUTES.items():
        assert (out/route/'index.html').is_file(),scenario
        for suffix in ['svg','png']:assert (out/'exports'/f'{scenario}.{suffix}').is_file(),scenario
        export=out/'exports'/f'{scenario}.svg'
        for _,element in ET.iterparse(export,events=('end',)):
            for key,value in element.attrib.items():
                if key.rsplit('}',1)[-1]=='href':assert value.startswith(('#','data:')),(export,value[:80],'external SVG reference')
            element.clear()
        counts['selfContainedMapExports']+=1
    assert not any((out/x).exists() for x in ['tests','rules/audit','provenance','mechanics-lab.html','legacy','scripts','tools/movement-review','tools/territory-review'])
    return counts

def hashes(out):
    return {str(f.relative_to(out)):hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(out.rglob('*')) if f.is_file() and f!=out/'STATIC_MANIFEST.json'}

def verify_manifest(out):
    m=json.loads((out/'STATIC_MANIFEST.json').read_text())
    assert hashes(out)==m['files'],'Static release file manifest mismatch'
    assert verify(out)==m['checks'],'Static release reference checks mismatch'
    return m

def http_check(out):
    # Test actual HTTP at a non-root path, not a browser/storage substitute.
    import tempfile,threading,functools,http.server,urllib.request
    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args):pass
    with tempfile.TemporaryDirectory() as temp:
        (Path(temp)/'russian-campaign').symlink_to(out.resolve(),target_is_directory=True)
        server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=temp))
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            url=f'http://127.0.0.1:{server.server_port}/russian-campaign/'
            files=[str(f.relative_to(out)) for f in out.rglob('*') if f.is_file()]
            for name in files:
                with urllib.request.urlopen(urllib.request.Request(url+quote(name),method='HEAD'),timeout=10) as response:
                    assert response.status==200,name
            return len(files)
        finally:server.shutdown();thread.join();server.server_close()

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('out',type=Path);p.add_argument('--verify',action='store_true');p.add_argument('--http',action='store_true');a=p.parse_args()
    a.out=a.out.resolve()
    if a.verify:
        m=verify_manifest(a.out);report={'files':len(m['files']),**m['checks']}
        if a.http:report['httpFiles']=http_check(a.out)
        print(json.dumps(report));raise SystemExit
    counts=build(a.out)
    manifest={'sourceVersion':json.loads((ROOT/'PACKAGE_MANIFEST.json').read_text())['version'],'routes':ROUTES,'checks':counts,'publicationStatus':'private candidate; redistribution rights and publication authorization outstanding','files':hashes(a.out)}
    (a.out/'STATIC_MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n');report={'files':len(manifest['files']),**counts}
    if a.http:report['httpFiles']=http_check(a.out)
    print(json.dumps(report))
