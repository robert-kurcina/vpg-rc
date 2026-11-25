#!/usr/bin/env python3
"""Isolated Chromium smoke test for the native shared-engine browser workflow.
Admin policy prohibits file:// and http://127.0.0.1 navigation in this
container. The page is populated with its real HTML/scripts/JSON; only fetch
is replaced with the same local source bytes. This is not full live hosting UX.
"""
from pathlib import Path
from native_browser_asset_fixture import install_fetch
import json
import hashlib
import subprocess
from playwright.sync_api import sync_playwright

root=Path(__file__).resolve().parent.parent
preview=root/'games/battle-for-moscow/native-preview'
html=(preview/'index.html').read_text()
start=html.index('<script src=')
end=html.index('</body>',start)
html=html[:start]+html[end:]
source_paths={
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
}
lookup={key:json.loads((root/path).read_text()) for key,path in source_paths.items()}
scripts=['modules.js','roster.js','engine.js','native_preview_config.js','native_session_actions.js',
 'sync_sha256.js','native_session_save.js','session.js','factions.js','presentation.js',
 'terrain_tiles.js','official_counter_templates.js','counter_visuals.js','native_combat_ui.js','native_tournament_scoring.js','native_city_status.js','native_browser_view.js']

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1480,'height':1020})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e) + '  '+ str(e.stack)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'core/native_browser_view.css').read_text())
 install_fetch(page,lookup,root)
 for script in scripts:
  page.add_script_tag(content=(root/'core'/script).read_text())
 page.evaluate('window.__nativePreviewReady')
 status=page.locator('#game-status').inner_text()
 assert 'counters on board' in status,status
 assert page.locator('#map>svg').count()==1
 initial=page.locator('[data-native-unit]').count()
 assert initial==36,('counter count',initial)
 baseline=page.evaluate('''() => ({
  engine:window.__nativePreview.getSession().engine,
  phase:WargameCore.currentPhase(window.__nativePreview.configuration(),window.__nativePreview.getSession().state).kind,
  units:window.__nativePreview.getSession().state.units.length,
  sha:WargameSyncSha256.sha256('abc'),
  save:WargameSession.serialize(window.__nativePreview.getSession()),
  map:document.querySelector('#map svg').getAttribute('viewBox')})''')
 assert baseline['engine']=='generic-hex-v1'
 assert baseline['phase']=='combat'
 assert baseline['units']==39
 assert baseline['sha']=='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
 assert baseline['save']['sha256'] and baseline['save']['format']=='generic-hex-session-preview'
 # Cryptographic save checksum and package fingerprint must be identical
 # across browser and Node's existing production-format serializer.
 _,expected=baseline['save']['sha256'],baseline['save']['sha256']
 node_cmd='''const load=require('./tools/audit-b4m-native-preview-v360').load;
 const E=require('./core/engine.js'),P=require('./core/native_preview_config.js'),S=require('./core/session.js');
 const {original,config}=load();const g=E.build(P.project(original,config));
 process.stdout.write(S.serialize(S.create({scenarioId:g.game.id,engine:'generic-hex-v1',config:g,state:E.start(g,1941,'auto-reference')})).sha256);'''
 node_hash=subprocess.check_output(['node','-e',node_cmd],cwd=root,text=True).strip()
 assert baseline['save']['sha256']==node_hash,(baseline['save']['sha256'],node_hash)
 serialized=dict(baseline['save']);checksum=serialized.pop('sha256')
 assert hashlib.sha256(json.dumps(serialized,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()==checksum
 # The user must be able to make a real combat declaration through clicks.
 candidate=page.evaluate('''() => {
  const s=window.__nativePreview.getSession();
  for(const atk of s.state.units.filter(u=>u.army===s.state.side&&u.position))
   for(const def of s.state.units.filter(u=>u.army!==s.state.side&&u.position)){
    const request={type:'declare-battle',attackers:[atk.id],defender:def.id};
    if(WargameSession.legal(s,request).length)return {attacker:atk.id,defender:def.id};
   }
  return null;
 }''')
 assert candidate,'No legal initial attack for click test'
 page.locator(f'[data-native-unit="{candidate["defender"]}"] .counter-hit-area').click()
 assert page.evaluate('window.__nativePreview.getSession().state.declarations.length')==0
 assert page.locator('[data-combat-suggestion]').count()>=1
 page.locator(f'[data-native-unit="{candidate["attacker"]}"] .counter-hit-area').click()
 assert page.locator('#declare-selected-battle').is_enabled()
 page.locator('#declare-selected-battle').click()
 assert page.evaluate('window.__nativePreview.getSession().state.declarations.length')==1
 page.locator('#finish-phase').click()
 committed=page.evaluate('window.__nativePreview.getSession().state.pendingRoll')
 assert committed is not None
 assert page.locator('#resolve-battle').is_enabled()
 page.locator('#resolve-battle').click()
 assert page.evaluate('window.__nativePreview.getSession().state.log.some(e=>e.type==="combat")')
 # New game resets this combat fixture before testing empty-combat->movement.
 page.locator('#new-game').click()

 # Resolve empty combat phase from real DOM button and then a native movement.
 page.locator('#finish-phase').click()
 assert page.locator('#phase-status').inner_text().endswith('movement') or 'movement' in page.locator('#phase-status').inner_text()
 move=page.evaluate('''() => {
  const v=window.__nativePreview,s=v.getSession(),g=v.configuration();
  for(const u of s.state.units.filter(u=>u.army===s.state.side&&u.position)){
   const legal=WargameSession.legal(s,{type:'move',unitId:u.id});
   if(legal.length) return {id:u.id,at:legal[0]};
  }
  return null;
 }''')
 assert move, 'No native movement available'
 old=page.evaluate('(id)=>window.__nativePreview.getSession().state.units.find(u=>u.id===id).position',move['id'])
 page.locator(f'[data-native-unit="{move["id"]}"] .counter-hit-area').click()
 destination_id=page.evaluate('''m=>{
  const candidates=document.querySelectorAll('[data-board-cell]');
  const hex=String(m.at.x+1).padStart(2,'0')+String(m.at.y+1).padStart(2,'0');
  return hex;
 }''',move)
 page.locator(f'[data-board-cell="{destination_id}"]').click(force=True)
 after=page.evaluate('(id)=>window.__nativePreview.getSession().state.units.find(u=>u.id===id).position',move['id'])
 assert after=={'x':move['at']['x'],'y':move['at']['y']} and old!=after
 assert page.locator('#undo').is_enabled()
 page.locator('#undo').click()
 undo=page.evaluate('(id)=>window.__nativePreview.getSession().state.units.find(u=>u.id===id).position',move['id'])
 assert undo==old
 # Re-enter same legal move, serialize, restore through exact shared JS module.
 page.evaluate('''m=>window.__nativePreview.perform({type:'move',unitId:m.id,x:m.at.x,y:m.at.y})''',move)
 parity=page.evaluate('''()=>{
  const s=window.__nativePreview.getSession();
  const save=WargameSession.serialize(s);
  const next=WargameSession.restore(JSON.parse(JSON.stringify(save)),{
    scenarioId:s.scenarioId,engine:'generic-hex-v1',config:s.config});
  return JSON.stringify(next.state)===JSON.stringify(s.state)&&
   JSON.stringify(next.history)===JSON.stringify(s.history);
 }''')
 assert parity
 page.locator('#manual-setup').check()
 page.locator('#new-game').click()
 assert 'setup' in page.locator('#phase-status').inner_text()
 assert page.locator('#unit-selection button').count()==22
 assert page.locator('#finish-phase').is_disabled()
 assert page.locator('[data-native-unit]').count()==14
 assert not errors,errors
 report={
  'status':'PASS','checkpoint':133,'scenario':'battle-for-moscow',
  'scope':'isolated Chromium DOM with actual source JS/JSON, fetch mocked due admin navigation restriction',
  'initialOnBoard':initial,'initialRoster':baseline['units'],
  'nativeEngine':baseline['engine'],'initialPhase':baseline['phase'],
  'movement':move,'undo':True,'versionedSaveRestore':True,
  'manualSetupCounterChoices':22,'unplacedManualStart':14,
  'currentMapViewBox':baseline['map'],'javascriptExceptions':errors,
  'productionRoutingChanged':False,
  'limitations':['no real HTTP navigation','no AI or full browser UX parity','not upstream Oberlabs independent certification']}
 output=root/'rules/audit/b4m-native-browser-preview-v367.json'
 output.write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
 browser.close()
