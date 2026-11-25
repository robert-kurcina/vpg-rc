#!/usr/bin/env python3
"""Restore a real, source-bound v537 seven-turn campaign save in actual shared
Chromium renderer. Screenshot the real board with Support Window closed."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,json,re
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev-odessa/experimental-preview/index.html'
CONF=json.loads((PAGE.parent/'config.json').read_text())
SAVED=json.loads((ROOT/'rules/audit/saves/odessa-contested-seven-turn-v537.json').read_text())
assets={'config.json':dict(CONF)}
for k,v in CONF.items():
 if k in {'map','counterConfig','profile','phaseConfig','combatPolicy','rosterOverlay','opening','setupPolicy','firstTurnEmptyBuildupPolicy','buildupPolicy','buildupAllocation','housekeepingPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev-odessa.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
boot='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+boot)
n=0
def ok(x,why):
 global n
 assert x,why
 n+=1
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':950},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 api='window.HistoricalBrowserPreview'
 page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=30000)
 ok(page.evaluate('(s)=>'+api+'.restore(s)',SAVED),'Load original source-pinned seven-turn human save in browser')
 state=page.evaluate(api+'.snapshot()')
 ok(state['cursor']['complete'],'Shared browser restores seven-turn terminal game')
 ok(state['cursor']['turn']==7,'Terminal turn remains 7')
 ok(len(state['state']['units'])==42,'All 42 historical grounded counter identities present')
 ok(page.locator('#counter-overlay [data-unit-id]').count()==42,'All 42 counters rendered by shared SVG counter renderer')
 if not page.locator('.support-window').is_hidden():
  button=page.locator('[data-support-close="true"]')
  ok(button.count()>=1,'Actual shared Support Window has working close control')
  button.first.click()
 ok(page.locator('.support-window').is_hidden(),'Support Window hidden to show source map')
 ok(page.locator('#map-art').get_attribute('src').startswith('data:image/png'),'Unchanged shared map export loaded')
 ok(not errors,'No JavaScript errors: '+str(errors))
 visual=ROOT/'rules/audit/visual/odessa-contested-seven-turn-map-v537.png'
 page.locator('.board-space').screenshot(path=str(visual),timeout=30000)
 print('PASS v537 actual browser terminal save render',n,'assertions; screenshot',visual)
 browser.close()
