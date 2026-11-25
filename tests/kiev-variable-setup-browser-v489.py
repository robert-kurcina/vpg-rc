#!/usr/bin/env python3
"""Real shared-engine Kiev Chromium: §6 player-selected alternative deployments.

Exact production HTML/JS/CSS, source JSON, and shared-engine exported Kiev
PNG are inlined solely because localhost navigation is blocked. No synthetic
map, counter, alternative controller, or gameplay rule implementation.
"""
import base64,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev/setup-preview/index.html'
conf=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(conf)}
for k,v in conf.items():
 if k in {'map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy','inventoryPolicy','fixedPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets[conf['mapExport']]=(PAGE.parent/conf['mapExport']).resolve().read_text()
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
checks=0
def ok(cond,msg):
 global checks
 assert cond,msg
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1365,'height':990})
 errors=[]
 page.on('pageerror',lambda exc:errors.append(str(exc)))
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview&&window.HistoricalBrowserPreview.snapshot().phaseId==="german-combat"',timeout=60000)
 api='HistoricalBrowserPreview'
 ok('do not prescribe one counter-by-counter historical opening' in page.locator('p.warning').inner_text(),'§6 source interpretation explicit')
 ok(page.locator('#map-art').evaluate('(x)=>x.complete&&x.naturalWidth===1269'),'approved Kiev engine exported map rendered')
 ok(page.locator('#counter-overlay .official-counter').count()==30,'30 actual source counters')
 page.evaluate(api+'.enterSetup()')
 ok(page.locator('#setup-panel').is_visible(),'live setup panel opened')
 ok(page.locator('#setup-ready').is_disabled(),'concealed mix is required')
 begin=page.evaluate(api+'.setupView()')
 rom=begin['allocation']['romanianInitialArmy'][0]
 ger=begin['allocation']['germanRomaniaInfantry'][0]
 prior_rom=begin['placements'][rom];prior_ger=begin['placements'][ger]
 ok(page.evaluate('([a,b])=>HistoricalBrowserPreview.setupSwapPosition(a,b)',[rom,ger]),'Romanian Army and German Infantry swap allowed between source slots')
 changed=page.evaluate(api+'.setupView()')
 ok(changed['placements'][rom]==prior_ger and changed['placements'][ger]==prior_rom,'Romanian four-hex choice persisted')
 panzer=begin['allocation']['germanInitialPanzer'][0]
 ok(page.evaluate('(id)=>HistoricalBrowserPreview.setupMove(id,"0402")',panzer),'German Panzer can relocate doubled Polish slot')
 shifted=page.evaluate(api+'.setupView()')
 ok(shifted['placements'][panzer]=='0402','alternative three Polish double-stacks accepted')
 army=begin['allocation']['sovietFrontArmies'][0]
 mech=begin['allocation']['sovietFrontMechanized'][0]
 ok(page.evaluate('([a,b])=>HistoricalBrowserPreview.setupSwapPosition(a,b)',[army,mech]),'alternative legal Soviet Army-star selection')
 shifted=page.evaluate(api+'.setupView()')
 ok(shifted['placements'][army]==begin['placements'][mech],'Soviet Army alternate star preserved')
 # Invalid region attempt is rejected and leaves the setup unmutated.
 before_invalid=page.evaluate(api+'.setupView()')
 ok(not page.evaluate('(id)=>HistoricalBrowserPreview.setupMove(id,"0709")',panzer),'Polish Panzer cannot be set up in Romania')
 ok(page.evaluate(api+'.setupView()')==before_invalid,'illegal cross-national placement atomic')
 ok(page.evaluate(api+'.setupShuffle()'),'10 concealed mechanized Corps mixed')
 ok(not page.locator('#setup-ready').is_disabled(),'mix unlocks campaign')
 ok(page.evaluate(api+'.beginFromSetup()'),'alternative player-chosen §6 setup starts real campaign')
 snap=page.evaluate(api+'.snapshot()')
 ok(snap['phaseId']=='german-combat' and snap['cursor']['turn']==1,'first turn starts with Axis combat')
 ok(len(snap['state']['units'])==30,'30 alternative starting pieces are in live campaign')
 for id in [rom,ger,panzer,army]:
  ok(snap['state']['units'][id]['openingHex']==before_invalid['placements'][id],'player-chosen original deployment recorded for '+id)
 saved=page.evaluate(api+'.save()')
 ok(saved['format']=='historical-custom-campaign','custom setup source lineage saved')
 ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',saved),'custom campaign restored')
 ok(page.evaluate(api+'.snapshot()')==snap,'restored exact alternative initial state')
 ok(not errors,'Chromium source engine reports no errors: '+str(errors))
 shot=ROOT/'rules/audit/visual/kiev-variable-setup-browser-v489.png'
 shot.parent.mkdir(exist_ok=True,parents=True)
 page.screenshot(path=str(shot),animations='disabled',full_page=False)
 browser.close()
print('PASS v489 Kiev §6 alternate setup real browser',checks,'checks',shot)
