#!/usr/bin/env python3
"""Actual shared browser runtime smoke test; no simulated renderer/rules."""
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
# The SVG is an unchanged engine export; the offline test uses its PNG twin to avoid inlining 8.8 MB of source SVG.
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev-odessa.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
checks=0
def yes(value,reason):
 global checks
 assert value,reason
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':880},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 print('browser: set content',len(html),flush=True)
 page.set_content(html,wait_until='load',timeout=60000)
 print('browser: content loaded',flush=True)
 print('browser: waiting for game',flush=True)
 
 try: page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=20000)
 except Exception as e:
  print('browser status:',page.locator('#status').inner_text(),flush=True)
  print('browser message:',page.locator('#message').inner_text()[:2400],flush=True)
  print('page errors:',errors[:5],flush=True)
  raise
 api='window.HistoricalBrowserPreview'
 get=lambda:page.evaluate(api+'.snapshot()')
 view=lambda:page.evaluate(api+'.view()')
 print('browser: game ready',flush=True)
 a=get()
 yes(a['phaseSupported'] is True,'Actual experimental German Combat supported')
 yes(len(a['state']['units'])==36,'36 real ground counters')
 yes(a['state']['supportMarkers']['blackSeaFleet']['hex']=='1513','Fleet at Odessa as separate support marker')
 yes(len(a['state']['cityControl'])==20,'20-city ledger present')
 yes(a['cursor']['turn']==1,'Start at historical German Turn 1 Combat')
 yes(page.locator('#counter-overlay [data-unit-id]').count()==36,'Real shared counter render displays all 36 ground units')
 yes(page.locator('#map-art').get_attribute('src').startswith('data:image/png'), 'Original shared-engine export loaded')
 yes(not errors,'No JS browser errors: '+str(errors))
 yes(any(x.get('action',{}).get('type')=='finish-air-sea' for x in view()['commands']),'Air-sea source decision exposed')
 def choose(action):
  yes(page.evaluate('(a)=>'+api+'.choose(a)',action),'Human gateway accepted '+str(action))
 choose({'type':'combat','action':{'type':'finish-air-sea'}})
 yes(get()['combat']['status']=='awaiting-declarations','Real combat transitions after air-sea')
 choose({'type':'combat','action':{'type':'commit-battles','battles':[]}})
 choose({'type':'combat','action':{'type':'finish-combat'}})
 yes(get()['phaseId']=='german-special-movement','Shared campaign advances to special movement')
 move_cmds=[x for x in view().get('commands',[]) if x.get('type')=='declare-ground-move']
 yes(len(move_cmds)>0,'Actual source-validated ground routes are exposed in German Special Movement')
 move=move_cmds[0];origin=move['request']['path'][0];target=move['request']['path'][-1];unit_id=move['request']['unitId']
 choose(move);yes(get()['pendingGround']['unitId']==unit_id,'Unit movement is committed before execution')
 choose({'type':'resolve-ground-move'})
 yes(get()['state']['units'][unit_id]['hex']==target and target!=origin,'Actual ground movement committed on composite map')
 yes(get()['lastEvent']['ok'] is True,'Shared movement action successfully adjudicated')
 saved=page.evaluate(api+'.save()')
 yes(saved['format']=='historical-human-decision-session','Existing human save envelope')
 yes(page.evaluate('(x)=>'+api+'.restore(x)',saved),'Browser save/restore replay')
 yes(get()['phaseId']=='german-special-movement','Restored phase matches')
 yes(get()['state']['units'][unit_id]['hex']==target,'Movement persists after browser restore')
 yes(page.evaluate(api+'.undo()'),'Browser Undo reverses ground move')
 yes(get()['pendingGround']['unitId']==unit_id and get()['state']['units'][unit_id]['hex']==origin,'Undo restores committed pre-move position')
 yes(page.evaluate(api+'.undo()'),'Browser Undo reverses movement declaration')
 yes(get()['pendingGround'] is None,'Undo removes staged movement')
 yes(page.evaluate(api+'.undo()'),'Browser Undo reverses phase transition')
 yes(get()['phaseId']=='german-combat','Undo returns to original combat phase')
 # A real defender-first exchange (not a skipped battle) must work through
 # the very same browser human gateway, including a committed die and saved
 # post-roll choice. This catches missing scenario source bindings.
 page.evaluate(api+'.reset()')
 choose({'type':'combat','action':{'type':'finish-air-sea'}})
 available=view()['proposals']
 attack=next((b for b in available if b['defenderHex']=='0205' and b['attackers']==['kiev-front-r01c01','kiev-front-r01c03']),None)
 yes(attack is not None,'Original Kiev contested attack legal on composite')
 choose({'type':'combat','action':{'type':'commit-battles','battles':[attack]}})
 choose({'type':'combat','action':{'type':'select-battle','defenderHex':'0205'}})
 choose({'type':'combat','action':{'type':'commit-ground-air','faceId':'kiev-front-r03c01'}})
 yes(page.evaluate('()=>window.HistoricalBrowserPreview.roll(3)'),'Browser committed actual CRT die')
 result=view();yes(result['kind']=='post-roll-choice' and result['crtOutcome']=='EX','Original shared CRT returned EX after die')
 yes(len(result['options'])>0,'Result-dependent combat consequences validated')
 committed=page.evaluate(api+'.save()')
 yes(page.evaluate('(x)=>window.HistoricalBrowserPreview.restore(x)',committed),'Browser restores committed pre-choice die')
 yes(view()['crtOutcome']=='EX','Restored result cannot be rerolled silently')
 choose(view()['options'][0])
 yes(len(get()['combat']['resolved'])==1,'Browser resolved actual exchange and retreat')
 # Preserve screenshot as actual engine/browser evidence, not a reconstructed illustration.
 page.evaluate('(x)=>window.HistoricalBrowserPreview.restore(x)',saved)
 # Offline HTML has no HTTP origin. Resolve original existing photographs to
 # data URLs strictly in the test harness; production continues to use source
 # assets/support-counters files by their normal static paths.
 art={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode() for p in (ROOT/'assets/support-counters').glob('*.png')}
 photo_stats=page.evaluate('''(art)=>{let good=0;for(const img of document.querySelectorAll('.support-window-counter img')){const name=img.src.split('/').at(-1).replace('.png','');if(art[name]){img.src=art[name];good++}}return {good,total:document.querySelectorAll('.support-window-counter img').length}}''',art)
 yes(photo_stats['good']==4 and photo_stats['total']==4,'Real source-photo air and Fleet counter images resolved in browser evidence')
 page.wait_for_function('Array.from(document.querySelectorAll(".support-window-counter img")).every(i=>i.complete&&i.naturalWidth>0)',timeout=10000)
 yes(page.locator('.support-window-counter img').count()==4,'All four Support counter photographs rendered')
 page.locator('#map-art').wait_for(state='visible')
 out=ROOT/'rules/audit/visual/odessa-experimental-opening-browser-v531.png';out.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(out),full_page=False)
 print('PASS actual browser Kiev-Odessa experimental opening',checks,'assertions; screenshot',out)
 browser.close()
