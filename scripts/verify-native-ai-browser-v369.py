#!/usr/bin/env python3
"""Actual browser JavaScript and DOM with source JSON. Local HTTP navigation is
blocked by system policy; only fetch is mocked. Does not certify hosted UX or
legacy AI strategic doctrine parity.
"""
from pathlib import Path
from native_browser_asset_fixture import install_fetch
import json
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent.parent
preview=root/'games/battle-for-moscow/native-preview'
html=(preview/'index.html').read_text()
start=html.index('<script src=')
end=html.index('</body>',start)
html=html[:start]+html[end:]
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
 '../../../maps/battle-for-moscow.json':'maps/battle-for-moscow.json',
 '../../../maps/registry.json':'maps/registry.json',
}
lookup={key:json.loads((root/path).read_text()) for key,path in files.items()}
scripts=['modules.js','roster.js','engine.js','native_preview_config.js','native_session_actions.js',
 'sync_sha256.js','native_session_save.js','session.js','native_session_ai.js','factions.js',
 'presentation.js','terrain_tiles.js','official_counter_templates.js','counter_visuals.js',
 'native_combat_ui.js','native_tournament_scoring.js','native_city_status.js','native_browser_view.js']

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1480,'height':1020})
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(page,lookup,root)
 for script in scripts:page.add_script_tag(content=(root/'core'/script).read_text())
 page.evaluate('window.__nativePreviewReady')
 assert page.locator('#ai-play-side').is_enabled()
 initial=page.evaluate('''() => ({side:__nativePreview.getSession().state.side,
  phase:WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).id,
  save:WargameSession.serialize(__nativePreview.getSession())})''')
 assert initial['side']=='german'
 assert initial['phase']=='combat'
 page.locator('#ai-play-side').click()
 page.wait_for_function('window.__nativePreview.getSession().state.side === "soviet"')
 played=page.evaluate('''() => ({side:__nativePreview.getSession().state.side,
  history:__nativePreview.getSession().history.length,
  combats:__nativePreview.getSession().state.log.filter(e=>e.type==='combat').length,
  moves:__nativePreview.getSession().state.log.filter(e=>e.type==='move').length,
  save:WargameSession.serialize(__nativePreview.getSession()),
  text:document.getElementById('message').textContent})''')
 assert played['combats']>0
 assert played['moves']>0
 assert played['history']>4
 assert 'Baseline AI german' in played['text'],played['text']
 assert played['save']['format']=='generic-hex-session-preview'
 assert page.locator('#map > svg').count()==1
 # The same browser session can Undo a native AI step and restore the full
 # side-turn session through the existing shared serializer.
 page.locator('#undo').click()
 undone=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 assert undone!=played['save']['sha256']
 parity=page.evaluate('''() => {const s=__nativePreview.getSession();const blob=WargameSession.serialize(s);
  const x=WargameSession.restore(structuredClone(blob),{scenarioId:s.scenarioId,engine:s.engine,config:s.config});
  return JSON.stringify(x.state)===JSON.stringify(s.state)&&JSON.stringify(x.history)===JSON.stringify(s.history); }''')
 assert parity
 # Re-running from the same seed through the actual button produces the
 # exact same final save hash, independent of DOM timing.
 page.locator('#new-game').click()
 page.locator('#ai-play-side').click()
 page.wait_for_function('window.__nativePreview.getSession().state.side === "soviet"')
 repeated=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 assert repeated==played['save']['sha256']
 page.locator('#manual-setup').check()
 page.locator('#new-game').click()
 manual_before=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 page.locator('#ai-play-side').click()
 page.wait_for_function('document.querySelector("#message").textContent.includes("Manual setup requires")')
 manual_after=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 assert manual_before==manual_after, 'AI must not partially place a manual setup'

 # Optional strategy changes decisions without changing the scenario rules,
 # map, action API, or historic production engine selection.
 page.locator('#manual-setup').uncheck()
 page.locator('#new-game').click()
 page.locator('#ai-strategy').select_option('objective')
 page.locator('#ai-play-side').click()
 page.wait_for_function('window.__nativePreview.getSession().state.side === "soviet"')
 page.locator('#ai-play-side').click()
 page.wait_for_function('window.__nativePreview.getSession().state.side === "german"')
 guarded=page.evaluate('''() => ({
  seed:__nativePreview.getSession().state.seed,
  moscow:__nativePreview.getSession().state.units.find(u=>u.position?.x===10&&u.position?.y===2)?.id,
  message:document.getElementById('message').textContent,
  hash:WargameSession.serialize(__nativePreview.getSession()).sha256,
  replacements:__nativePreview.getSession().state.log.filter(e=>e.type==='replacement' && e.unit==='s13').length
 })''')
 assert guarded['moscow']=='s13',guarded
 assert guarded['message'].startswith('Objective-guard AI soviet'),guarded
 assert guarded['replacements']>0,guarded
 page.locator('#new-game').click()
 page.locator('#ai-play-side').click()
 page.wait_for_function('window.__nativePreview.getSession().state.side === "soviet"')
 page.locator('#ai-play-side').click()
 page.wait_for_function('window.__nativePreview.getSession().state.side === "german"')
 assert page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')==guarded['hash']
 assert not errors,errors
 report={
  'status':'PASS','checkpoint':135,'scope':'Chromium DOM with real browser modules and source JSON; fetch mocked due sandbox policy',
  'initialPhase':initial['phase'],'firstSideTurn':{'combats':played['combats'],'moves':played['moves'],'historySteps':played['history']},
  'deterministicSameSeed':repeated==played['save']['sha256'],
  'manualSetupFailClosed':manual_before==manual_after,
  'undo':True,'saveRestore':True,'browserExceptions':errors,
  'objectiveGuard':{'moscowOccupant':guarded['moscow'],'deterministic':True},
  'productionB4MSelector':'legacy-b4m-v1','limitations':['no hosted HTTP navigation/asset acceptance','no legacy AI policy parity']
 }
 (root/'rules/audit/b4m-native-objective-browser-v369.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
 browser.close()
