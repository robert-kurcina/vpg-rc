"""Actual shared-engine browser Settings and trusted save restoration; transport fixture only."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=ROOT/'tests/historical-browser-player-save-v654.py';ns={'__file__':str(source)}
exec(source.read_text().split('with sync_playwright() as pw:')[0],ns)
paths={'arduous':'games/arduous/native-preview/index.html','leningrad':'games/leningrad/native-preview/index.html','kiev':'games/kiev/setup-preview/index.html','kiev-odessa':'games/kiev-odessa/experimental-preview/index.html'}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for scenario,path in paths.items():
  if ns['args'].scenario and scenario not in ns['args'].scenario:continue
  page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(20000)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(ns['document'](path),wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=30000)
  save=lambda:page.evaluate('HistoricalBrowserPreview.save()');restore=lambda s:page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',s)
  historical=save();assert page.locator('#victory-mode').input_value()=='historical'
  page.locator('#mission-settings').click();page.locator('#victory-mode').select_option('graduated');page.locator('#advanced-crt').check();assert save()==historical
  page.locator('[data-game-tab=play]').click();page.locator('#new-game').click()
  graded=save();assert graded['campaign']['bindings']['scopeHash']!=historical['campaign']['bindings']['scopeHash']
  assert 'experimental victory' in page.locator('#graduated-score').inner_text()
  page.locator('#ai-step').click();after=save();assert after!=graded
  page.locator('#undo').click();assert save()==graded
  page.locator('#redo').click();assert save()==after
  assert restore(historical) and save()==historical;assert page.locator('#victory-mode').input_value()=='historical';assert page.locator('#graduated-score').count()==0
  assert restore(graded) and save()==graded;assert page.locator('#victory-mode').input_value()=='graduated';assert page.locator('#advanced-crt').is_checked();assert page.locator('#graduated-score').count()==1
  assert not errors,errors
  print('PASS',scenario,'historical default, next-game experimental graduated and Advanced CRT, exact Undo/Redo and bidirectional trusted restore',flush=True)
  page.close()
 browser.close()
