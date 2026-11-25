from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'tests/historical-browser-player-save-v654.py'
ns={'__file__':str(source)}
exec(source.read_text().split('with sync_playwright() as pw:')[0],ns)
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(12000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['document']('games/arduous/native-preview/index.html'),wait_until='domcontentloaded',timeout=30000)
 page.wait_for_function('!!window.HistoricalBrowserPreview')
 save=lambda:page.evaluate('HistoricalBrowserPreview.save()')
 snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
 page.locator('#filter').fill('impossible-filter')
 assert page.locator('#actions button').filter(has_text='Declare no battles').count()==1
 page.locator('#actions button').filter(has_text='Declare no battles').click()
 for _ in range(12):
  v=page.evaluate('HistoricalBrowserPreview.view()')
  proposals=v.get('proposals',[])
  if proposals:break
  commands=v['commands']
  phase=next((a for a in commands if (a.get('action',{}).get('type') or a['type']).startswith('finish-')),None)
  assert phase,(v['phaseKind'],commands[:2])
  assert page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',phase)
 else:raise AssertionError('no combat proposals reached')
 p=next(p for p in proposals if sum(q['defenderHex']==p['defenderHex'] for q in proposals)>1)
 before=save()
 page.locator('#filter').fill(p['defenderHex'])
 boxes=page.locator('#battle-proposals input[type=checkbox]')
 boxes.first.check()
 assert boxes.nth(1).is_disabled()
 assert save()==before
 page.locator('#filter').fill('impossible-filter')
 assert '1 selected' in page.locator('#battle-filter-note').inner_text()
 page.locator('#clear-battle-selection').click()
 assert '0 selected' in page.locator('#battle-filter-note').inner_text()
 assert save()==before
 page.locator('#filter').fill(p['defenderHex']); boxes.first.check()
 page.locator('#commit-battles').click()
 assert snap()['combat']['status']=='committed'
 declared=save();count=snap()['actionCount']
 target=page.locator('.battle-target-hex').first
 assert target.count()==1
 target.press('Enter')
 assert snap()['combat']['status']=='battle-selected'
 assert snap()['actionCount']==count+1
 page.locator('#undo').click();assert save()==declared
 assert not errors,errors
 print('PASS phase controls under filtering, conflict guard, clear, read-only selection, committed target selection and exact undo',flush=True)
 browser.close()
