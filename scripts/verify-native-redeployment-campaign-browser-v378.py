#!/usr/bin/env python3
"""Chromium: three real source-map clicks and entry into Turn 1 German combat.
This does not certify original Oberlabs tournament destination legality.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
from native_browser_asset_fixture import install_fetch
root=Path(__file__).resolve().parent.parent
src=root/'games/battle-for-moscow/native-preview/index.html'
html=src.read_text()
html=html[:html.index('<script src=')]+html[html.index('</body>',html.index('<script src=')):]
paths={**{f'../{k}.json':f'games/battle-for-moscow/{k}.json' for k in
        ['game','map','units','deployments','rules','objectives']},
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
 page=browser.new_page(viewport={'width':1850,'height':1030},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(page,data,root)
 for script in scripts:page.add_script_tag(content=(root/'core'/script).read_text())
 page.evaluate('window.__nativePreviewReady')
 assert page.locator('#map>svg image').count()==40
 page.locator('#candidate-redeployment').check()
 page.locator('#new-game').click()
 assert page.evaluate('WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).kind')=='redeployment'
 positions={'s16':'0703','s30':'0907','s43':'1005'}
 previous_hash=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 for unit,hexid in positions.items():
  page.locator('#unit-selection button').filter(has_text=unit).click()
  x,y=int(hexid[:2])-1,int(hexid[2:])-1
  assert page.evaluate('([id,x,y])=>WargameSession.legal(__nativePreview.getSession(),{type:"redeploy-reserve",unitId:id}).some(p=>p.x===x&&p.y===y)',[unit,x,y])
  page.locator(f'[data-board-cell="{hexid}"]').click()
  actual=page.evaluate('(id)=>__nativePreview.getSession().state.units.find(u=>u.id===id).position',unit)
  assert actual=={'x':x,'y':y},(unit,actual,hexid)
 assert page.locator('[data-native-unit]').count()==36
 assert page.locator('#map>svg image').count()==40
 original_export=page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 assert original_export['sha256']!=previous_hash
 assert page.evaluate('WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).kind')=='redeployment'
 shot=root/'rules/audit/visual/b4m-three-reserve-start-v378.png'
 page.screenshot(path=str(shot),full_page=True)
 # Undo the third move in the UI, then restore the complete all-three state.
 page.locator('#undo').click()
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')!=original_export['sha256']
 page.locator('#load-game').set_input_files(files=[{'name':'v378-three-reserves.json',
  'mimeType':'application/json','buffer':json.dumps(original_export).encode('utf8')}])
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')==original_export['sha256']
 page.locator('#finish-phase').click()
 assert page.evaluate('WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).id')=='combat'
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).state.openingRedeployment.completed')is True
 for unit,hexid in positions.items():
  assert page.evaluate('(id)=>__nativePreview.getSession().state.units.find(u=>u.id===id).position',unit)=={
    'x':int(hexid[:2])-1,'y':int(hexid[2:])-1}
 page.locator('#undo').click()
 assert page.evaluate('WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).kind')=='redeployment'
 assert not errors,errors
 print(json.dumps({'status':'PASS','version':'v378','checkpoint':144,
  'scope':'isolated Chromium with authentic local assets, no upstream executable',
  'reserveMapClicks':positions,'undo':True,'fileSaveRestore':True,'turnOneCombat':True,
  'actualArtworkAssets':40,'gameplayMode':'candidate-only; no tournament adjudication',
  'screenshot':str(shot.relative_to(root))}))
 browser.close()
