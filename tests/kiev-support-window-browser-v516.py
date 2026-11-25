#!/usr/bin/env python3
"""Chromium Kiev: shared Air Support panel uses source-photo FK IV / FK V.
The historical map and every game script are original shipped assets.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, base64
from support_counter_offline_assets_v516 import hydrate_and_verify
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev/setup-preview/index.html'
CONF=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(CONF)}
for k,v in CONF.items():
 if k in {'map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy','inventoryPolicy','fixedPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets[CONF['mapExport']]=(PAGE.parent/CONF['mapExport']).resolve().read_text()
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">', lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+\
'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)

with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1430,'height':960})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('typeof window.HistoricalBrowserPreview!=="undefined"')
 assert page.locator('[data-support-face]').count()==2
 assert page.locator('[data-support-window]').is_visible()
 assert page.locator('[data-support-assign]').count()==0
 assert page.evaluate('HistoricalBrowserPreview.snapshot().phaseId')=='german-combat'
 assert page.locator('#map-art').evaluate('(i)=>i.complete&&i.naturalWidth>0')
 count=hydrate_and_verify(page,PAGE,expected=2)
 assert count==2
 assert 'FK IV' in page.locator('[data-support-window]').inner_text()
 assert 'FK V' in page.locator('[data-support-window]').inner_text()
 path=ROOT/'rules/audit/visual/support-window-kiev-desktop-v516.png';path.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(path),full_page=False)
 assert not errors,errors
 b.close()
print('PASS v516 Kiev actual-engine Air Support window: source photos decode; source counters + actual map export')
