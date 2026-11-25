#!/usr/bin/env python3
"""Checkpoint 141 — actual Chromium scoring panel with source-backed map art.
Only fetch transport is replaced with local file bytes (hosted navigation blocked).
"""
from pathlib import Path
from tempfile import gettempdir
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
data={key:json.loads((root/value).read_text()) for key,value in paths.items()}
scripts=['modules.js','roster.js','engine.js','native_preview_config.js','native_session_actions.js',
 'sync_sha256.js','native_session_save.js','session.js','native_session_ai.js','factions.js',
 'presentation.js','terrain_tiles.js','official_counter_templates.js','counter_visuals.js',
 'native_combat_ui.js','native_tournament_scoring.js','native_city_status.js','native_browser_view.js']
out=Path(gettempdir())/'b4m-tournament-reference-smoke-v376.png'
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1700,'height':1050})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(page,data,root)
 for script in scripts:page.add_script_tag(content=(root/'core'/script).read_text())
 page.evaluate('window.__nativePreviewReady')
 page.locator('#city-details summary').click()
 status=page.locator('#city-status').inner_text()
 assert 'Tournament rules — reference score only' in status,status
 assert 'soviet decisive' in status,status
 assert 'Soviet Union: 3' in status,status
 assert 'Germany: 1' in status,status
 assert 'german tank steps on map: 16' in status,status
 assert 'Moscow connected' in status,status
 assert 'Tula connected' in status,status
 assert 'optional reserve redeployment is a conservative, unverified candidate' in status,status
 assert page.locator('#city-status [data-city-hex]').count()==11
 assert page.locator('#map>svg image').count()==40
 page.locator('#city-details').screenshot(path=str(out))
 # Read-only panel must not alter save state, move units, reveal dice or turn mode.
 sha=page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 initial=page.evaluate('''() => {let s=__nativePreview.getSession().state;return {turn:s.turn,side:s.side,phase:s.phaseIndex,log:s.log.length}}''')
 page.evaluate('''() => __nativePreview.render()''')
 assert sha==page.evaluate('WargameSession.serialize(__nativePreview.getSession()).sha256')
 assert initial==page.evaluate('''() => {let s=__nativePreview.getSession().state;return {turn:s.turn,side:s.side,phase:s.phaseIndex,log:s.log.length}}''')
 # Synthetic test-only cordon: the historical gameplay did NOT produce this
 # position. It exposes an actual overlap in the published §5 descriptions.
 page.evaluate('''() => {
  const s=__nativePreview.getSession().state;
  for(const u of s.units)u.position=null;
  const german=s.units.filter(u=>u.army==='german');
  WargameCore.neighbors(10,2).forEach((c,i)=>german[i].position={x:c.x,y:c.y});
  s.control['10,2']='soviet';s.control['10,6']='german';
  __nativePreview.render();
 }''')
 amb=page.locator('#city-status').inner_text()
 assert 'Tournament rule-text ambiguity' in amb,amb
 assert 'german minor AND soviet minor' in amb,amb
 assert 'no primary result or total points are assigned' in amb,amb
 ambout=Path(gettempdir())/'b4m-tournament-ambiguous-smoke-v376.png'
 page.locator('#city-details').screenshot(path=str(ambout))
 assert not errors,errors
 browser.close()
 print(json.dumps({'status':'PASS','checkpoint':141,'version':'v375',
  'tournament':'read-only reference, non-playable setup','browser':'isolated real Chromium; fetch from authentic local bytes',
  'sourceArtworkImages':40,'cities':11,'saveUnchanged':True,'screenshot':str(out),
  'ambiguousFixtureScreenshot':str(ambout)}))
