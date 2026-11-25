#!/usr/bin/env python3
"""Verify native browser uses the approved universal map with all bitmap art.

The original v370 isolated DOM fixture did not serve image bytes. This test
recreates that exact environment with the *real* source image bytes and fails
if any terrain, fortification, or city-highlight art disappears. It extracts
the browser-produced SVG, removes *only* interactive counter/selection UI,
then rasterizes and compares it pixel-exactly to the established universal
Node renderer's Battle for Moscow export. No image synthesis is used.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
from native_browser_asset_fixture import install_fetch
from PIL import Image, ImageChops
import json, subprocess, hashlib

root=Path(__file__).resolve().parent.parent
artdir=root/'rules/audit/visual'
artdir.mkdir(parents=True,exist_ok=True)
preview=root/'games/battle-for-moscow/native-preview'
html=(preview/'index.html').read_text()
html=html[:html.index('<script src=')]+html[html.index('</body>',html.index('<script src=')):]
source={
 '../game.json':'games/battle-for-moscow/game.json',
 '../map.json':'games/battle-for-moscow/map.json',
 '../units.json':'games/battle-for-moscow/units.json',
 '../deployments.json':'games/battle-for-moscow/deployments.json',
 '../rules.json':'games/battle-for-moscow/rules.json',
 '../objectives.json':'games/battle-for-moscow/objectives.json',
 'config.json':'games/battle-for-moscow/native-preview/config.json',
 'ui-config.json':'games/battle-for-moscow/native-preview/ui-config.json',
 '../../../maps/battle-for-moscow.json':'maps/battle-for-moscow.json',
 '../../../maps/registry.json':'maps/registry.json',
}
data={key:json.loads((root/path).read_text()) for key,path in source.items()}
scripts=['modules.js','roster.js','engine.js','native_preview_config.js',
 'native_session_actions.js','sync_sha256.js','native_session_save.js','session.js',
 'native_session_ai.js','factions.js','presentation.js','terrain_tiles.js',
 'official_counter_templates.js','counter_visuals.js','native_combat_ui.js','native_tournament_scoring.js','native_city_status.js',
 'native_browser_view.js']

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1850,'height':1300},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(page,data,root)
 for script in scripts:page.add_script_tag(content=(root/'core'/script).read_text())
 page.evaluate('window.__nativePreviewReady')
 status=page.locator('#game-status').inner_text()
 assert 'Preview unavailable' not in status,status
 images=page.evaluate('''async () => {
  const svg=document.querySelector('#map>svg');
  if(!svg)throw Error('No renderer-produced SVG map');
  const im=[...svg.querySelectorAll('image')].map(e=>({
   type:e.getAttribute('class'),href:e.getAttribute('href')||''}));
  if(im.some(i=>!i.href.startsWith('data:image/')))throw Error('Unembedded SVG artwork');
  await Promise.all(im.map(x=>new Promise((ok,bad)=>{
   const img=new Image();img.onload=ok;img.onerror=()=>bad(Error('Unable to decode '+x.type));img.src=x.href;
  })));
  return {total:im.length,terrain:im.filter(x=>x.type===null&&x.href.startsWith('data:image/png')).length,
    fortification:im.filter(x=>x.type==='fortification-asset').length,
    city:im.filter(x=>x.type==='city-hex-highlight').length,
    allEmbedded:im.every(x=>x.href.startsWith('data:image/'))};
 }''')
 assert images['total']>=40,images
 assert images['fortification']==22,images
 assert images['city']==11,images
 assert images['allEmbedded'],images
 page.locator('#map>svg').screenshot(path=str(artdir/'b4m-native-browser-corrected-v372.png'),animations='disabled')
 plain=page.evaluate('''() => {
  const svg=document.querySelector('#map>svg').cloneNode(true);
  svg.querySelector('[data-native-interactive="true"]')?.remove();
  return svg.outerHTML;
 }''')
 (artdir/'b4m-native-browser-base-v372.svg').write_text(plain)
 assert not errors,errors
 # A lost bitmap must abort the preview, not silently produce flat colors.
 missing=browser.new_page()
 missing.set_content(html,wait_until='domcontentloaded')
 missing.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(missing,data,root)
 missing.evaluate('''() => {
  const originalFetch=window.fetch;
  window.fetch=async path=>String(path).endsWith('terrain-forest.png')
   ?{ok:false,status:404}:originalFetch(path);
 }''')
 for script in scripts:missing.add_script_tag(content=(root/'core'/script).read_text())
 missing.evaluate('window.__nativePreviewReady')
 assert 'Required shared map artwork unavailable' in missing.locator('#game-status').inner_text()
 assert missing.locator('#map>svg').count()==0
 missing.close()
 # HTTP 200 with non-image bytes is also an invalid rendering input.
 corrupt=browser.new_page()
 corrupt.set_content(html,wait_until='domcontentloaded')
 corrupt.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(corrupt,data,root)
 corrupt.evaluate('''() => {
  const originalFetch=window.fetch;
  window.fetch=async path=>String(path).endsWith('terrain-open.png')
   ?{ok:true,blob:async()=>new Blob(['not a PNG'],{type:'image/png'})}
   :originalFetch(path);
 }''')
 for script in scripts:corrupt.add_script_tag(content=(root/'core'/script).read_text())
 corrupt.evaluate('window.__nativePreviewReady')
 assert 'Required shared map artwork cannot be decoded' in corrupt.locator('#game-status').inner_text()
 assert corrupt.locator('#map>svg').count()==0
 corrupt.close()
 browser.close()

svg=artdir/'b4m-native-browser-base-v372.svg'
png=artdir/'b4m-native-browser-base-v372.png'
subprocess.run(['inkscape',str(svg),'--export-filename='+str(png)],check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=90)
a=Image.open(png).convert('RGBA')
b=Image.open(root/'exports/battle-for-moscow.png').convert('RGBA')
assert a.size==b.size,(a.size,b.size)
box=ImageChops.difference(a,b).getbbox()
assert box is None,f'Browser-generated map diverged from universal exporter, first bounding box {box}'
report={
 'checkpoint':138,'status':'PASS',
 'browser':'Isolated Chromium DOM supplied actual image bytes (hosted navigation blocked by system policy)',
 'sharedRenderer':'HexTerrainTiles.svgMap',
 'decodedSourceArtwork':images,
 'pixelParity':{'match':True,'export':'exports/battle-for-moscow.png','size':list(a.size)},
 'failClosedMissingTexture':True,
 'failClosedCorruptTexture':True,
 'leningradVisualBaseline':'v350 preserved; v372 user-requested foreground-shadow candidate',
 'productionRouting':'legacy-b4m-v1',
 'artifacts':{
  'interactiveBrowserScreenshot':'rules/audit/visual/b4m-native-browser-corrected-v372.png',
  'browserMapSvg':'rules/audit/visual/b4m-native-browser-base-v372.svg',
  'browserMapPng':'rules/audit/visual/b4m-native-browser-base-v372.png'
 }}
(root/'rules/audit/b4m-native-browser-art-v372.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
