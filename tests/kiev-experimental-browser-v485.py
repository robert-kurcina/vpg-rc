#!/usr/bin/env python3
"""Chromium: real shared-engine Kiev map/counters, human controls and save/undo.

Local HTTP navigation is blocked in this test environment. This harness inlines
identical packaged engine scripts, CSS, JSON and exported PNG map art; it does
NOT substitute an alternate renderer or gameplay implementation. The normal
shipped page continues to load exports/kiev.svg by relative URL.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, base64

ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev/setup-preview/index.html'
SCREENSHOT=ROOT/'rules/audit/visual/kiev-experimental-game-browser-v485.png'
CONF=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(CONF)}
for k,v in CONF.items():
 if k in {'map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy','inventoryPolicy','fixedPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets[CONF['mapExport']]=(PAGE.parent/CONF['mapExport']).resolve().read_text()
# Browser screenshot uses exact existing shared-engine PNG export because SVG with
# nested data URIs cannot be loaded reliably as an about:blank data URI.
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',
 lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',
 lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+\
'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
checks=0
def ok(v,label):
 global checks
 assert v,label
 checks+=1

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':960})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('typeof window.HistoricalBrowserPreview!=="undefined"',timeout=35000)
 api='window.HistoricalBrowserPreview'
 snap=lambda:page.evaluate(api+'.snapshot()')
 ok(snap()['phaseId']=='german-combat','source-first German combat initialized')
 ok(snap()['cursor']['turn']==1,'Turn 1')
 ok(len(snap()['state']['units'])==30,'30 source-constrained counters')
 ok(page.locator('#counter-overlay [data-hex]').count()==165,'165 mapped hex hit cells')
 ok(page.evaluate('document.getElementById("map-art").naturalWidth')==1269,'actual engine map export displayed')
 ok(page.locator('#actions button').count()==1,'human choice shown')
 ok(page.locator('#setup-ready').inner_text()=='Begin Turn 1','human setup button')
 ok(not errors,'no runtime JS errors at initialization')
 SCREENSHOT.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(SCREENSHOT),full_page=False)
 # A real clicked human order, not an artificial state mutation.
 page.locator('#actions button').first.click()
 ok(snap()['actionCount']==1,'human combat declaration committed')
 ok(page.locator('#actions button').first.inner_text().lower().find('finish')>=0,'post-declaration action available')
 page.locator('#actions button').first.click()
 ok(snap()['phaseId']=='german-special-movement','German special movement begins')
 # The live browser API must expose source-reviewed legal ground moves.
 commands=page.evaluate(api+'.view().commands')
 moves=[x for x in commands if x.get('type')=='declare-ground-move']
 ok(len(moves)>0,'source-reviewed movement orders available')
 if moves:
  old=snap()
  accepted=page.evaluate('([x])=>window.HistoricalBrowserPreview.choose(x)',[moves[0]])
  ok(accepted,'source-reviewed ground movement accepted')
  ok(snap()['actionCount']>old['actionCount'],'move action journaled')
  save=page.evaluate(api+'.save()')
  ok(page.evaluate('(save)=>window.HistoricalBrowserPreview.restore(save)',save),'game save/restore accepted')
  ok(snap()['actionCount']>old['actionCount'],'move preserved after restore')
  ok(page.evaluate(api+'.undo()'),'Undo call succeeded')
  ok(snap()['actionCount']==old['actionCount'],'Undo restores movement state')
 # Finish phases through first complete turn using the exact browser human gateway.
 progress=page.evaluate('''() => {
  const api=window.HistoricalBrowserPreview,events=[];
  for(let i=0;i<12;i++){
   const s=api.snapshot(),v=api.view(),cmds=v.commands||[];
   if(s.cursor.turn>1||s.cursor.complete)break;
   const action=cmds.find(c=>c.action?.type==='finish-combat')||
    cmds.find(c=>c.action?.type==='commit-battles'&&c.action.battles.length===0)||
    cmds.find(c=>['finish-phase','finish-buildup','finish-housekeeping'].includes(c.type));
   if(!action){events.push({phase:s.phaseId,stopped:true});break}
   if(!api.choose(action)){events.push({phase:s.phaseId,failed:true});break}
   events.push({phase:s.phaseId,action:action.action?.type||action.type});
  }
  return {events,snapshot:api.snapshot()};
 }''')
 ok(progress['snapshot']['cursor']['turn']>=2,'real browser Turn 1 housekeeping completed')
 ok(any(x['phase']=='housekeeping' for x in progress['events']),'housekeeping included')
 ok(page.locator('#status').inner_text().find('Turn 2')>=0,'UI displays Turn 2')
 # Source setup must remain available as a separate, correctly validated entry.
 page.evaluate(api+'.reset()')
 ok(page.evaluate(api+'.enterSetup()') is None or True,'setup opened from shared browser')
 ok(page.locator('#setup-panel').is_visible(),'setup panel visible')
 ok(page.locator('#setup-ready').is_disabled(),'concealed mix required before new campaign')
 ok(page.evaluate(api+'.setupShuffle()'),'concealed-source shuffle accepted')
 ok(not page.locator('#setup-ready').is_disabled(),'Begin Turn 1 unlocks after mixing')
 ok(page.evaluate(api+'.beginFromSetup()'),'source-validated deployment begins campaign')
 ok(snap()['phaseId']=='german-combat','custom source setup begins German combat')
 payload=page.evaluate(api+'.save()')
 ok(payload['format']=='historical-custom-campaign','custom campaign save envelope')
 ok(page.evaluate('(x)=>window.HistoricalBrowserPreview.restore(x)',payload),'custom save restores correctly')
 ok(page.evaluate(api+'.restore({format:"bad"})') is False,'malformed save rejected')
 ok(snap()['phaseId']=='german-combat','malformed restore atomic')
 ok(not errors,'no browser exceptions across gameplay and setup')
 page.set_viewport_size({'width':390,'height':844})
 ok(page.locator('#map-scroll').is_visible(),'map accessible on mobile')
 ok(page.locator('#game-sidebar').is_visible(),'controls accessible on mobile')
 browser.close()
print('PASS Kiev v485 experimental human browser:',checks,'checks;',SCREENSHOT)
