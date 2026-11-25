#!/usr/bin/env python3
"""Actual shared-engine Kiev–Odessa browser Settings toggle and source Kovel CRT.
Fixtures embed original source engine assets using the established offline loader.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
namespace={'__file__':str(ROOT/'tests/odessa-mixed-seam-city-seven-turn-browser-v549.py')}
exec(Path(namespace['__file__']).read_text().split('with sync_playwright() as pw:')[0],namespace)
checks=0
def ok(value,message):
 global checks
 assert value,message
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1350,'height':1040})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(namespace['html'],wait_until='load',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview && !!document.querySelector("#advanced-crt")',timeout=40000)
 api='window.HistoricalBrowserPreview'
 view=lambda:page.evaluate(api+'.view()')
 snap=lambda:page.evaluate(api+'.snapshot()')
 choose=lambda a:page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',a)
 ok(not page.locator('#advanced-crt').is_checked(),'Standard CRT default unchecked')
 page.locator('[data-game-tab="settings"]').click()
 ok(page.locator('#advanced-crt').is_visible(),'Advanced CRT toggle visible in Settings')
 page.locator('#historical-crt-settings details[data-crt-variant="advanced"] summary').click()
 ok(page.locator('.crt-reference-table[data-crt-variant="advanced"] tr').count()==7,'Advanced chart 6 dice and heading')
 ok(page.locator('.crt-reference-table[data-crt-variant="advanced"] tr').nth(4).inner_text().count('EX')>=1,'Advanced chart cell shown')
 page.locator('#advanced-crt').check()
 ok(page.locator('#advanced-crt').is_checked(),'User checked Advanced CRT')
 ok('New selection will apply' in page.locator('#crt-mode-note').inner_text() if page.locator('#crt-mode-note').count() else 'New selection will apply' in page.locator('#historical-crt-settings').inner_text(),'Toggle stages next-game variant')
 page.locator('[data-game-tab="play"]').click()
 page.locator('#new-game').click()
 ok(page.locator('#historical-crt-settings').inner_text().find('Current game: Advanced CRT')>=0,'Advanced CRT bound to new game')
 def setup_battle():
  for action in [
   {'type':'combat','action':{'type':'finish-air-sea'}},
   {'type':'combat','action':{'type':'commit-battles','battles':[{'defenderHex':'0502','attackers':['kiev-front-r02c03']}]}},
   {'type':'combat','action':{'type':'select-battle','defenderHex':'0502'}},
   {'type':'combat','action':{'type':'commit-ground-air','faceId':None}}
  ]:
   ok(choose(action),'Valid Kovel combat action '+str(action)+'; '+page.locator('#message').inner_text())
 setup_battle()
 ok(page.evaluate('HistoricalBrowserPreview.roll(4)'),'Advanced Kovel die 4 accepted')
 ok(view()['crtOutcome']=='EX','Advanced Kovel die 4 is EX')
 advanced_save=page.evaluate(api+'.save()')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',advanced_save),'Advanced pending save restored')
 ok(view()['crtOutcome']=='EX','Advanced saved EX preserved')
 page.locator('[data-game-tab="settings"]').click()
 page.screenshot(path=str(ROOT/'rules/audit/visual/advanced-crt-settings-kiev-odessa-v557.png'),full_page=False)
 page.locator('#advanced-crt').uncheck()
 ok('New selection will apply' in page.locator('#historical-crt-settings').inner_text(),'Midgame toggle does not alter active rules')
 ok(view()['crtOutcome']=='EX','Midgame selection leaves committed outcome unchanged')
 page.locator('[data-game-tab="play"]').click()
 page.locator('#new-game').click()
 ok('Current game: Standard CRT' in page.locator('#historical-crt-settings').inner_text(),'New game returned to standard')
 setup_battle()
 ok(page.evaluate('HistoricalBrowserPreview.roll(4)'),'Standard Kovel die 4 accepted')
 ok(view()['crtOutcome']=='NE','Standard Kovel die 4 NE unchanged')
 standard_save=page.evaluate(api+'.save()')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',advanced_save),'Advanced save recognized independently of current toggle')
 ok(page.locator('#advanced-crt').is_checked(),'Restored Advanced variant reflected in settings')
 ok(view()['crtOutcome']=='EX','Restored alternate uses correct result')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',standard_save),'Standard save recognized independently of current toggle')
 ok(not page.locator('#advanced-crt').is_checked(),'Restored Standard variant reflected in settings')
 ok(view()['crtOutcome']=='NE','Standard restored NE result unchanged')
 ok(not errors,'No Chromium errors '+str(errors))
 browser.close()
print('PASS v557 Kiev–Odessa Advanced CRT Settings:',checks,'Chromium assertions')
