#!/usr/bin/env python3
"""Checkpoint 140: actual Chromium DOM, shared engine/UI and real source files.
Only the browser's fetch transport is provided from local files; this does not
claim a hosted network navigation acceptance test.
"""
from pathlib import Path
from tempfile import gettempdir
from playwright.sync_api import sync_playwright
from native_browser_asset_fixture import install_fetch
import json, hashlib

root=Path(__file__).resolve().parent.parent
html=(root/'games/battle-for-moscow/native-preview/index.html').read_text()
html=html[:html.index('<script src=')]+html[html.index('</body>',html.index('<script src=')):]
paths={**{f'../{k}.json':f'games/battle-for-moscow/{k}.json'
 for k in ['game','map','units','deployments','rules','objectives']},
 'config.json':'games/battle-for-moscow/native-preview/config.json',
 'ui-config.json':'games/battle-for-moscow/native-preview/ui-config.json',
 '../../../maps/battle-for-moscow.json':'maps/battle-for-moscow.json',
 '../../../maps/registry.json':'maps/registry.json'}
data={k:json.loads((root/v).read_text()) for k,v in paths.items()}
scripts=['modules.js','roster.js','engine.js','native_preview_config.js','native_session_actions.js',
 'sync_sha256.js','native_session_save.js','session.js','native_session_ai.js','factions.js',
 'presentation.js','terrain_tiles.js','official_counter_templates.js','counter_visuals.js',
 'native_combat_ui.js','native_tournament_scoring.js','native_city_status.js','native_browser_view.js']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1700,'height':1000})
 errors=[]
 page.on('pageerror',lambda error:errors.append(str(error)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(page,data,root)
 for script in scripts:page.add_script_tag(content=(root/'core'/script).read_text())
 page.evaluate('window.__nativePreviewReady')
 assert page.locator('#city-status [data-city-hex]').count()==11
 page.locator('#city-details summary').click()
 assert page.locator('#city-status [data-city-hex="1103"] th').inner_text().startswith('Moscow (1103) *')
 assert page.locator('#city-status [data-city-hex="1103"] [data-city-owner]').get_attribute('data-city-owner')=='soviet'
 assert 'Germany: 2' in page.locator('#city-status .city-summary').inner_text()
 assert 'Soviet Union: 9' in page.locator('#city-status .city-summary').inner_text()
 assert 'reference score only' in page.locator('#city-status').inner_text()
 assert 'optional reserve redeployment is a conservative, unverified candidate' in page.locator('#city-status').inner_text()
 assert 'Informational only' in page.locator('#city-status').inner_text()
 assert 'City control · Germany: 2' in page.locator('#city-summary-inline').inner_text()
 assert page.locator('#city-status').is_visible()
 page.locator('#city-status').screenshot(path=str(Path(gettempdir())/'b4m-native-city-table-smoke-v376.png'))
 page.screenshot(path=str(Path(gettempdir())/'b4m-native-city-panel-initial-smoke-v376.png'),full_page=True)
 initial=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 # Put the live session in a legal synthetic movement fixture, without
 # claiming this was reached from a historical human sequence.
 page.evaluate('''() => {
   const s=__nativePreview.getSession().state;
   s.units.find(u=>u.id==='g24').position={x:6,y:1};
   s.phaseIndex=WargameCore.phasesFor(__nativePreview.configuration(),'german').findIndex(
    p=>p.kind==='move'&&p.movementMode==='normal');
   __nativePreview.render();
 }''')
 before=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 assert before!=initial
 assert page.locator('#city-status [data-city-hex="0602"] [data-city-owner]').get_attribute('data-city-owner')=='soviet'
 page.locator('[data-native-unit="g24"] .counter-hit-area').click()
 assert page.locator('.native-option-halo').count()>0
 assert page.locator('[data-board-cell="0602"]').count()==1
 page.locator('[data-board-cell="0602"]').click()
 assert page.locator('#city-status [data-city-hex="0602"] [data-city-owner]').get_attribute('data-city-owner')=='german'
 assert 'g24' in page.locator('#city-status [data-city-hex="0602"]').inner_text()
 assert 'Germany: 3' in page.locator('#city-status .city-summary').inner_text()
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')!=before
 page.locator('#undo').click()
 assert page.locator('#city-status [data-city-hex="0602"] [data-city-owner]').get_attribute('data-city-owner')=='soviet'
 assert 'Germany: 2' in page.locator('#city-status .city-summary').inner_text()
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')==before
 assert not errors,errors
 page.screenshot(path=str(Path(gettempdir())/'b4m-native-city-panel-smoke-v376.png'),full_page=True)
 browser.close()
 print(json.dumps({'status':'PASS','checkpoint':140,'version':'v374','cityRows':11,
  'domCaptureAndUndo':True,'realSourceScripts':len(scripts),'browser':'isolated Chromium; authentic image bytes; mocked fetch transport',
  'productionEngine':'legacy-b4m-v1'}))
