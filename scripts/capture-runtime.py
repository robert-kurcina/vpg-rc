#!/usr/bin/env python3
"""Run the actual JS map renderer in Chromium and verify against Node exports.

No HTTP, external assets, image synthesis, or screenshot-to-map conversion.
Requires the installed Python playwright package and a Chromium binary.
"""
from __future__ import annotations
import base64
import hashlib
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'browser-captures'
OUT.mkdir(exist_ok=True)
registry = json.loads((ROOT/'maps/registry.json').read_text())
assets = {}
for kind in ['open','forest','woods','swamp','hills','mountain','rough']:
    file = ROOT/f'supplied_assets/flat/terrain-{kind}.png'
    assets[kind] = f'data:image/png;base64,{base64.b64encode(file.read_bytes()).decode()}'
fortification = 'data:image/svg+xml;base64,' + base64.b64encode((ROOT/'supplied_assets/flat/fortification-overlay.svg').read_bytes()).decode()
city_art = 'data:image/svg+xml;base64,' + base64.b64encode((ROOT/'supplied_assets/flat/city-hex-highlight.svg').read_bytes()).decode()
base_maps = {item['id']:json.loads((ROOT/'maps'/item['file']).read_text()) for item in registry['maps'] if item.get('file')}
extension = json.loads((ROOT/'maps/odessa-extension.json').read_text())
reference = {}
for item in registry['maps']:
    name = item.get('sourceImage')
    if name:
        file=ROOT/'maps/source'/name
        mime = 'image/webp' if name.endswith('webp') else 'image/jpeg'
        reference[item['id']] = f'data:{mime};base64,{base64.b64encode(file.read_bytes()).decode()}'

def inline_script(text):
    return '<script>\n' + text.replace('</script', '<\\/script') + '\n</script>\n'

