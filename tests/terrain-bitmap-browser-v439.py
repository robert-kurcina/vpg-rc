#!/usr/bin/env python3
"""Exercise the actual shared SVG renderer in Chromium without an HTTP server.

The sandbox may block even localhost HTTP (ERR_BLOCKED_BY_ADMINISTRATOR).
This browser smoke injects the unchanged project JS and genuine map JSON via the
same in-memory paths used in the browser UI and tests actual decoded PNG assets.
"""
from pathlib import Path
import json,base64
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
registry=json.loads((ROOT/'maps/registry.json').read_text())
board=json.loads((ROOT/'maps/kiev.json').read_text())
textures={k:'data:image/png;base64,'+base64.b64encode((ROOT/'supplied_assets/flat'/('terrain-'+k+('-v439' if k in ['open','forest','swamp'] else '')+'.png')).read_bytes()).decode('ascii') for k in ('open','forest','swamp','woods','hills','mountain','rough')}
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        page=browser.new_page(viewport={'width':1440,'height':900})
        page.on('pageerror',lambda exc: errors.append(str(exc)))
        page.set_content('<!doctype html><html><body><main id="map"></main></body></html>')
        for name in ('core/factions.js','core/terrain_tiles.js','core/presentation.js'):
            page.add_script_tag(content=(ROOT/name).read_text())
        page.evaluate('registry=>WargamePresentation.configureProfiles(registry.maps)',registry)
        result=page.evaluate('''({board,textures})=>{
          const T=HexTerrainTiles, P=WargamePresentation;
          const svg=T.svgMap(board,P.options('kiev',{id:'browser-test-kiev',textures}));
          document.querySelector('#map').innerHTML=svg;
          return {svgCount:document.querySelectorAll('#map > svg').length,
            passCount:document.querySelectorAll('.terrain-pass').length,
            spriteCount:document.querySelectorAll('image.terrain-texture').length,
            colors:[...document.querySelectorAll('.terrain-fill')].map(p=>p.getAttribute('fill')),
            imageCount:document.querySelectorAll('image').length};
        }''', {'board':board,'textures':textures})
        assert result['svgCount']==1 and result['imageCount']>0 and result['passCount']>0,result
        for kind,color in [('open','#dcd4c9ff'),('forest','#727f61ff'),('swamp','#616f6fff')]:
            assert color in result['colors'],(kind,color)
            decoded=page.evaluate('''async(src)=>new Promise((resolve,reject)=>{
              const img=new Image();img.onload=()=>resolve([img.naturalWidth,img.naturalHeight]);
              img.onerror=()=>reject(Error('Bitmap decode failed'));img.src=src;
            })''',textures[kind])
            assert decoded[0]>200 and decoded[1]>200,(kind,decoded)
        assert not errors, errors
        report={'version':'v439','method':'real Chromium in-memory shared-engine render (localhost blocked by sandbox policy)','scene':'Objective: Kiev original source board','pageErrors':errors,'spriteCount':result['spriteCount'],'imageCount':result['imageCount'],'appliedTerrainFills':['#dcd4c9ff','#727f61ff','#616f6fff'],'variantPNGsDecoded':True,'fullHTTPGameSmoke':'not-run-sandbox-localhost-blocked'}
        (ROOT/'rules/audit/terrain-bitmap-browser-v439.json').write_text(json.dumps(report,indent=2)+'\n')
        print('PASS v439 Chromium shared-engine scene with all three real variant bitmap tiles')
        page.close()
    finally:browser.close()
