#!/usr/bin/env python3
"""Actual source-photo shared-engine Chromium acceptance: German 6-4 reserve face selection."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import copy
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-source-setup-browser-v534.py')}
source=Path(ns['__file__']).read_text().split('checks=0')[0]
exec(source,ns)
checks=0
def ok(x,msg):
 global checks
 assert x,msg
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':1050},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['html'],wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=30000)
 api='window.HistoricalBrowserPreview'
 page.evaluate(api+'.enterSetup()')
 ok(page.locator('#setup-infantry-reserve').is_visible(),'German face selector is in actual deployment UI')
 ok(page.locator('#setup-infantry-reserve option').count()==8,'original sample plus seven source-valid 6-4 choices')
 ok(page.locator('#setup-infantry-reserve option[value="kiev-front-r02c06"]').count()==1,'source 49 Mtn variant included')
 ok(page.locator('#setup-infantry-reserve option[value="kiev-front-r01c04"]').count()==0,'8-4 German corps cannot become Turn 3 reinforcement')
 initial=page.evaluate(api+'.setupView()')
 ok(initial['infantryFaceSelection']['reserveFaceId']=='kiev-front-r01c07','sample 29 in reserve at first')
 page.locator('#setup-infantry-reserve').select_option('kiev-front-r02c06')
 selected=page.evaluate(api+'.setupView()')
 ok(selected['infantryFaceSelection']['swappedDeployedSlot']=='kiev-front-r02c06','real DOM 49 Mtn selection taken')
 ok(selected['infantryFaceSelection']['reserveFaceId']=='kiev-front-r02c06','49 Mtn becomes future German reinforcement')
 ok(selected['units']['kiev-front-r02c06']['sourceFaceId']=='kiev-front-r01c07','29 source photo appears in chosen opening slot')
 ok(selected['placements']==initial['placements'],'source selection changes faces, not map positions')
 ok(page.locator('#counter-overlay [data-unit-id="kiev-front-r02c06"]').count()==1,'selected Polish/Romanian slot still rendered')
 ok(page.locator('#counter-overlay .official-counter').count()==36,'36 starting original counter templates preserved')
 saved=page.evaluate(api+'.save()')
 ok(saved['version']==3,'changed source face produces v3 setup save')
 ok(saved['infantryReserveSlot']=='kiev-front-r02c06','save binds selected 49 Mtn source face')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',saved),'valid changed counter-face setup restores')
 ok(page.evaluate(api+'.setupView()')['infantryFaceSelection']['reserveFaceId']=='kiev-front-r02c06','restored setup retains 49 Mtn reserve')
 bad=copy.deepcopy(saved);bad['infantryReserveSlot']='kiev-front-r01c04'
 ok(not page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',bad),'checksum-tampered 8-4 swap rejected')
 ok(page.evaluate(api+'.setupView()')['infantryFaceSelection']['reserveFaceId']=='kiev-front-r02c06','invalid save does not mutate editor')
 page.locator('#setup-mix').click()
 mixed=page.evaluate(api+'.setupView()')
 ok(mixed['concealedMixed'],'visible Mix control still operates alongside German source selection')
 ok(mixed['infantryFaceSelection']['reserveFaceId']=='kiev-front-r02c06','German source selection survives Soviet mixing')
 page.locator('#setup-infantry-reserve').scroll_into_view_if_needed()
 (ROOT/'rules/audit/visual').mkdir(exist_ok=True,parents=True)
 page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-german-6-4-face-reserve-browser-v544.png'),full_page=False)
 page.locator('#setup-ready').click()
 ok(page.locator('#setup-panel').is_hidden(),'actual Begin Turn 1 enters shared campaign')
 current=page.evaluate(api+'.snapshot()')
 ok(len(current['state']['units'])==36,'correct starting physical counter count')
 ok('kiev-front-r01c07' in current['state']['units'],'physical 29 joined starting force')
 ok('kiev-front-r02c06' not in current['state']['units'],'physical 49 Mtn is held for Turn 3')
 ok(current['state']['units']['kiev-front-r01c07']['hex']==selected['placements']['kiev-front-r02c06'],'29 occupies selected starting hex')
 ok(current['state']['units']['kiev-front-r01c07']['reverseFaceId']=='kiev-back-r01c02','original 29 photographed back face preserved')
 ok(page.evaluate(api+".choose({type:'combat',action:{type:'finish-air-sea'}})"),'normal first combat journal continues')
 ok(page.evaluate(api+'.snapshot()')['actionCount']==1,'source face selection runs through ordinary combat')
 game=page.evaluate(api+'.save()')
 ok(game['format']=='historical-custom-campaign' and game['deployment']['version']==3,'custom game save binds source face and combat actions')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',game),'actual played mixed swapped campaign restores')
 ok('kiev-front-r02c06' not in page.evaluate(api+'.snapshot()')['state']['units'],'49 Mtn remains reserve after restore')
 ok(page.evaluate(api+'.undo()'),'Undo after selected-face campaign restore')
 ok(page.evaluate(api+'.snapshot()')['actionCount']==0,'Undo retains chosen starting force while reversing action')
 ok(page.evaluate(api+'.snapshot()')['state']['units']['kiev-front-r01c07']['hex']==selected['placements']['kiev-front-r02c06'],'Undo preserves original photographed selected-face opening')
 ok(not errors,'no browser runtime errors: '+repr(errors))
 # Source selector also remains usable at mobile/touch width. Actual browser
 # controls are checked, not a simulated prototype.
 page.set_viewport_size({'width':768,'height':920})
 page.evaluate(api+'.reset()')
 page.evaluate(api+'.enterSetup()')
 ok(page.locator('#setup-infantry-reserve').is_visible(),'touch viewport retains face selection control')
 page.locator('#setup-infantry-reserve').select_option('kiev-front-r01c08')
 ok(page.evaluate(api+'.setupView()')['infantryFaceSelection']['reserveFaceId']=='kiev-front-r01c08','mobile select changes physical Turn 3 source')
 ok(page.locator('#setup-panel').evaluate('(el)=>el.scrollWidth<=el.clientWidth+2'),'mobile setup has no internal horizontal overflow')
 browser.close()
print('PASS v544 actual browser German source face / Turn 3 selection:',checks,'Chromium assertions')
