#!/usr/bin/env python3
"""A historical campaign save is bound to source/configuration hashes.
Legacy v541 saves must fail closed after the source inventory/config changed;
this must not be confused with the v544 deployment-only save compatibility.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-mixed-selected-seven-turn-browser-v548.py')}
exec(Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0],ns)
checks=0
def ok(cond,label):
 global checks
 assert cond,label
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':900})
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content(ns['html'],wait_until='load',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=35000)
 before=page.evaluate('HistoricalBrowserPreview.snapshot()')
 for turn in range(1,4):
  file=ROOT/f'rules/audit/saves/odessa-pre-movement-turn{turn}-v541.json'
  legacy=json.loads(file.read_text())
  ok(legacy.get('format')=='historical-human-decision-session','original human envelope present')
  result=page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',legacy)
  ok(result is False,'outdated campaign configuration rejected for legacy Turn '+str(turn))
  ok('Campaign source/configuration mismatch' in page.locator('#message').inner_text(),
     'visible, specific source mismatch error for legacy Turn '+str(turn))
  ok(page.evaluate('HistoricalBrowserPreview.snapshot()')==before,
     'invalid legacy replay leaves active campaign unchanged for Turn '+str(turn))
 current=page.evaluate('HistoricalBrowserPreview.save()')
 ok(page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',current) is True,'current active campaign remains restorable')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot()')==before,'current roundtrip exact')
 ok(not errors,'no browser JS errors')
 browser.close()
print('PASS v549 fail-closed outdated campaign saves:',checks,'Chromium assertions')
