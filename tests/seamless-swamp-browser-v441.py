#!/usr/bin/env python3
"""Actual shared SVG renderer in Chromium: user-supplied tiled Swamp art."""
from pathlib import Path
import json,base64
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
registry=json.loads((ROOT/'maps/registry.json').read_text())
board=json.loads((ROOT/'maps/kiev.json').read_text())
from_kinds=('open','forest','swamp','woods','hills','mountain','rough')
paths={k:'terrain-'+k+('-user-v441' if k=='swamp' else '-v439' if k in ('open','forest') else '')+'.png' for k in from_kinds}
textures={k:'data:image/png;base64,'+base64.b64encode((ROOT/'supplied_assets/flat'/name).read_bytes()).decode('ascii') for k,name in paths.items()}
errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
    try:
        page=browser.new_page(viewport={'width':1440,'height':900})
        page.on('pageerror',lambda exc: errors.append(str(exc)))
        page.set_content('<!doctype html><html><body><main id="map"></main></body></html>')
        for name in ('core/factions.js','core/terrain_tiles.js','core/presentation.js'):
            page.add_script_tag(content=(ROOT/name).read_text())
        page.evaluate('reg=>WargamePresentation.configureProfiles(reg.maps)',registry)
        result=page.evaluate('''({board,textures})=>{
         const T=HexTerrainTiles,P=WargamePresentation;
         document.querySelector('#map').innerHTML=T.svgMap(board,P.options('kiev',{id:'chromium-v441',textures}));
         const all=Array.from(document.querySelectorAll('.terrain-seamless-texture'));
         const f1111=document.querySelector('[data-hex-id="1111"]');
         const f1110=document.querySelector('[data-hex-id="1110"]');
         const pattern=document.querySelector('pattern[id="terrain-seamless-chromium-v441-swamp"]');
         return {hexes:document.querySelectorAll('.hex-tile').length,
           swampPolygons:all.length,
           patternExists:Boolean(pattern),
           patternUnits:pattern?.getAttribute('patternUnits'),
           patternImage:pattern?.querySelector('image')?.getAttribute('href')?.startsWith('data:image/png;base64,')||false,
           allSwampTextured:all.every(el=>el.getAttribute('opacity')==='1.00'),
           forest1111Opacity:f1111?.querySelector('.texture-clip')?.getAttribute('opacity'),
           forest1110Opacity:f1110?.querySelector('.texture-clip')?.getAttribute('opacity')};
        }''', {'board':board,'textures':textures})
        assert result['hexes']==165,result
        assert result['swampPolygons']==10,result
        assert result['patternExists'] and result['patternUnits']=='userSpaceOnUse' and result['patternImage'],result
        assert result['allSwampTextured'],result
        assert result['forest1110Opacity']==result['forest1111Opacity']=='1.00',result
        dims=page.evaluate('''src=>new Promise((resolve,reject)=>{
           const img=new Image();img.onload=()=>resolve([img.naturalWidth,img.naturalHeight]);
           img.onerror=()=>reject(Error('Cannot decode user supplied Swamp art'));img.src=src;
        })''',textures['swamp'])
        assert dims==[1254,1254],dims
        assert not errors,errors
        report={'version':'v441','method':'real Chromium executing project renderer in-memory','scene':'Objective Kiev real 165-hex board','result':result,'userBitmapDecoded':dims,'pageErrors':errors,'gameplayHttpSmoke':'not run; independent in-memory rendering verified'}
        (ROOT/'rules/audit/seamless-swamp-browser-v441.json').write_text(json.dumps(report,indent=2)+'\n')
        print('PASS v441 Chromium: globally tiled user Swamp bitmap and normalized 1111 Forest texture')
        page.close()
    finally:
        browser.close()
