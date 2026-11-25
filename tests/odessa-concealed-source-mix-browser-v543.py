#!/usr/bin/env python3
"""Actual historical browser deployment/control acceptance, source images and mixed face identities."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import copy
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-source-setup-browser-v534.py')}
source=Path(ns['__file__']).read_text().split('checks=0')[0]
exec(source,ns)
checks=0
def ok(condition,why):
 global checks
 assert condition,why
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1380,'height':920},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['html'],wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=30000)
 api='window.HistoricalBrowserPreview'
 page.evaluate(api+'.enterSetup()')
 ok(page.locator('#setup-mix').is_visible(),'real Mix ten concealed Corps control appears')
 starting=page.evaluate(api+'.setupView()'); slots=starting['concealedSlots']
 ok(len(slots)==10 and not starting['concealedMixed'],'ten original untried source identities initially not mixed')
 # Only the original ten ?-6 photographed fronts; no reverse strength is added to interface.
 ok(all(starting['units'][i]['strengthStatus']=='untried' for i in slots),'untried fronts remain untried')
 page.locator('#setup-mix').click()
 shuffled=page.evaluate(api+'.setupView()')
 ok(shuffled['concealedMixed'],'player clicked real mix control')
 ok(len(set(shuffled['identityAssignments'].values()))==10,'all ten physical source faces retained once')
 ok(page.locator('#setup-mix').inner_text()=='Remix 10 concealed Corps','remix is exposed')
 ok('mixed' in page.locator('#status').inner_text(),'status reflects mixed physical sources')
 ok(all(shuffled['units'][i]['strengthStatus']=='untried' for i in slots),'no reverse strength revealed on setup board')
 ok(page.locator('#counter-overlay .official-counter').count()==36,'all 36 original vector counter templates still render')
 ok(page.locator('#map-art').evaluate('(el)=>el.complete&&el.naturalWidth>0'),'actual shared-engine map loads')
 saved=page.evaluate(api+'.save()')
 ok(saved['version']==2 and saved['concealedMixed'],'versioned mix save envelope')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',saved),'mixed deployment saved and restored')
 ok(page.evaluate(api+'.setupView()')['identityAssignments']==shuffled['identityAssignments'],'physical identities survive setup restore')
 page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-concealed-10-corps-mix-browser-v543.png'),full_page=False)
 stale=copy.deepcopy(saved);stale['identityAssignments'][slots[0]]='odessa-front-r01c01'
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',stale) is False,'corrupt physical source face rejected in browser')
 ok(page.evaluate(api+'.setupView()')['identityAssignments']==shuffled['identityAssignments'],'invalid restore cannot change setup')
 page.locator('#setup-ready').click()
 ok(page.locator('#setup-panel').is_hidden(),'mixed physical source lineup enters actual Turn 1')
 state=page.evaluate(api+'.snapshot()')
 ok(len(state['state']['units'])==36,'36 original ground units in campaign')
 for slot,physical in shuffled['identityAssignments'].items():
  ok(state['state']['units'][physical]['sourceFaceId']==physical,'real original source face recorded '+physical)
  ok(state['state']['units'][physical]['hex']==shuffled['placements'][slot],'actual source face assigned to shuffled slot '+slot)
 ok(state['state']['supportMarkers']['blackSeaFleet']['hex']=='1513','original Fleet fixed and untouched')
 ok(page.evaluate(api+".choose({type:'combat',action:{type:'finish-air-sea'}})"),'shared combat journal runs from mixed setup')
 journal=page.evaluate(api+'.save()')
 ok(journal['format']=='historical-custom-campaign','mixed setup and real campaign journal saved together')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',journal),'mixed campaign journal restores')
 ok(page.evaluate(api+'.snapshot()')['actionCount']==1,'committed combat remains after restore')
 ok(page.evaluate(api+'.undo()'),'Undo works after mixed campaign restore')
 ok(page.evaluate(api+'.snapshot()')['state']['units'][shuffled['identityAssignments'][slots[0]]]['hex']==shuffled['placements'][slots[0]],'Undo keeps mixed physical opening')
 ok(not errors,'No JS runtime errors '+repr(errors))
 browser.close()
print('PASS v543 real source-backed concealed setup browser:',checks,'Chromium assertions')
