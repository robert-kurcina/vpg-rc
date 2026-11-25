#!/usr/bin/env python3
"""CP171: real Chromium counter-based deployment / source validated swaps.

Local JSON transport only is mocked, not the exported map, counter artwork,
deployment engine, save logic, or browser interface.
"""
import base64, json, re
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'games/leningrad/native-preview/config.json').read_text())
assets={'config.json':CONFIG}
for key in ['map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy']:
 assets[CONFIG[key]]=json.loads((ROOT/CONFIG[key].removeprefix('../../../')).read_text())
html=(ROOT/'games/leningrad/native-preview/index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">',
 '<style>'+ (ROOT/'games/leningrad/native-preview/style.css').read_text()+'</style>')
uri='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'exports/leningrad.svg').read_bytes()).decode()
CONFIG['mapExport']=uri
html=html.replace('src="../../../exports/leningrad.svg"','src="'+uri+'"')
html=html.replace('<script src="../../../core/sync_sha256.js"></script>',
 '<script>window.__fixtures='+json.dumps(assets,separators=(',',':'))+';window.fetch=async p=>({ok:Object.hasOwn(__fixtures,p),json:async()=>__fixtures[p]});</script>'+
 '<script>'+ (ROOT/'core/sync_sha256.js').read_text().replace('</script','<\\/script')+'</script>')
