#!/usr/bin/env python3
"""Verify canonical launch wiring and real Chromium shared-native game rendering.
Hosted HTTP navigation is blocked by execution policy. The Chromium game DOM
runs unchanged source JS; only fetch transport is backed by exact project files.
"""
from pathlib import Path
import json,re
from playwright.sync_api import sync_playwright
from native_browser_asset_fixture import install_fetch
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'games/catalog.json').read_text())
game=json.loads((root/'games/battle-for-moscow/game.json').read_text())
assert game['engine']=='generic-hex-v1'
assert game['browserEntry']=='index.html'
entry=catalog['games'][0]
assert entry['directory']==game['id'] and entry['type']=='historical'
assert entry['entryPath']=='games/battle-for-moscow/index.html'
canonical=(root/entry['entryPath']).read_text()
assert 'native-preview/index.html' in canonical
assert (root/'games/battle-for-moscow/native-preview/index.html').exists()
assert 'legacy/index.html' not in canonical
home=(root/'index.html').read_text()
assert 'href="games/battle-for-moscow/index.html"' in home
assert 'href="legacy/index.html"' not in home
assert 'Test shared-engine B4M (preview)' not in home

preview=root/'games/battle-for-moscow/native-preview'
html=(preview/'index.html').read_text()
assert 'legacy/index.html' not in html
assert 'Shared-engine gameplay' in html
html=html[:html.index('<script src=')]+html[html.index('</body>',html.index('<script src=')):]
files={
 '../game.json':'games/battle-for-moscow/game.json',
 '../map.json':'games/battle-for-moscow/map.json',
 '../units.json':'games/battle-for-moscow/units.json',
 '../deployments.json':'games/battle-for-moscow/deployments.json',
 '../rules.json':'games/battle-for-moscow/rules.json',
 '../objectives.json':'games/battle-for-moscow/objectives.json',
 'config.json':'games/battle-for-moscow/native-preview/config.json',
 'ui-config.json':'games/battle-for-moscow/native-preview/ui-config.json',
 'ai-config.json':'games/battle-for-moscow/native-preview/ai-config.json',
 'ai-config-objective.json':'games/battle-for-moscow/native-preview/ai-config-objective.json',
 'ai-config-capture.json':'games/battle-for-moscow/native-preview/ai-config-capture.json',
 '../../../maps/battle-for-moscow.json':'maps/battle-for-moscow.json',
 '../../../maps/registry.json':'maps/registry.json',
}
scripts=['modules.js','roster.js','engine.js','native_preview_config.js','native_session_actions.js',
 'sync_sha256.js','native_session_save.js','session.js','native_session_ai.js','factions.js',
 'presentation.js','terrain_tiles.js','official_counter_templates.js','counter_visuals.js',
 'native_combat_ui.js','native_tournament_scoring.js','native_city_status.js','native_browser_view.js']
lookup={key:json.loads((root/path).read_text()) for key,path in files.items()}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1480,'height':1000})
 errors=[];page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(page,lookup,root)
 for script in scripts:page.add_script_tag(content=(root/'core'/script).read_text())
 page.evaluate('window.__nativePreviewReady')
 assert page.locator('#map > svg').count()==1
 assert page.locator('[data-native-unit]').count()>=22
 assert page.evaluate('__nativePreview.configuration().game.engine')=='generic-hex-v1'
 assert page.evaluate('__nativePreview.getSession().state.side')=='german'
 init=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 page.locator('#finish-phase').click()
 after=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 assert init!=after
 page.locator('#undo').click()
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')==init
 # UI has real official counters and shared SVG; this is NOT a generated illustration.
 shot=root/'rules/audit/visual/b4m-default-shared-native-v409.png'
 shot.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(shot),full_page=True,animations='disabled')
 assert not errors,errors
 # Inspect the actual DOM anchor used in the catalog, with the same JS logic.
 catalog_page=browser.new_page()
 catalog_page.set_content(home)
 catalog_page.evaluate('window.WargameStackView={create:()=>({})}')
 catalog_page.evaluate('''list=>{window.fetch=async url=>({ok:true,json:async()=>structuredClone(list)})}''',catalog)
 catalog_page.add_script_tag(content=(root/'app.js').read_text())
 catalog_page.locator('[data-directory="battle-for-moscow"]').wait_for(timeout=10000)
 card=catalog_page.locator('[data-directory="battle-for-moscow"]')
 assert card.evaluate('(el)=>el.tagName')=='A'
 assert card.get_attribute('href')=='games/battle-for-moscow/index.html'
 assert catalog_page.locator('[data-directory="eastern-corridor"]').evaluate('(el)=>el.tagName')=='BUTTON'
 assert catalog_page.locator('#workspace').is_hidden()
 output={'status':'PASS','checkpoint':175,'version':'v409',
  'newDefault':'games/battle-for-moscow/index.html','redirectsTo':'native-preview/index.html',
  'productionMetadataEngine':'generic-hex-v1','legacyLaunchLinks':0,
  'catalogUsesAnchor':True,'mechanicsLabNoLongerAutostarts':True,
  'nativeBrowserRendered':True,'sharedSvgRendered':True,'officialCounterNodes':page.locator('[data-native-unit]').count(),
  'initialSide':'german','sessionHashBefore':init,'phaseAdvances':init!=after,'undoRestores':True,
  'chromiumErrors':errors,'screenshot':str(shot.relative_to(root)),
  'limitation':'Navigation URL cannot be followed in this environment (localhost HTTP blocked); exact link and redirect wiring verified statically, shared-native gameplay DOM executed in Chromium with actual project assets.'}
 (root/'rules/audit/b4m-default-shared-native-route-v409.json').write_text(json.dumps(output,indent=2)+'\n')
 print(json.dumps(output,indent=2))
 browser.close()
