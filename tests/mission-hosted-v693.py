#!/usr/bin/env python3
"""Real HTTP origin acceptance for all five routes and mission storage.
Run against the local server or a GitHub Pages repository-relative URL.
Uses a new isolated browser context; never modifies an ordinary user's saves.
No intercepted network, localStorage mock, or IndexedDB fixture.
Optional --terminal-save supplies a completed native Moscow JSON from the runner.
"""
import argparse,json,subprocess,os,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://localhost:8765/index.html');parser.add_argument('--chromium',default=None);parser.add_argument('--terminal-save',type=Path);parser.add_argument('--evidence-dir',type=Path,help='Capture actual engine screenshots at desktop and tablet widths');parser.add_argument('--live-scenario',choices=['arduous','leningrad','kiev','kiev-odessa'],help='Play one fresh historical campaign through the actual automatic browser controller');args=parser.parse_args()
if args.evidence_dir: args.evidence_dir.mkdir(parents=True,exist_ok=True)
missions=['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path=args.chromium,args=['--no-sandbox','--disable-dev-shm-usage']);context=browser.new_context(viewport={'width':1180,'height':820});page=context.new_page();page.set_default_timeout(60000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(args.url,wait_until='domcontentloaded')
 def selector():
  expect(page.locator('[data-mission]')).to_have_count(5)
 def card(id):return page.locator(f'[data-mission="{id}"]')
 def ready(id):
  if id=='battle-for-moscow':
   page.wait_for_function('!!window.__nativePreviewReady');page.evaluate('window.__nativePreviewReady')
  else:
   page.wait_for_function("!!window.HistoricalBrowserPreview || document.getElementById('status')?.textContent.includes('Source/engine initialization failed')")
   if not page.evaluate('!!window.HistoricalBrowserPreview'):
    raise AssertionError(f'{id} initialization failed: {page.locator("#message").inner_text()}')
  expect(page.locator('#mission-menu-toggle')).to_be_visible()
 def snapshot(id):return page.evaluate('WargameSession.serialize(__nativePreview.getSession())' if id=='battle-for-moscow' else 'HistoricalBrowserPreview.save()')
 def menu():
  if not page.locator('#mission-menu').is_visible():page.locator('#mission-menu-toggle').click()
 def verify_shell(id):
  # Exercise the approved shared controls without changing mission state.
  expect(page.locator('#mission-phase-label')).not_to_have_text('')
  expect(page.locator('#mission-menu-toggle .mission-hamburger-glyph > span')).to_have_count(3)
  menu();expect(page.locator('#mission-menu .mission-menu-row')).to_have_count(8)
  page.locator('#mission-menu-toggle').click()
  toggle=page.locator('#mission-sidebar-toggle');gear=page.locator('#mission-settings')
  expect(toggle).to_be_visible();expect(gear).to_be_visible()
  page.set_viewport_size({'width':820,'height':1180})
  page.evaluate("WargameResponsiveShell.setPreference('mobile')")
  expect(page.locator('#mission-phase-bar > #mission-sidebar-toggle')).to_be_visible()
  expect(page.locator('body')).to_have_attribute('data-layout-mode','mobile')
  expect(toggle).to_have_attribute('aria-expanded','false')
  gear.click();expect(page.locator('#settings-section')).to_be_visible();expect(gear).to_have_attribute('aria-pressed','true')
  page.keyboard.press('Escape');expect(gear).to_have_attribute('aria-pressed','false');expect(toggle).to_have_attribute('aria-expanded','false')
  toggle.click();expect(toggle).to_have_attribute('aria-expanded','true')
  gear.click();expect(page.locator('#settings-section')).to_be_visible()
  gear.click();expect(toggle).to_have_attribute('aria-expanded','true')
  toggle.click();expect(toggle).to_have_attribute('aria-expanded','false')
  if args.evidence_dir:page.screenshot(path=str(args.evidence_dir/f'{id}-tablet.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844})
  toggle.click();expect(toggle).to_have_attribute('aria-expanded','true')
  toggle.click();expect(toggle).to_have_attribute('aria-expanded','false')
  page.set_viewport_size({'width':1180,'height':820})
  page.evaluate("WargameResponsiveShell.setPreference('auto')")
  expect(page.locator('#map-navigation > #mission-sidebar-toggle')).to_be_visible()
  print('PASS shared mission menu and mobile panel/settings lifecycle:',id,flush=True)
 def verify_reference(id):
  before=snapshot(id)
  menu();page.get_by_role('button',name='See TEC',exact=True).click()
  dialog=page.locator('#game-reference-dialog')
  expect(dialog).to_be_visible()
  expect(dialog.locator('[data-terrain=forest]')).to_contain_text('-1 attacker column')
  if id in ('battle-for-moscow','arduous'):
   specimen=dialog.locator('[data-terrain=fortification] .fortification-asset')
   expect(specimen).to_have_count(1)
   assert page.evaluate("""async()=>{const image=document.querySelector('#game-reference-dialog .fortification-asset');const url=image.getAttribute('href');const probe=new Image();probe.src=url;await probe.decode();return probe.naturalWidth>0}""")
  if id=='battle-for-moscow':
   expect(dialog.locator('[aria-label="Conditional weather effects"]')).to_be_visible()
   expect(dialog.locator('[data-terrain=weather-mud]')).to_have_count(1)
  if args.evidence_dir:dialog.screenshot(path=str(args.evidence_dir/f'{id}-terrain-reference.png'))
  dialog.get_by_role('button',name='Close rules and charts').click()
  expect(page.locator('#mission-menu-toggle')).to_be_focused()
  assert snapshot(id)==before
  print('PASS actual shared terrain reference and source assets:',id,flush=True)
 def verify_moscow_orders():
  # Start from the restored historical opening. Use real controls to reach movement.
  for _ in range(5):
   kind=page.evaluate("WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).kind")
   if kind=='move':break
   assert kind in ('redeployment','combat'),kind
   page.locator('#mission-phase-action').click()
  else:raise AssertionError('Moscow movement phase not reached')
  order=page.evaluate("""()=>{const s=__nativePreview.getSession();for(const u of s.state.units){
    if(!u.position||WargameCore.unitSide(u)!==s.state.side)continue;
    const moves=WargameSession.legal(s,{type:'move',unitId:u.id});
    const dest=moves.find(m=>!s.state.units.some(v=>v.position?.x===m.x&&v.position?.y===m.y));
    if(dest)return {id:u.id,x:dest.x,y:dest.y};
   }return null;}""")
  assert order,'No legal opening movement fixture'
  before=snapshot('battle-for-moscow')
  counter=page.locator('[data-native-unit="'+order['id']+'"]')
  counter.locator('.counter-hit-area').click()
  expect(counter).to_have_attribute('aria-pressed','true')
  assert snapshot('battle-for-moscow')==before
  counter.focus();page.keyboard.press('Enter')
  expect(counter).to_have_attribute('aria-pressed','true')
  expect(counter).to_be_focused()
  assert snapshot('battle-for-moscow')==before
  page.locator('[data-map-zoom="in"]').click()
  counter.locator('.counter-hit-area').click()
  expect(counter).to_have_attribute('aria-pressed','true')
  destination=page.locator('.native-board-hit[tabindex="0"]').first
  destination.click()
  after=snapshot('battle-for-moscow')
  assert after!=before
  page.locator('#undo').click();assert snapshot('battle-for-moscow')['state']==before['state']
  page.locator('#redo').click();assert snapshot('battle-for-moscow')['state']==after['state']
  print('PASS Moscow real counter selection, keyboard, zoom, movement, Undo and Redo',flush=True)
 def verify_moscow_pending():
  # Reuse source-legal double-stack fixtures on the actual HTTP origin.
  fixtures=json.loads(subprocess.check_output(['node',str(Path(__file__).resolve().parent/'b4m-double-stack-browser-fixture-v697.js')],text=True))
  page.set_viewport_size({'width':820,'height':1180})
  page.evaluate("WargameResponsiveShell.setPreference('mobile')")
  toggle=page.locator('#mission-sidebar-toggle')
  for outcome,fixture in fixtures.items():
   page.locator('#load-game').set_input_files({'name':'pending.json','mimeType':'application/json','buffer':json.dumps(fixture['pending']).encode()})
   expect(page.locator('#load-game')).to_have_value('')
   assert snapshot('battle-for-moscow')==fixture['pending']
   if toggle.get_attribute('aria-expanded')=='true':toggle.click()
   page.locator('#mission-phase-action').click()
   expect(toggle).to_have_attribute('aria-expanded','true')
   expect(page.locator('#choice-defender-loss')).to_be_visible()
   choices=fixture['choices']
   page.locator('#choice-defender-loss').select_option(choices['defenderLossId'])
   if outcome=='EX':page.locator('#choice-exchange').fill(','.join(choices['exchangeOrder']))
   for id,point in choices['retreats'].items():page.locator(f'[data-stack-retreat="{id}"]').select_option(f"{point['x']},{point['y']}")
   page.locator('#choice-advance').select_option('none')
   assert snapshot('battle-for-moscow')==fixture['pending']
   page.locator('#resolve-battle').click()
   assert snapshot('battle-for-moscow')==fixture['resolved']
   page.locator('#undo').click();assert snapshot('battle-for-moscow')==fixture['pending']
   page.locator('#redo').click();assert snapshot('battle-for-moscow')==fixture['resolved']
   print('PASS actual mobile double-stack consequence and exact Undo/Redo:',outcome,flush=True)
  if toggle.get_attribute('aria-expanded')=='true':toggle.click()
  page.set_viewport_size({'width':1180,'height':820})
  page.evaluate("WargameResponsiveShell.setPreference('auto')")
 def verify_optional_modes(id):
  native=id=='battle-for-moscow'
  before=snapshot(id)
  gear=page.locator('#mission-settings');gear.click()
  expect(page.locator('#victory-mode')).to_have_value('historical')
  page.locator('#victory-mode').select_option('graduated')
  page.locator('#advanced-crt').check()
  if native:page.locator('#stacking-mode').select_option('double')
  assert snapshot(id)==before,'Next-mission settings altered active game'
  # Faction assignments are immediate preferences; selecting them pauses automation.
  assignment=page.locator('#native-ai-assignment' if native else '#ai-assignment')
  for value in ('german','soviet','both','manual'):
   assignment.select_option(value)
   expect(assignment).to_have_value(value)
  gear.click()
  # Existing new-game control is retained in Settings maintenance.
  gear.click()
  page.locator('#settings-section details.settings-category').filter(has=page.locator('#new-game')).locator('summary').click()
  page.locator('#new-game').click()
  expect(page.locator('#graduated-score')).to_have_count(1)
  graded=snapshot(id);assert graded!=before
  if gear.get_attribute('aria-pressed')=='true':gear.click()
  leave('Save and return')
  card(id).locator('[data-resume]').click();ready(id)
  assert snapshot(id)==graded
  expect(page.locator('#graduated-score')).to_have_count(1)
  expect(page.locator('#victory-mode')).to_have_value('graduated')
  expect(page.locator('#advanced-crt')).to_be_checked()
  if native:expect(page.locator('#stacking-mode')).to_have_value('double')
  print('PASS actual optional-mode save/resume and faction settings:',id,flush=True)
 def verify_historical_terminal(id):
  fixtures=Path(__file__).resolve().parent/'fixtures/terminal-v694'
  for suffix in ('','-graduated'):
   path=fixtures/(id+suffix+'.json')
   if id=='leningrad':
    # Original pre-adjudication saves must be explicitly rejected, not rebound.
    before=snapshot(id)
    page.locator('#load').set_input_files(str(path))
    expect(page.locator('#load')).to_have_value('')
    expect(page.locator('#message')).to_contain_text('source configuration or rules version')
    assert snapshot(id)==before
    with tempfile.TemporaryDirectory() as tmp:
     updated=Path(tmp)/path.name
     subprocess.run(['node',str(Path(__file__).resolve().parent/'replay-terminal-journal-v694.js'),id,'standard',str(path),str(updated)],check=True,env={**os.environ,'LENINGRAD_TERMINAL_POLICY_REPLAY':'1','VICTORY_MODE':'graduated' if suffix else 'historical'})
     expected=json.loads(updated.read_text())
     page.locator('#load').set_input_files({'name':path.name,'mimeType':'application/json','buffer':json.dumps(expected).encode()})
   else:
    expected=json.loads(path.read_text())
    page.locator('#load').set_input_files(str(path))
   expect(page.locator('#load')).to_have_value('')
   assert snapshot(id)==expected,(id,suffix,page.locator('#message').inner_text())
   terminal=page.evaluate('HistoricalBrowserPreview.snapshot()')
   assert terminal['cursor']['complete']
   expect(page.locator('#campaign-result strong')).to_be_visible()
   expect(page.locator('#ai-step')).to_be_disabled()
   page.locator('#undo').click()
   assert not page.evaluate('HistoricalBrowserPreview.snapshot().cursor.complete')
   page.locator('#redo').click()
   assert snapshot(id)==expected
   leave('Save and return')
   card(id).locator('[data-resume]').click();ready(id)
   assert snapshot(id)==expected
   assert page.evaluate('HistoricalBrowserPreview.snapshot().cursor.complete')
   expect(page.locator('#redo')).to_be_disabled()
   print('PASS real-origin terminal restoration, history and IndexedDB:',id,suffix or 'historical',flush=True)
 def verify_live_campaign(id):
  card(id).get_by_role('link',name='New Mission',exact=True).click();ready(id)
  gear=page.locator('#mission-settings');gear.click()
  expect(page.locator('#victory-mode')).to_have_value('historical')
  expect(page.locator('#advanced-crt')).not_to_be_checked()
  assignment=page.locator('#ai-assignment')
  actor=page.evaluate('HistoricalBrowserPreview.snapshot().actor')
  opponent='soviet' if actor=='german' else 'german'
  assignment.select_option(opponent);gear.click()
  # A human-owned opening must not be consumed by the automatic controller.
  before=page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')
  page.locator('#ai-resume').click()
  expect(page.locator('#ai-ownership-status')).to_have_text('Human controls current side')
  assert page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==before
  page.locator('#ai-resume').click()
  gear.click();assignment.select_option(actor);gear.click()
  page.locator('#ai-resume').click()
  page.wait_for_function("HistoricalBrowserPreview.snapshot().actor!=="+json.dumps(actor)+" && document.getElementById('ai-stop').hidden",timeout=180000)
  expect(page.locator('#ai-ownership-status')).to_have_text('Human controls current side')
  assert page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')>before
  gear.click();assignment.select_option('both');gear.click()
  page.locator('#ai-resume').click()
  # Wait for a real terminal state or a controller failure, not a fixed sleep.
  page.wait_for_function("""()=>HistoricalBrowserPreview.snapshot().cursor.complete ||
    (document.getElementById('ai-stop').hidden &&
     document.getElementById('ai-resume').textContent==='Resume automatic play' &&
     document.getElementById('message').textContent.startsWith('AI stopped:'))""",timeout=600000)
  terminal=page.evaluate('HistoricalBrowserPreview.snapshot()')
  assert terminal['cursor']['complete'],page.locator('#message').inner_text()
  expect(page.locator('#ai-resume')).to_be_disabled()
  expect(page.locator('#campaign-result strong')).to_be_visible()
  final=snapshot(id)
  if args.evidence_dir:page.screenshot(path=str(args.evidence_dir/f'{id}-live-terminal.png'),full_page=True)
  leave('Save and return');card(id).locator('[data-resume]').click();ready(id)
  assert snapshot(id)==final
  assert page.evaluate('HistoricalBrowserPreview.snapshot().cursor.complete')
  print('PASS full live browser campaign:',id,terminal['actionCount'],terminal['terminal'],flush=True)
  leave('Discard unsaved progress')
 def leave(label):
  menu();page.get_by_role('button',name='Exit Game',exact=True).click();page.get_by_role('dialog',name='Leave mission').get_by_role('button',name=label,exact=True).click();selector()
 selector()
 if args.live_scenario:
  verify_live_campaign(args.live_scenario)
  assert not errors,errors
  browser.close()
  raise SystemExit(0)
 for id in missions:
  expect(card(id).locator('[data-status]')).to_have_text('No local save')
  card(id).get_by_role('link',name='New Mission',exact=True).click();ready(id);before=snapshot(id)
  if args.evidence_dir:
   page.screenshot(path=str(args.evidence_dir/f'{id}-desktop.png'),full_page=True)
  verify_shell(id);assert snapshot(id)==before
  verify_reference(id)
  leave('Save and return');expect(card(id).locator('[data-resume]')).to_be_visible()
  # An actual successful new save should not be stored in the legacy quota-limited key.
  assert page.evaluate('(id)=>localStorage.getItem(WargameMissionStorage.key(id))===null',id)
  card(id).locator('[data-resume]').click();ready(id);assert snapshot(id)==before
  if id=='battle-for-moscow':
   verify_moscow_orders()
   verify_moscow_pending()
  leave('Discard unsaved progress');expect(card(id).locator('[data-resume]')).to_be_visible()
  card(id).locator('[data-resume]').click();ready(id)
  verify_optional_modes(id)
  if id!='battle-for-moscow':verify_historical_terminal(id)
  leave('Discard unsaved progress')
  print('PASS real-origin save, selector, resume and preservation:',id,flush=True)
 if args.terminal_save:
  path=args.terminal_save.resolve();expected=json.loads(path.read_text());assert expected['state']['over']
  card('battle-for-moscow').locator('[data-resume]').click();ready('battle-for-moscow')
  page.locator('#load-game').set_input_files(str(path));expect(page.locator('#load-game')).to_have_value('');expect(page.locator('#phase-status')).to_contain_text('Game finished')
  assert snapshot('battle-for-moscow')==expected
  leave('Save and return');expect(card('battle-for-moscow').locator('[data-resume]')).to_be_visible()
  card('battle-for-moscow').locator('[data-resume]').click();ready('battle-for-moscow');assert snapshot('battle-for-moscow')==expected
  leave('Discard unsaved progress');print('PASS actual real-origin Moscow terminal mission and exact restoration',flush=True)
 card('battle-for-moscow').locator('[data-resume]').click();ready('battle-for-moscow');menu();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Abandon Mission',exact=True).click();selector()
 expect(card('battle-for-moscow').locator('[data-status]')).to_have_text('No local save')
 for id in missions[1:]:expect(card(id).locator('[data-resume]')).to_be_visible()
 assert not errors,errors
 print('PASS confirmed abandonment is mission-scoped; four other real-origin saves preserved')
 browser.close()
