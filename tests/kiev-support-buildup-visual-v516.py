#!/usr/bin/env python3
"""Kiev actual-engine Chromium screenshot of live Turn-2 buildup + resolved FK source photos.

The offline about:blank fixture cannot resolve relative PNG paths. This test
strictly validates the shipped relative URLs, maps them to the *exact* original
PNG bytes, and requires decoded naturalWidth before capturing the screenshot.
"""
from pathlib import Path
import json, re, base64
from playwright.sync_api import sync_playwright
from support_counter_offline_assets_v516 import hydrate_and_verify
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev/setup-preview/index.html'
CONF=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(CONF)}
for key,value in CONF.items():
 if key in {'map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy','inventoryPolicy','fixedPolicy'}:
  assets[value]=json.loads((PAGE.parent/value).resolve().read_text())
assets[CONF['mapExport']]=(PAGE.parent/CONF['mapExport']).resolve().read_text()
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script',r'<\/script')+';'+'''window.fetch=async path=>({ok:Object.prototype.hasOwnProperty.call(window.__offlineAssets,path),json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]});</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
checks=0
def check(value,label):
 global checks
 assert value,label
 checks+=1

with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=b.new_page(viewport={'width':1380,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=30000)
 page.wait_for_function('!!window.HistoricalBrowserPreview && !!HistoricalBrowserPreview.snapshot()',timeout=45000)
 check(page.locator('[data-support-face] img').count()==2,'two FK marker faces in live support panel')
 check(page.evaluate('HistoricalBrowserPreview.snapshot().phaseId')=='german-combat','Kiev source-backed opening phase')
 # Advance only to Turn-2 buildup, not the older expensive full battle/resupply suite.
 for _ in range(20):
  snap=page.evaluate('HistoricalBrowserPreview.snapshot()')
  if snap['cursor']['turn']==2 and snap['phaseId']=='german-buildup': break
  commands=page.evaluate('HistoricalBrowserPreview.view().commands')
  nextcmd=next((c for c in commands if c['type'] in ('finish-phase','finish-buildup','finish-housekeeping')),None)
  if nextcmd is None:
   nextcmd=next((c for c in commands if c.get('action',{}).get('type') in ('commit-battles','finish-combat') and not c.get('action',{}).get('battles')),None)
  check(nextcmd is not None,'source-authorized phase completion exists')
  check(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',nextcmd),'source action committed')
 else: raise AssertionError('Could not reach Turn-2 German buildup')
 check(page.locator('[data-buildup-action="entry"]').count()>0,'real engine highlights legal reinforcement hexes')
 check(hydrate_and_verify(page,PAGE,expected=2)==2,'both source Air Corps images decode from real package paths')
 check(page.evaluate('Array.from(document.querySelectorAll("[data-support-face] img")).every(i=>i.complete&&i.naturalWidth>0)'),'no broken Air Corps image remains')
 check(page.locator('#map-art').evaluate('(i)=>i.complete&&i.naturalWidth>0'),'actual game-engine map loads')
 path=ROOT/'rules/audit/visual/kiev-buildup-map-browser-v516.png';path.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(path),animations='disabled',full_page=False)
 check(not errors,'no Chromium errors '+str(errors))
 b.close()
print('PASS Kiev v516 Support thumbnails in actual buildup/engine render',checks,'checks; ',path)