for js in re.findall(r'<script src="\.\./\.\./\.\./core/([^\"]+)"\s*></script>',html):
 source=(ROOT/'core'/js).read_text().replace('</script','<\\/script')
 html=html.replace('<script src="../../../core/'+js+'"></script>','<script>'+source+'</script>')

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1640,'height':1020},accept_downloads=True)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_function('Boolean(window.HistoricalBrowserPreview)',timeout=30000)
 page.locator('[data-game-tab="settings"]').click()
 page.locator('#configure-setup').click()
 api='HistoricalBrowserPreview'
 def snap():return page.evaluate(api+'.setupView()')
 def select_map(id):page.locator(f'#counter-overlay [data-unit-id="{id}"] .counter-hit-area').dispatch_event('click')
 def select_pool(id):page.locator(f'#setup-choices [data-pool-id="{id}"]').click()
 def selected():return page.evaluate(api+'.setupSelection()')
 original=snap()
 assert len(original['units'])==19
 assert page.locator('#setup-choices select').count()==0,'Dropdown controls must be eliminated'
 assert page.locator('#counter-overlay .official-counter').count()==19
 assert page.locator('#setup-choices .setup-pool-counter').count()==8
 assert page.locator('#setup-choices .setup-pool-art').count()==8
 assert not set(original['placements']).intersection(
  page.locator('#setup-choices [data-pool-id]').evaluate_all('(a)=>a.map(x=>x.dataset.poolId)'))
 assert page.locator('#setup-choices [data-pool-id]').count()==len(set(
  page.locator('#setup-choices [data-pool-id]').evaluate_all('(a)=>a.map(x=>x.dataset.poolId)')))
 source_faces={f['faceId']:f['visualTranscription']['printedValues'] for f in assets[CONFIG['counterConfig']]['faces']['front']}
 g_six=next(id for id in original['allocation']['germanInitialInfantry'] if source_faces[id]=='6-4')
 reserve=next(id for id in original['allocation']['germanTurn4Infantry'] if source_faces[id]=='6-4')
 original_hex=original['placements'][g_six]
 # First click selects the actual map counter with the official highlighted outline.
 select_map(g_six)
 assert selected()=={'kind':'map','id':g_six}
 assert page.locator(f'#counter-overlay [data-unit-id="{g_six}"] .counter-selection-frame').get_attribute('stroke')=='#f1b932'
 select_pool(reserve)
 changed=snap()
 assert selected() is None
 assert changed['placements'][reserve]==original_hex
 assert g_six not in changed['placements']
 assert reserve in changed['units'] and g_six not in changed['units']
 assert g_six in changed['allocation']['germanTurn4Infantry']
 assert page.locator(f'[data-pool-id="{reserve}"]').count()==0,'Placed counter remained in pool'
 assert page.locator(f'[data-pool-id="{g_six}"]').count()==1,'Displaced counter not returned to pool'
 assert page.locator('#counter-overlay .official-counter').count()==19
 assert page.locator('#setup-choices .setup-pool-counter').count()==8
 # Click selected twice: cancel. Escape is a distinct keyboard cancel path.
 select_map(reserve);select_map(reserve)
 assert selected() is None
 select_pool(g_six)
 assert selected()=={'kind':'pool','id':g_six}
 page.keyboard.press('Escape')
 assert selected() is None
 # Pool first, map second is also a valid exchange (and reverses earlier swap).
 select_pool(g_six);select_map(reserve)
 assert snap()==original
 # Actual pointer dragging also works pool -> map -> pool, without native
 # HTML drag behavior or a mocked/alternate source assignment path.
 def xy_center(rect):return (rect['x']+rect['width']/2,rect['y']+rect['height']/2)
 def drag(start,end):
  sx,sy=start;tx,ty=end
  page.mouse.move(sx,sy);page.mouse.down();page.mouse.move(tx,ty,steps=10);page.mouse.up()
 pool_button=page.locator(f'#setup-choices [data-pool-id="{reserve}"]')
 pool_button.scroll_into_view_if_needed()
 drag(xy_center(pool_button.bounding_box()),
  xy_center(page.locator(f'#counter-overlay [data-unit-id="{g_six}"] .counter-hit-area').bounding_box()))
 assert snap()['placements'][reserve]==original_hex
 assert g_six not in snap()['placements']
 displaced_button=page.locator(f'#setup-choices [data-pool-id="{g_six}"]')
 displaced_button.scroll_into_view_if_needed()
 drag(xy_center(page.locator(f'#counter-overlay [data-unit-id="{reserve}"] .counter-hit-area').bounding_box()),
  xy_center(displaced_button.bounding_box()))
 assert snap()==original
 # Map-to-map position exchange keeps source IDs and allocation unchanged.
 army=original['allocation']['sovietFrontArmies'][0]
 infantry=original['allocation']['sovietFrontInfantryCorps'][0]
 before=snap()
 select_map(army);select_map(infantry)
 after=snap()
 assert after['placements'][army]==before['placements'][infantry]
 assert after['placements'][infantry]==before['placements'][army]
 assert after['allocation']==before['allocation']
 # Illegal pool swap is atomic, keeps selection, and displays a visible error.
 panzer=before['allocation']['germanInitialPanzer'][0]
 available_soviet=next(id for id in before['allocation']['sovietTurn4Army'])
 frozen=snap()
 select_map(panzer);select_pool(available_soviet)
 assert snap()==frozen
 assert selected()=={'kind':'map','id':panzer}
 assert page.locator('#message').is_visible()
 assert page.locator('#message').inner_text().strip()
 page.keyboard.press('Escape')
 # Clicking a legal destination hex uses the existing move validation.
 g_first=original['allocation']['germanInitialInfantry'][0]
 select_map(g_first)
 page.locator('#counter-overlay [data-hex="0511"]').dispatch_event('click')
 assert snap()['placements'][g_first]=='0511'
 assert selected() is None
 # Invalid location fails without partial occupancy mutations.
 before=snap()
 select_map(g_first)
 page.locator('#counter-overlay [data-hex="0209"]').dispatch_event('click')
 assert snap()==before and selected()=={'kind':'map','id':g_first}
 page.keyboard.press('Escape')
 # Map-to-map drag using actual mouse pointer events, including another
 # rendered counter as the drop target (not a mocked engine action).
 armies=before['allocation']['sovietFrontArmies']
 a,b=armies
 pos_before=snap()['placements'].copy()
 def center(id):
  rect=page.locator(f'#counter-overlay [data-unit-id="{id}"] .counter-hit-area').bounding_box()
  assert rect, id
  return (rect['x']+rect['width']/2,rect['y']+rect['height']/2)
 sx,sy=center(a);tx,ty=center(b)
 page.mouse.move(sx,sy);page.mouse.down();page.mouse.move(tx,ty,steps=8);page.mouse.up()
 assert snap()['placements'][a]==pos_before[b]
 assert snap()['placements'][b]==pos_before[a]
 # Known suppressed follow-up click must not reselect a counter after drag.
 assert selected() is None
 # Concealed Soviet counters still show front '?-6', not their source backs.
 page.locator('#setup-mix').click()
 assert snap()['concealedMixed'] is True
 assert page.locator('#setup-ready').is_enabled()
 labels=page.locator('#counter-overlay .official-counter [data-role="unit_id"]').all_text_contents()
 assert labels.count('*')==4
 assert all(not text.startswith('leningrad-') for text in labels)
 # Current source setup remains restorable; selection state is not persisted.
 pending=page.evaluate(api+'.save()')
 assert pending['format']=='historical-source-deployment'
 assert pending['placements']==snap()['placements']
 assert not errors,errors
 visual=ROOT/'rules/audit/visual/leningrad-counter-swap-v405.png';visual.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(visual),full_page=True,animations='disabled')
 page.locator('#setup-ready').click()
 assert page.evaluate(api+'.snapshot().cursor.turn')==1
 assert page.locator('#counter-overlay .official-counter').count()==19
 assert not errors,errors
 result={'checkpoint':171,'version':'v405','status':'PASS',
  'scenario':'Target: Leningrad','dropdownControls':0,'sourceCountersInitiallyDeployed':19,
  'sourceCountersInitiallyAvailable':8,'poolSourceExchange':True,'poolFirstExchange':True,
  'poolUniqueness':True,'mapPositionSwap':True,'invalidCrossFactionSwapAtomic':True,
  'clickToMoveWithinCapacity':True,'illegalHexAtomic':True,'clickTwiceAndEscapeCancel':True,
  'pointerDragMapToMap':True,'pointerDragMapPoolRoundTrip':True,'concealedFrontsRetained':4,'mixRequired':True,
  'turnOneHandoff':True,'pageErrors':errors,'screenshot':str(visual.relative_to(ROOT)),
  'transport':'Isolated Chromium with byte-identical engine modules, real generated map SVG and official source artwork'}
 (ROOT/'rules/audit/leningrad-counter-swap-browser-v405.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
 browser.close()
