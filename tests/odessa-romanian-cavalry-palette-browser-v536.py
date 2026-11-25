#!/usr/bin/env python3
"""Live shared-engine Kiev–Odessa browser checks for corrected Romanian cavalry counter.

Uses approved board export and actual unified historical browser/controller; visual
screenshot is captured from Chromium, not manually painted or image generated.
"""
import base64,hashlib,json,re
from pathlib import Path
from PIL import Image
import numpy as np
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
CONFIG=ROOT/'maps/counter-configs/odessa-extension.json'
COMPOSITE=ROOT/'maps/counter-configs/kiev-odessa-experimental-v531.json'
OUT=ROOT/'rules/audit/visual/odessa-romanian-cavalry-1010-browser-v550.png'
CONTEXT=ROOT/'rules/audit/visual/odessa-romanian-cavalry-1010-map-context-v550.png'
SRC=ROOT/'assets/official-counters/source-sheets/counters-odessa-back.jpg'
expected={'odessa-back-r01c01':('#c8d7ee',(52,12,65,18)),
          'odessa-back-r02c01':('#c5d4e2',(55,82,67,88))}
checks=0
def check(value,message):
 global checks
 assert value,message
 checks+=1
photo=Image.open(SRC).convert('RGB')
cfg=json.loads(CONFIG.read_text())
check(hashlib.sha256(SRC.read_bytes()).hexdigest()==cfg['faceSource']['back']['sha256'], 'Original sheet SHA unchanged')
for file in [CONFIG,COMPOSITE]:
 data=json.loads(file.read_text())
 for face_id,(color,patch) in expected.items():
  f=next(f for f in data['faces']['back'] if f['faceId']==face_id)
  check(f['observedFieldColor']==color, 'Correct '+face_id+' in '+file.name)
  check(f['visualTranscription']['printedAffiliation']=='romanian', 'Romanian attribution unchanged')
  actual=np.median(np.asarray(photo.crop(patch)).reshape(-1,3),axis=0).astype(int)
  target=np.array([int(color[i:i+2],16) for i in (1,3,5)])
  check(max(abs(actual-target))<=1,face_id+' field patch directly matches source JPEG')
PAGE=ROOT/'games/kiev-odessa/experimental-preview/index.html'
CONF=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(CONF)}
for k,v in CONF.items():
 if k in {'map','counterConfig','profile','phaseConfig','combatPolicy','rosterOverlay','opening','setupPolicy','firstTurnEmptyBuildupPolicy','buildupPolicy','buildupAllocation','housekeepingPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev-odessa.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1400,'height':980},device_scale_factor=2)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId==="german-combat"',timeout=30000)
 u=page.evaluate('window.HistoricalBrowserPreview.snapshot().state.units["kiev-odessa/romanian-cavalry-corps"]')
 check(u['hex']=='1010','Real game counter in hex 1010')
 check(u['nationality']=='romanian' and u['class']=='cavalry','Runtime Romanian cavalry national identity')
 check(u['activeFaceId']=='odessa-back-r01c01' and u['strengthStatus']=='printed-reduced','Runtime original printed reduced reverse face')
 counter=page.locator('#counter-overlay [data-unit-id="kiev-odessa/romanian-cavalry-corps"]')
 check(counter.count()==1,'Actual shared official counter SVG present')
 check(counter.get_attribute('data-damaged')=='false','Single-sided printed reverse is undamaged')
 primary=counter.locator('[data-role="primary"]')
 check(primary.count()==1,'Original shared SVG primary-color field present')
 check('#c8d7ee' in primary.get_attribute('style'),'Actual live field is Romanian pale blue')
 check(primary.evaluate('e=>getComputedStyle(e).fill')=='rgb(200, 215, 238)','Computed Chromium fill is pale blue')
 stripe=counter.locator('[data-role="status_reduced"]')
 check(stripe.count()==1,'Original SVG damage shape retained')
 check(stripe.evaluate('e=>getComputedStyle(e).display')=='none','No false damage bar on original one-step cavalry')
 check(not errors,'No browser JS errors '+str(errors[:2]))
 # Screenshot the original shared-engine counter; original game board remains live.
 OUT.parent.mkdir(parents=True,exist_ok=True)
 counter.screenshot(path=str(OUT),timeout=10000)
 bounds=counter.bounding_box()
 assert bounds and bounds['width']>0
 cx,cy=bounds['x']+bounds['width']/2,bounds['y']+bounds['height']/2
 # Capture actual unmodified engine board around the unit with nearby hexes.
 left=max(0,min(cx-195,1400-390));top=max(0,min(cy-165,980-330))
 page.screenshot(path=str(CONTEXT),clip={'x':left,'y':top,'width':390,'height':330})
 browser.close()
print('PASS Odessa source-painted cavalry at 1010 in real Chromium',checks,'assertions;',OUT,CONTEXT)
