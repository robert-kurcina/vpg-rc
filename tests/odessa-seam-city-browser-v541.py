#!/usr/bin/env python3
"""Chromium real shared-engine movement UX using complete source-replay saves
at the three real campaign turns, avoiding slow intermediate browser redraws."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-contested-seven-turn-browser-v537.py')}
exec(Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0],ns)
checks=0
def ok(value,label):
 global checks
 assert value,label
 checks+=1
plans={1:['1010','1011'],2:['1011','1112'],3:['1112','1211']}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':980},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['html'],wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=35000)
 api='window.HistoricalBrowserPreview'
 snap=lambda:page.evaluate(api+'.snapshot()')
 ok(page.locator('#map-art').evaluate('(e)=>e.complete&&e.naturalWidth>0'),'Real shared-renderer map export decoded')
 ok(page.locator('[data-unit-id="kiev-odessa/romanian-cavalry-corps"]').count()==1,'Original cavalry rendered as source SVG counter')
 for turn,route in plans.items():
  savefile=ROOT/f'rules/audit/saves/odessa-pre-movement-turn{turn}-v541.json'
  saved=json.loads(savefile.read_text())
  ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',saved),'Source-complete Turn '+str(turn)+' human campaign replays in Chromium')
  state=snap()
  ok(state['cursor']['turn']==turn,'Correct historical turn '+str(turn))
  ok(state['phaseId']==('german-special-movement' if turn==1 else 'german-movement'), 'Correct phase for Turn '+str(turn))
  ok(state['state']['units']['kiev-odessa/romanian-cavalry-corps']['hex']==route[0], 'Counter begins at approved source hex')
  ok(state['state']['cityControl']['Chisinau']=='soviet','Before capture city still Soviet')
  # The click executes only an exact source-catalogued order, not a synthetic move.
  phrase=' through '+' → '.join(route)
  page.locator('#filter').fill(' → '.join(route))
  matches=page.locator('#actions button').filter(has_text=phrase)
  ok(matches.count()==1,'Player Orders offers '+str(route))
  matches.click(timeout=15000)
  ok(snap()['state']['units']['kiev-odessa/romanian-cavalry-corps']['hex']==route[0], 'Declaration is not premature movement')
  page.locator('#filter').fill('')
  resolve=page.locator('#actions button').filter(has_text='resolve ground move')
  ok(resolve.count()==1,'Actual movement resolution control available')
  resolve.click(timeout=15000)
  state=snap()
  ok(state['state']['units']['kiev-odessa/romanian-cavalry-corps']['hex']==route[-1], 'Counter really moved to '+route[-1])
  expected='german' if turn==3 else 'soviet'
  ok(state['state']['cityControl']['Chisinau']==expected,'Committed move updates city control only on capture')
  notice=page.locator('#message').inner_text()
  if turn==3:
   ok('Chisinau: soviet → german' in notice,'Visible city capture notice uses actual changed ledger')
   ok(page.locator('[data-unit-id="kiev-odessa/romanian-cavalry-corps"]').count()==1,'Captured city displays original cavalry artwork')
   page.locator('[data-unit-id="kiev-odessa/romanian-cavalry-corps"]').scroll_into_view_if_needed(timeout=5000)
   page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-seam-chisinau-browser-v541.png'),full_page=False)
  else:ok('City control changed' not in notice,'No fabricated city capture notice on non-city movement')
  if turn==3:
   post=page.evaluate(api+'.save()');before=state
   ok(page.evaluate(api+'.undo()'),'Captured-city action supports actual browser Undo')
   ok(snap()['state']['units']['kiev-odessa/romanian-cavalry-corps']['hex']==route[0],'Undo restores pre-capture position')
   ok(snap()['state']['cityControl']['Chisinau']=='soviet','Undo restores Soviet city control')
   ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',post),'Post-capture human Save/Restore')
   ok(snap()==before,'Complete captured city and counter positions restored')
 ok(not errors,'No browser JS exceptions: '+repr(errors))
 browser.close()
print('PASS v541 actual three-turn movement/city Chromium:',checks,'assertions')