js_sources = ''.join(inline_script((ROOT/'core'/f).read_text()) for f in ('factions.js','terrain_tiles.js','presentation.js'))
js_sources += inline_script((ROOT/'maps/composer.js').read_text())
state = {'items':registry['maps'],'base':base_maps,'extension':extension,'textures':assets,'fort':fortification,'cityArt':city_art,'refs':reference}
json_state = json.dumps(state,ensure_ascii=False).replace('</','<\\/')
script = r'''
const SOURCE = __DATA__;
const boards = {...SOURCE.base};
for (const item of SOURCE.items) {
  if (item.compose) boards[item.id] = WargameMapComposer.compose(boards[item.compose.base], SOURCE.extension);
}
const $ = id => document.getElementById(id);
const inputEntries = [['grid','hex-grid'],['numbers','coordinates'],['water','water-bodies'],['rivers','rivers'],['railways','railways'],['entries','entry-edges'],['deploy','deployment']];
const select = $('maps');
for (const item of SOURCE.items) {
  const o = document.createElement('option'); o.value=item.id; o.textContent=item.title; select.add(o);
}
window.rawEngineSVG = null;
function render() {
 const id=select.value;
 const item=SOURCE.items.find(x=>x.id===id),board=boards[id];
 if(!board)throw Error('Missing map '+id);
 const moscow=id==='battle-for-moscow';
 const opts=WargamePresentation.options(id,{
  id:'export-'+id,textures:SOURCE.textures,
  width:item.width,height:item.height,padding:item.padding,majorCityLabels:item.majorCityLabels,
  showGrid:true,showNumbers:true,showWaterBodies:true,showEntryEdges:true,
  showOriginalRailTrace:$('raw-rails-toggle').checked,
  showSourceReinforcementAudit:$('source-borders-toggle').checked,
  showSourceCoastAudit:$('source-coast-toggle').checked,
  ...(moscow?{rx:57.275,ry:101.9/Math.sqrt(3),gridStrokeWidth:1.8,
   fortificationArtwork:SOURCE.fort,fortificationAlpha:.5,riverWidthScale:2,
   riverWaveAmplitude:2.35,riverWaveLength:23,riverTerminalWidthRatio:.42,
   cityHexArtwork:SOURCE.cityArt}:{}),
 });
 // Same source engine function invoked by the CLI exporter and map viewer.
 window.rawEngineSVG=HexTerrainTiles.svgMap(board,opts);
 $('map-host').innerHTML=window.rawEngineSVG;
 const svg=document.querySelector('#map-host svg');
 svg.style.width='100%'; svg.style.height='auto';
 for(const [input,layer] of inputEntries) {
  for(const el of svg.querySelectorAll('[data-layer="'+layer+'"]'))
   el.style.display = $(input).checked?'inline':'none';
 }
 for(const layer of ['cities','city-hex-highlights','city-labels'])
  for(const el of svg.querySelectorAll('[data-layer="'+layer+'"]'))
   el.style.display = $('cities').checked?'inline':'none';
 $('stats').textContent=board.cells.length+' engine hexes | '+svg.querySelectorAll('[data-hex-id]').length+' rendered tile groups | '+svg.querySelectorAll('[data-layer]').length+' layers';
 $('status').textContent=id==='kiev-odessa'
  ?'SOURCE-BASED VISUAL: Odessa extends Kiev. Original SVG railway paths and procedural coast/lake wavelets are rendered; city and coast registration remain provisional.'
  :id==='battle-for-moscow'?'Playable Moscow visual map adapter.':'Procedural Coast/Lake map. Terrain and route accuracy remain provisional.';
 $('source-panel').hidden=!$('source-toggle').checked || !SOURCE.refs[id];
 if(SOURCE.refs[id])$('source-panel').querySelector('img').src=SOURCE.refs[id];
 $('save').href='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(window.rawEngineSVG);
 $('save').download=id+'.engine.svg';
 return window.rawEngineSVG;
}
select.addEventListener('change',render);
for(const el of document.querySelectorAll('input[type="checkbox"]')) el.addEventListener('change',render);
$('save').addEventListener('click',()=>{});
window.chooseMap=id=>{select.value=id;return render();};
window.engineReady = true;
select.value='battle-for-moscow';render();
'''.replace('__DATA__',json_state)
html = r'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Hex Campaigns v2.86 — live game engine renderer</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#e8ece9;color:#192c31;font:15px/1.4 system-ui,Arial,sans-serif}header{background:#172a36;color:#fff;padding:16px 24px 13px}h1{margin:0;font-size:22px;font-weight:650}header p{margin:5px 0;color:#c4d2d7;font-size:12px}.controls{background:#fff;border-bottom:1px solid #c9d1d3;display:flex;align-items:center;flex-wrap:wrap;gap:13px;padding:12px 20px;font-size:13px}.controls select{font:inherit;padding:4px 7px;border:1px solid #abb9b9;border-radius:4px;background:#fff;max-width:300px}.controls label{white-space:nowrap}.viewer{display:flex;align-items:flex-start;justify-content:center;gap:12px;padding:14px 18px}.map-panel{background:#fff;border:1px solid #bcc8ca;flex:1 1 970px;max-width:1600px;padding:10px}.map-panel svg{width:100%;height:auto;display:block}.meta{display:flex;justify-content:space-between;align-items:center;gap:15px;font-size:12px;margin:4px 7px 10px;color:#526067}.note{font-size:12px;padding:7px 8px;margin-top:8px;border-top:1px solid #d4d9da}.ref{flex:0 0 410px;background:#fff;padding:12px;border:1px solid #bbc7c8}.ref img{width:100%}.ref h2{font-size:15px;margin:2px 0 8px}a{color:#315779}header .chip{color:#fff;border:1px solid #77939c;border-radius:4px;margin-left:8px;font-size:12px;padding:2px 6px}
</style></head><body><header><h1>Campaign maps <span class="chip">JavaScript game-engine renderer</span> <span class="chip">v2.86</span></h1><p>Actual HexTerrainTiles.svgMap output · deterministic local map data, original supplied flat-top tiles · no generated imagery</p></header>
<div class="controls"><label>Campaign <select id="maps"></select></label><label><input id="grid" type="checkbox" checked> Grid</label><label><input id="numbers" type="checkbox" checked> Numbers</label><label><input id="water" type="checkbox" checked> Water</label><label><input id="rivers" type="checkbox" checked> Rivers</label><label><input id="railways" type="checkbox" checked> Rail</label><label><input id="raw-rails-toggle" type="checkbox"> Source rail audit</label><label><input id="source-borders-toggle" type="checkbox"> Raw reinforcements</label><label><input id="source-coast-toggle" type="checkbox"> Authored coast paths</label><label><input id="entries" type="checkbox" checked> Reinforcements</label><label><input id="deploy" type="checkbox" checked> Deployment</label><label><input id="cities" type="checkbox" checked> Cities</label><label><input id="source-toggle" type="checkbox"> Compare scan</label></div>
<div class="viewer"><main class="map-panel"><div class="meta"><span id="stats"></span><a href="#" id="save">Save generated SVG</a></div><div id="map-host"></div><div class="note" id="status"></div></main><aside id="source-panel" class="ref" hidden><h2>Published map scan — comparison only</h2><img alt="Source scan; not engine generated"></aside></div>
''' + js_sources + inline_script(script) + '</body></html>'
(ROOT/'exports/offline-engine-viewer.html').write_text(html,encoding='utf8')

hashes=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    page=browser.new_page(viewport={'width':1850,'height':1750},device_scale_factor=1)
    problems=[]
    page.on('pageerror', lambda error: problems.append(str(error)))
    page.set_content(html,wait_until='load',timeout=60000)
    assert page.evaluate('window.engineReady===true'), problems
    for item in registry['maps']:
        id=item['id']
        page.evaluate('(id)=>window.chooseMap(id)',id)
        # Capture *before* modifying layers for audit; no loading external files.
        exact_svg=page.evaluate('window.rawEngineSVG')
        exported=(ROOT/'exports'/f'{id}.svg').read_text()
        assert exact_svg == exported, f'Browser/Node renderer mismatch in {id}: {len(exact_svg)} vs {len(exported)}'
        count = page.locator('#map-host [data-hex-id]').count()
        assert count == (len(base_maps[id]['cells']) if id in base_maps else len(base_maps['kiev']['cells']) + len(extension['cells'])), (id,count)
        page.wait_for_timeout(250)
        # Screenshot actual DOM-engine output, not a previously saved SVG or PNG.
        page.locator('#map-host > svg').screenshot(path=str(OUT/f'{id}-runtime.png'),timeout=60000)
        if id == 'kiev-odessa':
            # Regression for the Chromium <use>/clipPath bug in v2.58: SVG text
            # matched Node, but interiors of several forest hexes were flat.
            from PIL import Image, ImageStat
            snapshot=Image.open(OUT/f'{id}-runtime.png').convert('RGB')
            testhexes=['1012','1013','1113']
            forest_centers={c['id']:c['pixelCenter'] for c in extension['cells']}
            variances=[]
            for hexid in testhexes:
                cx,cy=forest_centers[hexid]
                sx=(cx+item['padding'])*snapshot.width/(item['width']+2*item['padding'])
                sy=(cy+item['padding'])*snapshot.height/(item['height']+2*item['padding'])
                area=snapshot.crop((round(sx)-12,round(sy)-12,round(sx)+12,round(sy)+12))
                variances.append(ImageStat.Stat(area).stddev[1])
            assert min(variances)>18, f'Browser forest tiles flattened by clipping: {variances}'
        page.screenshot(path=str(OUT/f'{id}-viewer.png'),full_page=True,timeout=60000)
        if id=='kiev-odessa':
            page.locator('#source-toggle').check()
            page.screenshot(path=str(OUT/f'{id}-source-comparison.png'),full_page=True,timeout=60000)
            page.locator('#source-toggle').uncheck()
            page.locator('#raw-rails-toggle').check()
            page.locator('#source-borders-toggle').check()
            page.screenshot(path=str(OUT/f'{id}-vector-audit.png'),full_page=True,timeout=60000)
            page.locator('#raw-rails-toggle').uncheck()
            page.locator('#source-borders-toggle').uncheck()
            page.locator('#source-coast-toggle').check()
            page.locator('#map-host > svg').screenshot(path=str(OUT/f'{id}-coast-svg-audit.png'),timeout=60000)
            page.locator('#source-coast-toggle').uncheck()
        data={
           'id':id,'mapSource':item.get('file') or 'kiev.json + odessa-extension.json',
           'rawEngineSvgSha256':hashlib.sha256(exact_svg.encode()).hexdigest(),
           'matchesNodeExportByteForByte':True,
           'runtimeSvgHexGroups':count,
           'runtimeSvgLayerGroups':page.locator('#map-host svg [data-layer]').count(),
           'runtimeCapture':f'browser-captures/{id}-runtime.png',
           'viewerCapture':f'browser-captures/{id}-viewer.png',
        }
        hashes.append(data)
        print(id, 'MATCHED',len(exact_svg),'bytes',count,'hexes',flush=True)
    if problems:raise AssertionError('Chromium script errors: '+repr(problems))
    browser.close()
(ROOT/'browser-captures/verification-manifest.json').write_text(json.dumps(hashes,indent=2)+'\n')
print('Verified all five campaigns independently via browser-side execution of the game engine.',flush=True)
