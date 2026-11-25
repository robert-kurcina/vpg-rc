#!/usr/bin/env python3
"""Kiev actual browser: legal buildup entry highlights and top-of-stack repair UX.
Shipped HTML and shared engine, source files inlined only for offline Chromium.
"""
import base64,json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev/setup-preview/index.html'
SHOT=ROOT/'rules/audit/visual/kiev-buildup-map-browser-v492.png'
REPAIR_SHOT=ROOT/'rules/audit/visual/kiev-resupply-map-browser-v492.png'
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
N=0
def ok(v,msg):
 global N
 assert v,msg
 N+=1

def advance(page,until_turn,until_phase,max_steps=30):
 for i in range(max_steps):
  snap=page.evaluate('HistoricalBrowserPreview.snapshot()')
  if snap['cursor']['turn']==until_turn and snap['phaseId']==until_phase:return i
  v=page.evaluate('HistoricalBrowserPreview.view()')
  cmds=v.get('commands',[])
  pick=next((x for x in cmds if x['type'] in ('finish-phase','finish-buildup','finish-housekeeping')),None)
  if pick is None:
   pick=next((x for x in cmds if x.get('action',{}).get('type') in ('commit-battles','finish-combat') and not x.get('action',{}).get('battles')),None)
  if pick is None:raise AssertionError('No source legal phase completion at '+str(snap['phaseId']))
  assert page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',pick),('phase completion rejected',snap['phaseId'])
 raise AssertionError('Did not reach '+until_phase)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1380,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview&&HistoricalBrowserPreview.snapshot().phaseId==="german-combat"',timeout=60000)
 ok(page.locator('#counter-overlay .official-counter').count()==30,'actual source units rendered')
 ok(page.locator('[data-buildup-action]').count()==0,'no buildup hex highlights during combat')
 advance(page,2,'german-buildup')
 m=page.evaluate('HistoricalBrowserPreview.buildupMap()')
 ok(m['active'] and m['mode']=='entry','Turn 2 German buildup enters reinforcement mode')
 ok(m['slotIds']==['t2-slovak','t2-hungarian'],'both original reinforcement slots available')
 ok(page.locator('#buildup-map-controls').is_visible(),'map controls visible during buildup')
 ok(page.locator('#buildup-target option').count()==2,'both scheduled counters selectable')
 ok(page.locator('[data-buildup-action="entry"]').count()==len(m['entryHexes'])>0,'each highlighted hex is legal in action list')
 ok(all(a['type']=='place-reinforcement' for a in m['entryByHex'].values() for a in a),'all legal highlights are actual placement actions')
 ok(page.locator('.hex-hit[data-hex="0101"]').get_attribute('data-buildup-action')=='entry','source border admission highlighted at 0101')
 ok(page.locator('.hex-hit[data-hex="0304"]').get_attribute('data-buildup-action') is None,'interior non-entry hex not highlighted')
 # Stack order is changed by counter/hex clicks without changing source game state.
 stack_snapshot=page.evaluate('HistoricalBrowserPreview.snapshot()')
 by_hex={}
 for u in stack_snapshot['state']['units'].values():by_hex.setdefault(u['hex'],[]).append(u['id'])
 stacked_hex=next(hex for hex,ids in by_hex.items() if len(ids)>=2)
 initial_top=page.evaluate('(h)=>HistoricalBrowserPreview.stackTop(h)',stacked_hex)
 ok(page.evaluate('(h)=>HistoricalBrowserPreview.stackTop(h)',stacked_hex)==initial_top,'live stack top derives from source initial order')
 page.locator('.official-counter[data-unit-id="'+initial_top+'"]').click(force=True)
 toggled_top=page.evaluate('(h)=>HistoricalBrowserPreview.stackTop(h)',stacked_hex)
 ok(toggled_top!=initial_top,'clicking a counter cycles the top of a stack')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot()')==stack_snapshot,'stack swap is presentation only and changes no source game state')
 page.locator('.hex-hit[data-hex="'+stacked_hex+'"]').click(force=True,modifiers=['Shift'])
 ok(page.evaluate('(h)=>HistoricalBrowserPreview.stackTop(h)',stacked_hex)==initial_top,'Shift-click on hex swaps stack back')
 page.locator('#buildup-target').select_option('t2-hungarian')
 m=page.evaluate('HistoricalBrowserPreview.buildupMap()')
 ok(m['slotId']=='t2-hungarian','selector changes source reinforcement slot')
 ok(page.locator('[data-buildup-action="entry"]').count()==len(m['entryHexes']),'updated source slot destinations highlighted')
 # Choose a legal unoccupied edge target from the authoritative action set.
 dest=m['entryHexes'][0]
 before=page.evaluate('HistoricalBrowserPreview.snapshot()')
 page.locator('.hex-hit[data-hex="'+dest+'"]').click(force=True)
 after=page.evaluate('HistoricalBrowserPreview.snapshot()')
 placed=[u for u in after['state']['units'].values() if u['hex']==dest and u['id'] not in before['state']['units']]
 ok(len(placed)==1,'click highlighted entry actually places a new source counter')
 ok(placed[0]['hex']==dest,'entered at selected legal destination')
 ok(after['actionCount']==before['actionCount']+1,'entry generated one authoritative transaction')
 ok(page.locator('.official-counter[data-unit-id="'+placed[0]['id']+'"] [data-phase-activated="true"]').count()==1,'just-entered reinforcement receives phase-completed check')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Undo reinforcement placement')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot()')==before,'Undo restores source game state')
 ok(page.locator('[data-buildup-action="entry"]').count()>0,'reverted entry is rehighlighted')
 # Test phase-only absence of indicators after leaving buildup.
 finish=next(a for a in page.evaluate('HistoricalBrowserPreview.view().commands') if a['type']=='finish-buildup')
 ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',finish),'finish buildup')
 ok(page.locator('[data-buildup-action]').count()==0,'all buildup highlights clear at phase boundary')
 ok(page.locator('#buildup-map-controls').is_hidden(),'buildup selector hides outside buildup')
 # Verify source-backed repair highlights on Turn 2 after a real Turn 1 EX.
 page.evaluate('HistoricalBrowserPreview.reset()')
 for cmd in [
  {'type':'combat','action':{'type':'commit-battles','battles':[{'defenderHex':'0205','attackers':['kiev-front-r01c01','kiev-front-r01c03']}]}},
  {'type':'combat','action':{'type':'select-battle','defenderHex':'0205'}},
  {'type':'combat','action':{'type':'commit-ground-air','faceId':'kiev-front-r03c01'}}]:
  ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',cmd),'source-valid battle setup')
 ok(page.evaluate('HistoricalBrowserPreview.roll(3)'),'original CRT EX die accepted')
 opts=page.evaluate('HistoricalBrowserPreview.view().options')
 consequence=next((x for x in opts if 'kiev-front-r01c01' in (x.get('action') or {}).get('choices',{}).get('attackerLossIds',[])),None)
 ok(consequence is not None,'real retreat and exchange choice present')
 ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',consequence),'original battle resolved')
 advance(page,2,'soviet-buildup')
 repair=page.evaluate('HistoricalBrowserPreview.buildupMap()')
 ok(repair['mode']=='repair','Turn 2 Soviet repair mode selected from legal actions')
 ok(repair['repairHexes']==['0405'],'reduced Soviet unit at communicating hex highlighted')
 ok(page.locator('.hex-hit[data-hex="0405"]').get_attribute('data-buildup-action')=='repair','Soviet repair hex highlighted amber')
 ok(page.locator('#buildup-map-help').inner_text().find('top one repairs by default')!=-1,'stack repair guidance visible for touch players')
 ok(page.locator('polygon[data-hex="0405"] title').count()==1,'repair tooltip present on SVG hex')
 # Historical back face already supplies printed reduced values; its actual
 # authored SVG `status_reduced` must display the red LEFT stripe.
 reduced_id=repair['repairByHex']['0405'][0]['unitId']
 reduced_counter=page.locator('.official-counter[data-unit-id="'+reduced_id+'"]')
 ok(reduced_counter.get_attribute('data-damaged')=='true','reduced side marked in actual source counter renderer')
 stripe=reduced_counter.locator('[data-role="status_reduced"]')
 ok(stripe.count()==1,'authored source SVG red status band exists')
 ok(stripe.get_attribute('style').find('display:inline')!=-1,'red source band visible for printed-reduced counter')
 ok(stripe.get_attribute('style').find('fill:#ff0000')!=-1,'red band retains original SVG fill')
 ok(page.locator('#counter-overlay .buildup-stack-top').count()==0,'German stacks not amber outlined when ineligible to repair')
 ok(page.locator('body.buildup-map-active').count()==1,'buildup-only hover safeguard active')
 page.locator('.hex-hit[data-hex="0101"]').hover(force=True)
 ok(page.locator('.hex-hit[data-hex="0101"]').get_attribute('data-buildup-action') is None,'0101 not a repair target')
 ok(page.evaluate('''() => {const p=document.querySelector('.hex-hit[data-hex="0101"]');const s=getComputedStyle(p);return s.stroke==='rgba(0, 0, 0, 0)'||s.stroke==='transparent'}'''),'hover over unrelated 0101 hex never paints amber stroke')
 # Park the pointer outside the board to make screenshot evidence unambiguous.
 page.mouse.move(374,178)
 REPAIR_SHOT.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(REPAIR_SHOT),animations='disabled',full_page=False)
 before=page.evaluate('HistoricalBrowserPreview.snapshot()')
 target=repair['repairByHex']['0405'][0]['unitId']
 ok(before['state']['units'][target]['strengthStatus']=='printed-reduced','target is actually reduced')
 page.locator('.hex-hit[data-hex="0405"]').click(force=True)
 after=page.evaluate('HistoricalBrowserPreview.snapshot()')
 ok(after['state']['units'][target]['strengthStatus']=='printed-full','hex click restored reduced unit via original human gateway')
 ok(page.locator('.official-counter[data-unit-id="'+target+'"]').get_attribute('data-damaged')=='false','resupply removes source red stripe')
 ok(after['actionCount']==before['actionCount']+1,'repair committed exactly one action')
 ok(page.locator('.official-counter[data-unit-id="'+target+'"] [data-phase-activated="true"]').count()==1,'repair sets Oberlabs-style activated checkmark')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Undo resupply accepted')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot()')==before,'Undo restores reduced counter and allowance')
 ok(page.locator('.hex-hit[data-hex="0405"]').get_attribute('data-buildup-action')=='repair','Undo restores legal resupply highlight')
 # Capture map placement, source engine counters, and source-valid entry glow.
 page.evaluate('HistoricalBrowserPreview.reset()')
 advance(page,2,'german-buildup')
 SHOT.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(SHOT),animations='disabled',full_page=False)
 ok(not errors,'no Chromium JavaScript errors '+str(errors))
 browser.close()
print('PASS v492 Kiev browser buildup map',N,'checks',SHOT)
