from pathlib import Path
from playwright.sync_api import sync_playwright
import sys
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'tests/historical-browser-player-save-v654.py'
ns={'__file__':str(source)}
exec(source.read_text().split('with sync_playwright() as pw:')[0],ns)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(10000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['document']('games/arduous/native-preview/index.html'),wait_until='domcontentloaded',timeout=30000)
 page.wait_for_function('!!window.HistoricalBrowserPreview')
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
 move=next(a for a in moves if sum(b['request']['unitId']==a['request']['unitId'] and b['request']['path'][-1]==a['request']['path'][-1] for b in moves)==1)
 uid=move['request']['unitId'];dest=move['request']['path'][-1]
 # Use keyboard selection, which exercises the actual map event handlers even when a stack covers a destination.
 unit=page.locator('[data-unit-id="'+uid+'"]');unit.focus();unit.press('Enter')
 assert page.locator('.movement-target-hex').count()>0
 assert save()==before
 page.keyboard.press('Escape');assert page.locator('.movement-target-hex').count()==0;assert save()==before
 unit=page.locator('[data-unit-id="'+uid+'"]');unit.focus();unit.press('Enter')
 page.locator('.movement-target-hex[data-hex="'+dest+'"]').press('Enter')
 assert snap()['actionCount']==state['actionCount']+1
 assert snap()['pendingGround'] is not None
 assert page.locator('#actions button').filter(has_text='resolve ground move').count()==1
 page.locator('#actions button').filter(has_text='resolve ground move').click()
 assert snap()['state']['units'][uid]['hex']==dest
 assert snap()['actionCount']==state['actionCount']+2
 actual=page.locator('[data-city-control]').evaluate_all('(nodes)=>Object.fromEntries(nodes.map(n=>[n.dataset.cityControl,n.dataset.cityOwner]))')
 assert actual==page.evaluate('Object.fromEntries(__fixtures[__fixtures["config.json"].map].cells.filter(c=>c.city?.name).map(c=>[c.id,HistoricalBrowserPreview.snapshot().state.cityControl[c.city.name]]).filter(([id,owner])=>owner))')
 page.locator('#undo').click();page.locator('#undo').click();assert save()==before
 assert not errors,errors
 print('PASS Arduous city ledger, read-only selection, cancellation, direct declaration, explicit resolution and exact undo',flush=True)
 page.close()
 for scenario,route in [('leningrad','games/leningrad/native-preview/index.html'),('kiev','games/kiev/setup-preview/index.html'),('kiev-odessa','games/kiev-odessa/experimental-preview/index.html')]:
  page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(10000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(ns['document'](route),wait_until='domcontentloaded',timeout=30000)
  page.wait_for_function('!!window.HistoricalBrowserPreview')
  ledger=page.evaluate('HistoricalBrowserPreview.snapshot().state.cityControl')
  owners=page.locator('[data-city-control]').evaluate_all('(nodes)=>Object.fromEntries(nodes.map(n=>[n.dataset.cityControl,n.dataset.cityOwner]))')
  assert owners==page.evaluate('Object.fromEntries(__fixtures[__fixtures["config.json"].map].cells.filter(c=>c.city?.name).map(c=>[c.id,HistoricalBrowserPreview.snapshot().state.cityControl[c.city.name]]).filter(([id,owner])=>owner))'),(scenario,owners,ledger)
  assert not errors,errors
  print('PASS',scenario,'initial city ledger',flush=True);page.close()
 browser.close()
