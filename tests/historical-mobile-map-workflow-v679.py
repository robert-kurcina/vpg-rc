from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'tests/historical-browser-player-save-v654.py'
ns={'__file__':str(source)}
exec(source.read_text().split('with sync_playwright() as pw:')[0],ns)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':820,'height':1180},has_touch=True,is_mobile=True,device_scale_factor=1);page.set_default_timeout(10000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['document']('games/arduous/native-preview/index.html'),wait_until='domcontentloaded',timeout=30000)
 page.wait_for_function('!!window.HistoricalBrowserPreview')
 page.locator('#mission-menu-toggle').tap()
 bounds=page.locator('#mission-menu').bounding_box();assert bounds['x']>=0 and bounds['x']+bounds['width']<=820
 page.get_by_role('button',name='See CRT',exact=True).tap();assert page.locator('#game-reference-tab-crt').get_attribute('aria-selected')=='true'
 page.get_by_role('button',name='Close rules and charts').tap();assert not page.locator('#game-reference-dialog').is_visible()
 snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
 save=lambda:page.evaluate('HistoricalBrowserPreview.save()')
 for _ in range(6):
  commands=page.evaluate('HistoricalBrowserPreview.view().commands')
  if any(a['type']=='declare-ground-move' for a in commands):break
  action=next(a for a in commands if a.get('action',{}).get('type') in ['commit-battles','finish-combat'] or a['type']=='finish-phase')
  assert page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',action)
 before=save();state=snap(); ledger=state['state']['cityControl']
 actual=page.locator('[data-city-control]').evaluate_all('(nodes)=>Object.fromEntries(nodes.map(n=>[n.dataset.cityControl,n.dataset.cityOwner]))')
 assert actual==page.evaluate('Object.fromEntries(__fixtures[__fixtures["config.json"].map].cells.filter(c=>c.city?.name).map(c=>[c.id,HistoricalBrowserPreview.snapshot().state.cityControl[c.city.name]]).filter(([id,owner])=>owner))'),(actual,ledger)
 moves=page.evaluate('HistoricalBrowserPreview.view().commands.filter(a=>a.type==="declare-ground-move")')
 assert moves
 units=state['state']['units']; occupied={u.get('hex') for u in units.values() if u.get('strengthStatus') not in ('eliminated','dead')}
 move=next(a for a in moves if sum(b['request']['unitId']==a['request']['unitId'] and b['request']['path'][-1]==a['request']['path'][-1] for b in moves)==1 and a['request']['path'][-1] not in occupied and page.evaluate('(h)=>HistoricalBrowserPreview.stackTop(h)',units[a['request']['unitId']]['hex'])==a['request']['unitId'])
 uid=move['request']['unitId'];dest=move['request']['path'][-1]
 # Tap the top counter and an empty destination, with real touch hit testing.
 unit=page.locator('[data-unit-id="'+uid+'"]');unit.tap()
 assert page.locator('.movement-target-hex').count()>0
 assert save()==before
 page.locator('[data-unit-id="'+uid+'"]').tap();assert page.locator('.movement-target-hex').count()==0;assert save()==before
 unit=page.locator('[data-unit-id="'+uid+'"]');unit.tap()
 page.locator('.movement-target-hex[data-hex="'+dest+'"]').tap()
 assert snap()['actionCount']==state['actionCount']+1
 assert snap()['pendingGround'] is not None
 assert page.locator('body').get_attribute('data-mobile-controls-open')=='true'
 assert page.locator('#game-sidebar').get_attribute('data-active-tab')=='play'
 assert page.locator('#actions button').filter(has_text='resolve ground move').count()==1
 resolve=page.locator('#actions button').filter(has_text='resolve ground move')
 page.wait_for_timeout(250)
 assert resolve.evaluate('e=>{const r=e.getBoundingClientRect();const h=document.querySelector(".game-tab-strip").getBoundingClientRect();return r.top>=h.bottom&&r.bottom<=innerHeight}')
 resolve.tap()
 assert snap()['state']['units'][uid]['hex']==dest
 assert snap()['actionCount']==state['actionCount']+2
 actual=page.locator('[data-city-control]').evaluate_all('(nodes)=>Object.fromEntries(nodes.map(n=>[n.dataset.cityControl,n.dataset.cityOwner]))')
 assert actual==page.evaluate('Object.fromEntries(__fixtures[__fixtures["config.json"].map].cells.filter(c=>c.city?.name).map(c=>[c.id,HistoricalBrowserPreview.snapshot().state.cityControl[c.city.name]]).filter(([id,owner])=>owner))')
 resolved_move=save()
 page.locator('#undo').tap();page.locator('#undo').tap();assert save()==before
 page.locator('#redo').tap();page.locator('#redo').tap();assert save()==resolved_move
 page.locator('#undo').tap();page.locator('#undo').tap();assert save()==before
 page.locator('.mobile-drawer-close').tap();assert page.locator('#game-sidebar').evaluate('e=>e.inert')
 assert page.locator('#map-scroll').bounding_box()['height']>1000
 # Advance using the same authoritative phase commands as the desktop fixture.
 page.locator('.mobile-controls-launcher').tap()
 for _ in range(12):
  v=page.evaluate('HistoricalBrowserPreview.view()')
  proposals=v.get('proposals',[])
  if proposals:break
  phase=next((a for a in v['commands'] if (a.get('action',{}).get('type') or a['type']).startswith('finish-')),None)
  assert phase,(v['phaseKind'],v['commands'][:2])
  assert page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',phase)
 else:raise AssertionError('no combat proposals reached')
 page.locator('.mobile-drawer-close').tap()
 before_combat=save()
 target_hex=proposals[0]['defenderHex']
 defender=page.evaluate('(h)=>HistoricalBrowserPreview.stackTop(h)',target_hex)
 if defender:page.locator('[data-unit-id="'+defender+'"]').tap()
 else:page.locator('.hex-hit[data-hex="'+target_hex+'"]').tap()
 assert page.locator('body').get_attribute('data-mobile-controls-open')=='true'
 assert page.locator('#filter').input_value()==target_hex
 assert save()==before_combat
 page.locator('#battle-proposals input[type=checkbox]').first.check()
 page.locator('#commit-battles').tap()
 assert snap()['combat']['status']=='committed'
 declared=save()
 page.locator('.mobile-drawer-close').tap()
 if defender:page.locator('[data-unit-id="'+defender+'"]').tap()
 else:page.locator('.battle-target-hex[data-hex="'+target_hex+'"]').tap()
 assert snap()['combat']['status']=='battle-selected'
 assert page.locator('body').get_attribute('data-mobile-controls-open')=='true'
 page.locator('#undo').tap();assert save()==declared
 assert not errors,errors
 print('PASS Arduous touch selection, cancellation, contextual drawer, explicit resolution, exact undo/redo, map-first return and combat panel handoff',flush=True)
 page.close()
 browser.close()
