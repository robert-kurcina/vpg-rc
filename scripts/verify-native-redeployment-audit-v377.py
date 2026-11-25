#!/usr/bin/env python3
"""Checkpoint 142: isolated real Chromium reserve-redeployment interactions.
Fetch transport is backed by authentic local files due hosted-browser restrictions.
This verifies a conservative policy candidate, NOT upstream tournament parity.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from native_browser_asset_fixture import install_fetch
root=Path(__file__).resolve().parent.parent
html=(root/'games/battle-for-moscow/native-preview/index.html').read_text()
html=html[:html.index('<script src=')]+html[html.index('</body>',html.index('<script src=')):]
paths={**{f'../{k}.json':f'games/battle-for-moscow/{k}.json' for k in ['game','map','units','deployments','rules','objectives']},
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
 page=browser.new_page(viewport={'width':1850,'height':1020})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(page,data,root)
 for script in scripts:page.add_script_tag(content=(root/'core'/script).read_text())
 page.evaluate('window.__nativePreviewReady')
 assert page.evaluate('WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).kind')=='combat'
 assert page.locator('#map>svg image').count()==40
 assert page.locator('[data-native-unit="s16"]').count()==1
 page.locator('#candidate-redeployment').check()
 page.locator('#new-game').click()
 assert 'SOVIET RESERVES (pre-combat)' in page.locator('#phase-status').inner_text()
 assert page.locator('#finish-phase').inner_text()=='Confirm reserves'
 assert page.locator('#unit-selection button').count()==3
 before=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 unit=page.locator('#unit-selection button').filter(has_text='s16')
 unit.click()
 assert page.locator('.native-option-halo').count()>80
 assert page.locator('#redeployment-audit').count()==1
 audit=page.locator('#redeployment-audit').inner_text()
 assert 'candidates' in audit and 'west/on column 5' in audit, audit
 assert 'Eastern boundary unverified' in audit, audit
 assert 'Published: 0503, 0608, 0803' in page.locator('#redeployment-evidence').inner_text()
 assert 'Registered: 0503, 0609, 0804' in page.locator('#redeployment-evidence').inner_text()
 assert page.evaluate('WargameCore.openingRedeploymentAudit(__nativePreview.configuration(),__nativePreview.getSession().state,"s16").legalDestinations')==page.locator('.native-option-halo').count()
 valid=page.evaluate('''() => WargameSession.legal(__nativePreview.getSession(),{type:'redeploy-reserve',unitId:'s16'}).some(p=>p.x===5&&p.y===5)''')
 assert valid,'Chosen candidate destination not legal'
 page.locator('[data-board-cell="0606"]').click()
 assert page.evaluate("__nativePreview.getSession().state.units.find(u=>u.id==='s16').position.x")==5
 assert page.evaluate("__nativePreview.getSession().state.units.find(u=>u.id==='s16').position.y")==5
 page.locator('#unit-selection button').filter(has_text='s16').click()
 assert page.locator('#redeployment-audit').count()==1
 assert 'return' in page.locator('#redeployment-audit').inner_text()
 assert page.locator('[data-native-unit="s16"]').count()==1
 assert page.locator('#undo').is_enabled()
 moved=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 assert moved!=before
 save=page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 evidence=root/'rules/audit/visual/b4m-opening-redeployment-audit-v377.png'
 page.screenshot(path=str(evidence),full_page=True)
 page.locator('#undo').click()
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')==before
 assert page.evaluate("__nativePreview.getSession().state.units.find(u=>u.id==='s16').position.x")==4
 assert 'SOVIET RESERVES' in page.locator('#phase-status').inner_text()
 # Use real browser File upload to restore a portable JSON session.
 payload=json.dumps(save).encode('utf8')
 page.locator('#load-game').set_input_files(files=[{'name':'b4m-v376.json','mimeType':'application/json','buffer':payload}])
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')==moved
 assert page.evaluate("__nativePreview.getSession().state.units.find(u=>u.id==='s16').position.x")==5
 page.locator('#finish-phase').click()
 assert page.evaluate('WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).id')=='combat'
 assert page.locator('#finish-phase').inner_text()=='Finish phase'
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).state.openingRedeployment.completed')==True
 page.locator('#undo').click()
 assert page.evaluate('WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).kind')=='redeployment'
 assert page.locator('#map>svg image').count()==40
 assert not errors,errors
 browser.close()
 print(json.dumps({'status':'PASS','version':'v377','checkpoint':143,'browser':'isolated real Chromium',
   'unit':'s16','mapClickDestination':'0606','saveFileUploadRestore':True,'undo':True,
   'fullArtworkImages':40,'screenshot':str(evidence.relative_to(root)),
   'officialExecutableParity':'NOT VERIFIED'}))
