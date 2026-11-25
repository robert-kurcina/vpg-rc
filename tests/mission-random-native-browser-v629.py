#!/usr/bin/env python3
"""Browser-based source-native Battle for Moscow mission seed checks."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from native_browser_asset_fixture import install_fetch
preview=ROOT/'games/battle-for-moscow/native-preview'
html=(preview/'index.html').read_text()
html=html[:html.index('<script src=')]+html[html.index('</body>',html.index('<script src=')):]
files={key:json.loads((ROOT/value).read_text()) for key,value in {
 '../game.json':'games/battle-for-moscow/game.json',
 '../map.json':'games/battle-for-moscow/map.json',
 '../units.json':'games/battle-for-moscow/units.json',
 '../deployments.json':'games/battle-for-moscow/deployments.json',
 '../rules.json':'games/battle-for-moscow/rules.json',
 '../objectives.json':'games/battle-for-moscow/objectives.json',
 'config.json':'games/battle-for-moscow/native-preview/config.json',
 'ui-config.json':'games/battle-for-moscow/native-preview/ui-config.json',
 '../../../maps/battle-for-moscow.json':'maps/battle-for-moscow.json',
 '../../../maps/registry.json':'maps/registry.json'
}.items()}
scripts=['modules.js','roster.js','historical_crt.js','engine.js','native_preview_config.js','native_session_actions.js',
 'sync_sha256.js','native_session_save.js','session.js','native_session_ai.js','factions.js',
 'presentation.js','terrain_tiles.js','official_counter_templates.js','counter_visuals.js',
 'native_combat_ui.js','native_tournament_scoring.js','native_city_status.js','game_display_settings.js',
 'map_touch_navigation.js','responsive_game_shell.js','terrain_tooltips.js','counter_phase_activation.js','native_browser_view.js']
count=0
def ok(value,msg):
 global count
 assert value,msg
 count+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1480,'height':1000})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(ROOT/'core/native_browser_view.css').read_text())
 install_fetch(page,files,ROOT)
 for script in scripts:page.add_script_tag(content=(ROOT/'core'/script).read_text())
 page.wait_for_function('window.__nativePreview && window.__nativePreview.getSession()',timeout=35000)
 save=lambda:page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 initial=save();seed=initial['state']['missionSeed'];ok(0<seed<2**32,'Automatic initial master seed');ok(initial['state']['seed']==seed,'Initial combat state matches master')
 page.locator('#new-game').click();second=save();ok(second['state']['missionSeed']!=seed,'New mission seed differs')
 page.locator('#load-game').set_input_files({'name':'mission.json','mimeType':'application/json','buffer':json.dumps(initial).encode()})
 ok(save()==initial,'Load restores initial mission and RNG state')
 page.locator('[data-game-tab="settings"]').click();page.locator('#seed').fill('42')
 page.locator('[data-game-tab="play"]').click();page.locator('#new-game').click();fixed=save();ok(fixed['state']['missionSeed']==42,'Explicit diagnostic seed supported')
 page.locator('#new-game').click();ok(save()==fixed,'Explicit seed reproduces initial native state')
 ok(not errors,'No Chromium errors '+str(errors));browser.close()
print('PASS mission RNG native Chromium',count,'assertions')
