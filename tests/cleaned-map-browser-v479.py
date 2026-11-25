#!/usr/bin/env python3
"""Five actual shared-engine map renders in offline Chromium from extracted ZIP.

The sandbox blocks localhost navigation; this embeds the unmodified map-viewer
JavaScript, source map JSON and original bitmap bytes into one offline page.
It does not generate illustrations or bypass production movement/gameplay gates.
"""
from __future__ import annotations
import argparse
import base64
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser()
p.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1])
p.add_argument('--screenshot',type=Path,default=None)
args=p.parse_args()
root=args.root.resolve()
html=(root/'maps/index.html').read_text()
# Retain real browser app and renderer, inline its local dependencies only.
for rel in ['../core/ui.css','../core/map_touch_navigation.css']:
    css=(root/(Path('maps')/rel)).resolve().read_text()
    html=html.replace(f'<link rel="stylesheet" href="{rel}">','<style>'+css+'</style>')
for rel in ['../core/factions.js','../core/terrain_tiles.js',
            '../core/presentation.js','composer.js',
            '../core/game_display_settings.js','../core/map_touch_navigation.js']:
    js=(root/'maps'/rel).resolve().read_text().replace('</script','<\\/script')
    html=html.replace(f'<script src="{rel}"></script>','<script>'+js+'</script>')
registry=json.loads((root/'maps/registry.json').read_text())
records={'registry.json':registry}
for name in ['battle-for-moscow','arduous','leningrad','kiev','odessa-extension']:
    records[name+'.json']=json.loads((root/'maps'/(name+'.json')).read_text())
assets={f.name:'data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode('ascii')
        for f in (root/'supplied_assets/flat').glob('*.png')}
# Supply exactly the original file-backed JSON and bitmap pixels for an about:blank page.
bootstrap='''<script>
window.__mapFiles=__RECORDS__;
window.fetch=async path=>({ok:Object.hasOwn(__mapFiles,path),
  json:async()=>__mapFiles[path]});
window.__bitmapAssets=__ASSETS__;
// URL substitution for sandbox screenshot only: immutable map/palette JS is unchanged.
window.__inlineTextureReferences=()=>{
  for(const el of document.querySelectorAll('#render image')){
    const href=el.getAttribute('href')||el.getAttribute('xlink:href')||'';
    if(!href.startsWith('data:')){
      const basename=href.split('/').at(-1);
      if(Object.hasOwn(__bitmapAssets,basename))el.setAttribute('href',__bitmapAssets[basename]);
    }
  }
};
</script>'''.replace('__RECORDS__',json.dumps(records,separators=(',',':')).replace('</script','<\\/script'))
bootstrap=bootstrap.replace('__ASSETS__',json.dumps(assets,separators=(',',':')))
html=html.replace('<script>\n(async()=>',bootstrap+'<script>\n(async()=>')
assert 'window.__mapFiles=' in html
assert 'src="../core/' not in html
assert '<link rel="stylesheet"' not in html
assert '<script src="composer.js"' not in html

checks=0
def check(v,msg):
    global checks
    assert v,msg
    checks+=1

with sync_playwright() as pw:
    b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1440,'height':960})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(html,wait_until='domcontentloaded',timeout=90000)
    page.wait_for_function("document.querySelector('#render svg') !== null",timeout=90000)
    for id,title in [('battle-for-moscow','Battle for Moscow'),('arduous','The Arduous Beginning'),
                     ('leningrad','Target: Leningrad'),('kiev','Objective: Kiev'),
                     ('kiev-odessa','Objective: Kiev + Odessa Expansion')]:
        page.locator('#game').select_option(id)
        page.wait_for_function('document.querySelector("#status").textContent.startsWith('+json.dumps(title)+')',timeout=60000)
        check(page.locator('#render > svg').count()==1,'one root shared renderer SVG '+id)
        for layer in ['terrain','railways','hex-grid','coordinates','deployment','city-labels']:
            check(page.locator(f'#render [data-layer="{layer}"]').count()>0,id+' layer '+layer)
        check(page.locator('#map-svg-download').get_attribute('href')=='../exports/'+id+'.svg',id+' map export link')
        check(page.locator('#map-png-download').get_attribute('href')=='../exports/'+id+'.png',id+' PNG link')
        if id=='kiev' and args.screenshot:
            page.evaluate('window.__inlineTextureReferences()')
            args.screenshot.parent.mkdir(parents=True,exist_ok=True)
            page.screenshot(path=str(args.screenshot),animations='disabled')
    check(not errors,'no engine JS errors '+repr(errors))
    b.close()
print('PASS v479 five historical maps rendered in real offline Chromium shared-engine viewer:',checks,'checks')
