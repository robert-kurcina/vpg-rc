#!/usr/bin/env python3
"""Actual shared Chromium campaign: Kiev–Odessa Soviet Turn 1 Buildup, not mock HTML."""
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
def yes(test,description):
 global checks
 assert test,description
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':880},device_scale_factor=1)
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 api='window.HistoricalBrowserPreview'
 page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=30000)
 snap=lambda:page.evaluate(api+'.snapshot()')
 view=lambda:page.evaluate(api+'.view()')
 def choose(action):
  yes(page.evaluate('(a)=>'+api+'.choose(a)',action),'Allowed action '+repr(action))
 yes(len(snap()['state']['units'])==36,'All 36 source ground counters render')
 yes(page.locator('#counter-overlay [data-unit-id]').count()==36,'All 36 actual engine counter SVGs visible')
 choose({'type':'combat','action':{'type':'finish-air-sea'}})
 choose({'type':'combat','action':{'type':'commit-battles','battles':[]}})
 choose({'type':'combat','action':{'type':'finish-combat'}})
 yes(snap()['phaseId']=='german-special-movement','Opening combat advances')
 choose({'type':'finish-phase'})
 before=snap()
 yes(before['phaseId']=='soviet-buildup','Mandatory Soviet buildup reached')
 yes(before['phaseSupported'] is True,'Buildup supported by first-turn rule')
 yes(view()['commands']==[{'type':'finish-buildup'}],'Only source-authorized finish action is offered')
 yes(not any(c.get('type') in ('place-reinforcement','apply-replacement') for c in view()['commands']),'No invented placement or replacement action')
 yes(page.locator('#status').inner_text().lower().find('soviet')>=0,'Actual UX shows Soviet phase')
 # The offline harness has no HTTP static asset host. Present the ORIGINAL
 # support-counter photography via data URLs only in Chromium evidence.
 art={f.stem:'data:image/png;base64,'+base64.b64encode(f.read_bytes()).decode() for f in (ROOT/'assets/support-counters').glob('*.png')}
 photos=page.evaluate('''(art)=>{let shown=0;for(const img of document.querySelectorAll('.support-window-counter img')){const name=img.src.split('/').at(-1).replace('.png','');if(art[name]){img.src=art[name];shown++}}return shown}''',art)
 yes(photos>=3,'Original source air/Fleet counter images resolved in offline evidence')
 page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-soviet-buildup-phase-browser-v532.png'),full_page=False)
 saved=page.evaluate(api+'.save()')
 yes(page.evaluate('(x)=>'+api+'.restore(x)',saved),'Pre-buildup browser save/restore')
 yes(snap()['phaseId']=='soviet-buildup','Restore retains buildup phase')
 # Real DOM action button, not only a JS-controller call.
 buttons=page.locator('#actions button')
 yes(buttons.count()>0,'Human controls show a legal buildup button')
 matching=buttons.filter(has_text=re.compile('Finish Buildup',re.I))
 yes(matching.count()>0,'Finish Buildup offered as an actionable DOM button')
 matching.first.click()
 after=snap()
 yes(after['phaseId']=='soviet-special-movement','DOM button commits buildup through shared journal')
 yes(after['lastEvent']['forfeitedReplacementSteps']==0,'Zero replacement steps in source turn')
 yes(len(after['state']['units'])==36 and after['state']['supportMarkers']['blackSeaFleet']['hex']=='1513','All original game units preserved')
 yes(after['state']['cityControl']==before['state']['cityControl'],'City control invariant')
 savedAfter=page.evaluate(api+'.save()')
 yes(page.evaluate('(x)=>'+api+'.restore(x)',savedAfter),'Post-buildup browser Save/Restore')
 yes(snap()['phaseId']=='soviet-special-movement','Restored successor phase')
 yes(page.evaluate(api+'.undo()'),'Actual browser Undo')
 yes(snap()['phaseId']=='soviet-buildup','Undo returns to mandatory buildup')
 choose({'type':'finish-buildup'})
 yes(any(c.get('type')=='finish-phase' for c in view()['commands']),'Subsequent Soviet Special Movement can end normally')
 choose({'type':'finish-phase'})
 yes(snap()['phaseId']=='soviet-combat' and snap()['phaseSupported'] is True,'Soviet combat begins after legal phase transition')
 yes(not errs,'No Chromium JS errors: '+repr(errs))
 page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-soviet-turn-one-buildup-browser-v532.png'),full_page=False)
 browser.close()
print(f'PASS v532 actual Chromium Soviet Turn 1 Buildup: {checks} assertions')
