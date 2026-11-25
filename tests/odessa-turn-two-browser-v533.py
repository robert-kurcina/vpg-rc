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
 yes(any(x.get('slotId')=='t2-hungarian' for x in turn2),'Original Hungarian slot offered')
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
 choose({'type':'finish-buildup'})
 yes(snap()['lastEvent']['supportArrivals']==['t2-romanian-air'],'Romanian original air Turn 2 schedule recorded')
 for a in [
  {'type':'finish-phase'},
  {'type':'combat','action':{'type':'finish-air-sea'}},
  {'type':'combat','action':{'type':'commit-battles','battles':[]}},
  {'type':'combat','action':{'type':'finish-combat'}},
  {'type':'finish-phase'}
 ]:choose(a)
 yes(snap()['phaseId']=='soviet-buildup','Actual Soviet Turn 2 Buildup reached')
 yes(snap()['buildup']['spent']==0,'Soviet starts with two replacement steps available')
 soviet=view()['commands']
 yes(any(x.get('type')=='apply-replacement' and x.get('unitId')=='kiev-front-r04c07' and x.get('hex')=='1914' for x in soviet),'Replacement-only original Soviet Army offered on southern combined edge')
 choose({'type':'apply-replacement','unitId':'kiev-front-r04c07','hex':'1914'})
 yes(snap()['state']['units']['kiev-front-r04c07']['strengthStatus']=='printed-reduced','Replacement enters at reduced strength')
 yes(snap()['buildup']['spent']==1,'Soviet spent one of two allowed replacement steps')
 yes(page.locator('#counter-overlay [data-unit-id]').count()==39,'Actual original Soviet reserve counter rendered')
 saved=page.evaluate(api+'.save()')
 yes(page.evaluate('(x)=>'+api+'.restore(x)',saved),'Soviet rebuilt reserve survived replay')
 photo={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'assets/support-counters').glob('*.png')}
 num=page.evaluate('''(art)=>{let n=0;for(const img of document.querySelectorAll('.support-window-counter img')){const f=img.src.split('/').at(-1).replace('.png','');if(art[f]){img.src=art[f];n++}}return n}''',photo)
 yes(num>=3,'Source support photographs loaded in offline browser')
 picture=ROOT/'rules/audit/visual/odessa-turn-two-soviet-replacement-browser-v533.png'
 page.screenshot(path=str(picture),full_page=False)
 choose({'type':'finish-buildup'})
 yes(snap()['phaseId']=='soviet-special-movement','Turn 2 Buildup commits into Soviet Special Movement')
 yes(snap()['lastEvent']['forfeitedReplacementSteps']==1,'One unused replacement step correctly forfeited')
 yes(not errors,'No Chromium JavaScript errors: '+str(errors))
 browser.close()
print('PASS v533 actual Kiev–Odessa Turn 2 Chromium',checks,'assertions')
