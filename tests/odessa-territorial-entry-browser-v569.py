#!/usr/bin/env python3
"""Actual shared Chromium Turn 2 buildup, original source map and counter art."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,re,base64
ROOT=Path(__file__).resolve().parents[1]
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
checks=0
def yes(x,msg):
 global checks
 assert x,msg
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 api='window.HistoricalBrowserPreview'
 try:page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=30000)
 except Exception:
  print('STATUS',page.locator('#status').inner_text(),'MESSAGE',page.locator('#message').inner_text(),'ERRORS',errors);raise
 snap=lambda:page.evaluate(api+'.snapshot()')
 view=lambda:page.evaluate(api+'.view()')
 def choose(a):
  yes(page.evaluate('(x)=>'+api+'.choose(x)',a),'Human committed '+str(a))
 yes(len(snap()['state']['units'])==36,'36 source ground units');yes(len(snap()['state']['buildupDeployedIds'])==36,'All source entries initialized')
 yes(page.locator('#counter-overlay [data-unit-id]').count()==36,'Real counters rendered in shared browser')
 for a in [
  {'type':'combat','action':{'type':'finish-air-sea'}},
  {'type':'combat','action':{'type':'commit-battles','battles':[]}},
  {'type':'combat','action':{'type':'finish-combat'}},
  {'type':'finish-phase'},
  {'type':'finish-buildup'},
  {'type':'finish-phase'},
  {'type':'finish-phase'}, # Naval Operations
  {'type':'combat','action':{'type':'commit-battles','battles':[]}},
  {'type':'combat','action':{'type':'finish-combat'}},
  {'type':'finish-phase'},
  {'type':'finish-housekeeping'}
 ]: choose(a)
 yes(snap()['phaseId']=='german-buildup' and snap()['cursor']['turn']==2,'Actual German Turn 2 Buildup reached')
 turn2=view()['commands']
 yes(any(x.get('slotId')=='t2-slovak' for x in turn2),'Original Slovak slot offered')
 yes(any(x.get('slotId')=='t2-hungarian' and x.get('hex')=='0201' for x in turn2),'Hungarian Lublin entry offered')
 outside={c['id'] for c in assets[CONF['map']]['cells'] if c.get('sourceTerritory')=='outside'}
 yes(all(x.get('hex') in outside for x in turn2 if x.get('slotId')=='t2-hungarian'),'Only approved outside entry offered')
 yes(any(x.get('hex')=='0102' and x.get('slotId')=='t2-hungarian' for x in turn2),'Previously unclassified outside entry now offered')
 yes(page.locator('#actions button').count()>0,'Actual Orders buttons present')
 choose({'type':'place-reinforcement','slotId':'t2-slovak','hex':'0101'})
 choose({'type':'place-reinforcement','slotId':'t2-hungarian','hex':'0201'})
 yes(snap()['state']['units']['kiev-front-r02c07']['nationality']=='slovak','Printed Slovak nationality preserved')
 yes(snap()['state']['units']['kiev-front-r04c08']['nationality']=='hungarian','Printed Hungarian nationality preserved')
 yes(page.locator('#counter-overlay [data-unit-id]').count()==38,'Actual source artwork projects 38 ground counters')
 saved=page.evaluate(api+'.save()');yes(page.evaluate('(x)=>'+api+'.restore(x)',saved),'Browser Save/Restore replay with two arrivals')
 yes(len(snap()['state']['units'])==38,'Two arrivals survive restore')
 yes(page.evaluate(api+'.undo()'),'Undo placement in Chromium')
 yes('kiev-front-r04c08' not in snap()['state']['units'],'Undo removed second arrival')
 choose({'type':'place-reinforcement','slotId':'t2-hungarian','hex':'0201'})

 yes(not errors,'No Chromium JavaScript errors: '+str(errors))
 browser.close()
print('PASS v569 actual Kiev–Odessa territorial reinforcement Chromium',checks,'assertions')
