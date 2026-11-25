#!/usr/bin/env python3
"""Browser-based source-native Battle for Moscow variant toggle + signed saves."""
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
 api='window.__nativePreview'
 ok(not page.locator('#advanced-crt').is_checked(),'B4M starts with standard unchecked')
 ok(page.evaluate(api+'.configuration().rules.combat.crtVariant') is None,'Standard source CRT unmodified')
 std=page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 page.locator('[data-game-tab="settings"]').click()
 ok(page.locator('#advanced-crt').is_visible(),'Advanced checkbox in native B4M Settings')
 page.locator('#advanced-crt').check()
 ok(page.evaluate(api+'.configuration().rules.combat.crtVariant') is None,'Existing campaign does not mutate when staged')
 page.locator('[data-game-tab="play"]').click()
 page.locator('#new-game').click()
 ok(page.evaluate(api+'.configuration().rules.combat.crtVariant')=='advanced','New B4M game uses alternate')
 ok(page.evaluate('Object.keys(__nativePreview.configuration().rules.combat.table).length')==8,'Eight real CRT columns installed')
 adv=page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 page.locator('[data-reference="crt"]').click()
 ok('1:2' in page.locator('#reference-content').inner_text(),'Native CRT reference displays 1:2 column')
 ok('3:2' in page.locator('#reference-content').inner_text(),'Native CRT reference displays 3:2 column')
 page.locator('[data-game-tab="settings"]').click()
 page.screenshot(path=str(ROOT/'rules/audit/visual/advanced-crt-settings-b4m-v557.png'),full_page=False)
 page.locator('#advanced-crt').uncheck()
 page.locator('[data-game-tab="play"]').click()
 page.locator('#new-game').click()
 ok(page.evaluate(api+'.configuration().rules.combat.crtVariant') is None,'Native B4M reset returns standard')
 restored=page.evaluate('''v=>{ const g=__nativePreview.configuration();
  const ss=WargameSession.restore(v,{scenarioId:g.game.id,engine:'generic-hex-v1',config:g});
  return ss.state.turn;}''',std)
 ok(restored==1,'Original Standard native save still restores')
 # Advanced signed saves can be restored only with the matching package.
 ok(page.evaluate('''v=>{try{ WargameSession.restore(v,{scenarioId:__nativePreview.configuration().game.id,
     engine:'generic-hex-v1',config:__nativePreview.configuration()});return false;}catch(e){return /package mismatch/.test(e.message)}}''',adv),
    'Advanced signed save rejects standard rules')
 # Real player's Load JSON control selects the signed variant automatically.
 page.locator('#load-game').set_input_files({'name':'advanced-native.json','mimeType':'application/json','buffer':json.dumps(adv).encode()})
 ok(page.evaluate(api+'.configuration().rules.combat.crtVariant')=='advanced','Load button restores Advanced ruleset')
 ok(page.locator('#advanced-crt').is_checked(),'Load button syncs checkbox to saved variant')
 page.locator('#load-game').set_input_files({'name':'standard-native.json','mimeType':'application/json','buffer':json.dumps(std).encode()})
 ok(page.evaluate(api+'.configuration().rules.combat.crtVariant') is None,'Load button restores Standard ruleset')
 ok(not page.locator('#advanced-crt').is_checked(),'Load button syncs Standard checkbox')
 ok(not errors,'No JS exceptions '+str(errors))
 browser.close()
print('PASS v557 native Battle for Moscow Advanced CRT:',count,'Chromium assertions')
