#!/usr/bin/env python3
"""Real HTTP origin acceptance for all five routes and mission storage.
Run against the local server or a GitHub Pages repository-relative URL.
Uses a new isolated browser context; never modifies an ordinary user's saves.
No intercepted network, localStorage mock, or IndexedDB fixture.
Optional --terminal-save supplies a completed native Moscow JSON from the runner.
"""
import argparse,json,subprocess,os,tempfile,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://localhost:8765/index.html');parser.add_argument('--chromium',default=None);parser.add_argument('--terminal-save',type=Path);parser.add_argument('--evidence-dir',type=Path,help='Capture actual engine screenshots at desktop and tablet widths');parser.add_argument('--live-scenario',choices=['arduous','leningrad','kiev','kiev-odessa'],help='Play one fresh historical campaign through the actual automatic browser controller');parser.add_argument('--operational-parity',action='store_true',help='Run live scenario from the exact authenticated headless opening and compare terminal campaign receipts');args=parser.parse_args()
if args.operational_parity and not args.live_scenario:parser.error('--operational-parity requires --live-scenario')
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
  expect(page.locator('#mission-loading')).to_have_attribute('data-state','ready')
  expect(page.locator('#mission-loading')).to_be_hidden()
  assert page.evaluate("!document.querySelector('main').inert")
  expect(page.locator('#mission-menu-toggle')).to_be_visible()
  # Both production controllers own the same page-lifetime mount contract.
  assert page.evaluate("""async id=>{
   const M=WargameMissionStorage,undo=document.getElementById('undo');
   const fail=()=>{throw Error('duplicate mount replaced callbacks');};
   const redo=M.mountToolbar({undo,redo:fail,settings:fail});
   if(redo!==document.getElementById('redo'))return false;
   // The original anchor was relocated into mission maintenance, not replaced.
   const anchor=document.getElementById(id==='battle-for-moscow'?'save-game':'save').parentElement;
   const args={id,anchor,save:fail,restore:fail,busy:fail};
   const a=M.mount(args),b=M.mount(args);
   if(a!==b)return false;
   await a;
   try{await M.mount({...args,anchor:document.body});return false;}catch(e){
    if(!e.message.includes('another owner'))throw e;
   }
   const events=[],fn=value=>events.push(value);
   const off=M.subscribe(fn);
   if(M.subscribe(fn)!==off)return false;
   const emit=()=>window.dispatchEvent(new StorageEvent('storage',{key:M.key(id)}));
   emit();off();off();emit();
   const again=M.subscribe(fn);off();emit();again();emit();
   return events.length===2&&events.every(v=>v===id);
  }""",id)
  expect(page.locator('.mission-history-toolbar')).to_have_count(1)
  expect(page.locator('#redo')).to_have_count(1)
  expect(page.locator('#mission-settings')).to_have_count(1)
  expect(page.locator('#mission-menu-toggle')).to_have_count(1)
  expect(page.locator('.mission-leave-dialog')).to_have_count(1)
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
 def verify_moscow_stacking_and_interrupt():
  id='battle-for-moscow'
  original=snapshot(id)
  # Start a fresh double-stack mission with a fixed seed through the existing UI.
  gear=page.locator('#mission-settings');gear.click()
  page.locator('#seed').fill('7')
  page.locator('#stacking-mode').select_option('double')
  page.locator('#settings-section details.settings-category').filter(has=page.locator('#new-game')).locator('summary').click()
  page.locator('#new-game').click()
  if gear.get_attribute('aria-pressed')=='true':gear.click()
  opening=snapshot(id)
  for _ in range(5):
   kind=page.evaluate("WargameCore.currentPhase(__nativePreview.configuration(),__nativePreview.getSession().state).kind")
   if kind=='move':break
   assert kind in ('redeployment','combat'),kind
   page.locator('#mission-phase-action').click()
  else:raise AssertionError('Moscow double-stack movement phase not reached')
  order=page.evaluate("""()=>{const s=__nativePreview.getSession();for(const u of s.state.units){
    if(!u.position||u.strength==='dead'||WargameCore.unitSide(u)!==s.state.side)continue;
    for(const m of WargameSession.legal(s,{type:'move',unitId:u.id})){
     const occupants=s.state.units.filter(v=>v.position?.x===m.x&&v.position?.y===m.y&&v.strength!=='dead');
     if(occupants.length===1&&occupants[0].id!==u.id&&WargameCore.unitSide(occupants[0])===s.state.side)return {id:u.id,other:occupants[0].id,x:m.x,y:m.y};
    }
   }return null;}""")
  assert order,'No legal occupied-hex move in source opening'
  before=snapshot(id)
  counter=lambda unit:page.locator('[data-native-unit="'+unit+'"]')
  counter(order['id']).locator('.counter-hit-area').click()
  counter(order['other']).locator('.counter-hit-area').click()
  expect(counter(order['other'])).to_have_attribute('aria-pressed','true')
  assert snapshot(id)==before,'Selecting occupied destination counter committed movement'
  counter(order['id']).locator('.counter-hit-area').click()
  # The highlighted hex is a separate keyboard-accessible destination.
  cell=page.evaluate("""o=>{const u=document.querySelector('[data-native-unit="'+o.other+'"]');const svg=u.closest('svg');const b=u.getBBox();const pt=new DOMPoint(b.x+b.width/2,b.y+b.height/2);return Array.from(svg.querySelectorAll('.native-board-hit[tabindex="0"]')).find(p=>p.isPointInFill(pt))?.dataset.boardCell}""",order)
  assert cell,'Occupied legal hex missing interactive destination'
  page.locator('[data-board-cell="'+cell+'"]').focus();page.keyboard.press('Enter')
  after=snapshot(id)
  occupants=[u for u in after['state']['units'] if u.get('position')=={'x':order['x'],'y':order['y']} and u['strength']!='dead']
  assert {u['id'] for u in occupants}=={order['id'],order['other']}
  page.locator('#undo').click();assert snapshot(id)['state']==before['state']
  page.locator('#redo').click();assert snapshot(id)['state']==after['state']
  print('PASS Moscow occupied-hex double-stack selection, movement and Undo/Redo',flush=True)
  def restore(payload):
   page.locator('#load-game').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(payload).encode()})
   expect(page.locator('#load-game')).to_have_value('')
   assert snapshot(id)==payload
  restore(opening)
  gear.click()
  page.locator('#native-ai-assignment').select_option('german')
  page.locator('#ai-strategy').select_option('objective')
  gear.click()
  profile=json.loads((Path(__file__).resolve().parents[1]/'games/battle-for-moscow/native-preview/ai-config-objective.json').read_text())
  expected=page.evaluate("p=>WargameSession.serialize(WargameNativeSessionAI.playSide(__nativePreview.getSession(),p).session)",profile)
  page.evaluate("""()=>{const initial=__nativePreview.getSession().history.length;const timer=setInterval(()=>{if(__nativePreview.getSession().history.length>initial&&document.getElementById('mission-phase-action').textContent==='Stop AI'){clearInterval(timer);document.getElementById('mission-phase-action').click();}},0);}""")
  page.locator('#native-ai-resume').click()
  page.wait_for_function('document.getElementById("message").textContent.includes("AI paused at a legal action boundary")',timeout=30000)
  paused=snapshot(id)
  assert paused['state']!=opening['state'] and paused['state']['side']=='german'
  assert paused['state']['pendingRoll'] is None
  page.wait_for_timeout(200);assert snapshot(id)==paused
  page.locator('#native-ai-resume').click()
  page.wait_for_function('__nativePreview.getSession().state.side==="soviet"',timeout=30000)
  # Player configuration is portable metadata, not an engine receipt.
  actual=snapshot(id);actual.pop('playerSession',None)
  assert actual==expected
  restore(original)
  print('PASS Moscow persistent Stop AI and exact resumed side journal',flush=True)
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
 def verify_historical_mandatory_orders(id):
  if id not in ('arduous','leningrad'):return
  original=snapshot(id)
  page.set_viewport_size({'width':820,'height':1180})
  page.evaluate("WargameResponsiveShell.setPreference('mobile')")
  toggle=page.locator('#mission-sidebar-toggle')
  snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
  view=lambda:page.evaluate('HistoricalBrowserPreview.view()')
  choose=lambda a:page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',a)
  def close_panel():
   if toggle.get_attribute('aria-expanded')=='true':toggle.click()
  if id=='leningrad':
   close_panel()
   expect(page.locator('#mission-phase-action')).to_have_text('Support orders')
   page.locator('#mission-phase-action').click()
   # Production support window uses map targeting, not the older direct
   # strike button. Select the eligible air counter, then its highlighted
   # Fleet hex and the exact engine-authorized confirmation.
   action=next(a for a in view()['commands'] if a.get('action',{}).get('type')=='declare-fleet-attack')
   face=action['action']['faceId']
   air=page.locator('[data-support-face="'+face+'"]')
   expect(air).to_be_visible()
   air.click()
   fleet_hex=snap()['state']['supportMarkers']['balticFleet']['hex']
   target=page.locator('[data-support-target="'+fleet_hex+'"]')
   expect(target).to_be_visible()
   target.focus();page.keyboard.press('Enter')
   confirm=page.locator('[data-support-confirm]').filter(has_text='Naval air strike')
   expect(confirm).to_have_count(1)
   confirm.click()
   page.get_by_role('button',name='Hide Support window').click()
   assert snap()['combat']['pendingSeaFaceId']==face
   close_panel()
   page.locator('#mission-phase-action').click()
   expect(page.locator('#roll-panel')).to_be_visible()
   pending=snapshot(id)
   page.locator('#die').select_option('6')
   page.locator('#submit-die').click()
   assert snap()['state']['airUse']['1'][face]=='fleet'
   resolved=snapshot(id)
   page.locator('#undo').click();assert snapshot(id)==pending
   page.locator('#redo').click();assert snapshot(id)==resolved
   print('PASS hidden-panel Fleet commitment, die and exact Undo/Redo',flush=True)
  else:
   for _ in range(4):
    if snap()['phaseKind']=='special-movement':break
    a=next(x for x in view()['commands'] if x.get('action',{}).get('type') in ('finish-air-sea','commit-battles','finish-combat') and not x.get('action',{}).get('battles'))
    assert choose(a)
   assert snap()['phaseId']=='german-special-movement'
   for _ in range(5):
    counts={}
    for u in snap()['state']['units'].values():
     if u['owner']=='german' and not u.get('marker'):counts[u['hex']]=counts.get(u['hex'],0)+1
    moves=[a for a in view()['commands'] if a['type']=='declare-ground-move']
    a=next((a for a in moves if counts.get(a['request']['path'][-1],0)>=2),None)
    if a is None:a=next((a for a in moves if counts.get(a['request']['path'][-1],0)==1),None)
    assert a and choose(a) and choose({'type':'resolve-ground-move'})
    if view().get('stackPenalty'):break
   assert view().get('stackPenalty')==1
   close_panel()
   expect(page.locator('#mission-phase-action')).to_have_text('Stacking orders')
   page.locator('#mission-phase-action').click()
   expect(toggle).to_have_attribute('aria-expanded','true')
   page.get_by_role('button',name='End movement — remove 1 excess unit(s)',exact=True).click()
   assert snap()['stackingCleanup']
   close_panel()
   page.locator('#mission-phase-action').click()
   expect(toggle).to_have_attribute('aria-expanded','true')
   locked=snapshot(id);before_count=len(snap()['state']['units'])
   expect(page.locator('#actions button')).to_have_count(3)
   page.locator('#actions button').first.click()
   assert len(snap()['state']['units'])==before_count-1
   resolved=snapshot(id)
   page.locator('#undo').click();assert snapshot(id)==locked
   page.locator('#redo').click();assert snapshot(id)==resolved
   page.get_by_role('button',name='Complete phase after overstack removal',exact=True).click()
   assert snap()['phaseId']=='soviet-buildup'
   print('PASS hidden-panel stacking cleanup and exact Undo/Redo',flush=True)
  assert page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',original)
  assert snapshot(id)==original
  close_panel()
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
  parity_expected=None;headless_report=None
  if args.operational_parity:
   # Run the existing Node controller on the same runner, using identical
   # browser policy defaults (including naval budgets and selection mode).
   # The authenticated opening is transferred through the ordinary restore API.
   with tempfile.TemporaryDirectory() as tmp:
    opening=Path(tmp)/'opening.json';final_path=Path(tmp)/'final.json';report=Path(tmp)/'report.json'
    cmd=['node',str(Path(__file__).resolve().parent/'historical-operational-qualification-v644.test.js'),id,'standard','7','5000','campaign','baseline','greedy','same','3','3']
    subprocess.run(cmd,check=True,timeout=600,env={**os.environ,'BROWSER_PARITY':'1','VICTORY_MODE':'historical','OPENING_SAVE_PATH':str(opening),'FINAL_SAVE_PATH':str(final_path),'AUDIT_PATH':str(report)})
    opening_save=json.loads(opening.read_text());parity_expected=json.loads(final_path.read_text());headless_report=json.loads(report.read_text())
   assert page.evaluate('(save)=>HistoricalBrowserPreview.restore(save)',opening_save),page.locator('#message').inner_text()
   assert snapshot(id)==opening_save,'Authenticated opening was not restored exactly'
   for key in ('ai-policy','ai-policy-soviet'):page.locator('#'+key).select_option('operational')
   for key in ('ai-difficulty','ai-difficulty-soviet'):page.locator('#'+key).select_option('3')
   assignment.select_option('both');gear.click()
  else:
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
  baseline=page.evaluate('HistoricalBrowserPreview.performanceStats()')
  started=time.monotonic()
  page.locator('#ai-resume').click()
  # Sample actual committed progress, not speculative actions or fixed sleeps.
  try:
   while True:
    info=page.evaluate("""()=>{const s=HistoricalBrowserPreview.snapshot();return {turn:s.cursor.turn,phase:s.phaseId,actor:s.actor,actions:s.actionCount,complete:s.cursor.complete,ownership:document.getElementById('ai-ownership-status').textContent,message:document.getElementById('message').textContent,running:!document.getElementById('ai-stop').hidden,timing:HistoricalBrowserPreview.performanceStats()}}""")
    print('LIVE',id,round(time.monotonic()-started,2),json.dumps(info),flush=True)
    if info['complete'] or (not info['running'] and info['message'].startswith('AI stopped:')):break
    assert info['timing'].get('humanView',{}).get('count',0)==baseline.get('humanView',{}).get('count',0), 'Human catalogue rebuilt during AI/AI'
    if time.monotonic()-started>=600:raise AssertionError('Campaign timed out: '+json.dumps(info))
    page.wait_for_timeout(1000 if args.operational_parity else 5000)
  finally:
   if args.evidence_dir:
    (args.evidence_dir/f'{id}-performance.json').write_text(json.dumps(page.evaluate('HistoricalBrowserPreview.performanceStats()'),indent=2))
  print('LIVE elapsed seconds',id,round(time.monotonic()-started,2),flush=True)
  terminal=page.evaluate('HistoricalBrowserPreview.snapshot()')
  assert terminal['cursor']['complete'],page.locator('#message').inner_text()
  expect(page.locator('#ai-resume')).to_be_disabled()
  expect(page.locator('#campaign-result strong')).to_be_visible()
  final=snapshot(id)
  if args.operational_parity:
   # Portable player metadata differs from Node; compare the authenticated
   # campaign envelope including every receipt, opening and final state hash.
   actual=final['campaign']
   elapsed=time.monotonic()-started
   result={'scenario':id,'seed':7,'difficulty':3,'browserSeconds':elapsed,'headlessSeconds':headless_report['computeElapsedMs']/1000,'actions':terminal['actionCount'],'exactCampaign':actual==parity_expected,'terminal':terminal['terminal']}
   if args.evidence_dir:
    (args.evidence_dir/f'{id}-operational-parity.json').write_text(json.dumps(result,indent=2))
   print('OPERATIONAL PARITY',json.dumps(result),flush=True)
   assert actual['bindings']==parity_expected['bindings'],'Opening/configuration binding differs'
   if actual['journal']!=parity_expected['journal']:
    first=next((i for i,(x,y) in enumerate(zip(actual['journal'],parity_expected['journal'])) if x!=y),min(len(actual['journal']),len(parity_expected['journal'])))
    raise AssertionError(f'First differing receipt: {first}; journal lengths: {len(actual["journal"])} / {len(parity_expected["journal"])}')
   assert actual==parity_expected,'Campaign envelope differs'
   assert terminal['terminal']==headless_report['terminal']
   assert info['timing'].get('boardSave',{}).get('count',0)==0
  if args.evidence_dir:page.screenshot(path=str(args.evidence_dir/f'{id}-live-terminal.png'),full_page=True)
  leave('Save and return');card(id).locator('[data-resume]').click();ready(id)
  assert snapshot(id)==final
  assert page.evaluate('HistoricalBrowserPreview.snapshot().cursor.complete')
  print('PASS full live browser campaign:',id,terminal['actionCount'],terminal['terminal'],flush=True)
  leave('Discard unsaved progress')
 def leave(label):
  menu();page.get_by_role('button',name='Exit Game',exact=True).click();page.get_by_role('dialog',name='Leave mission').get_by_role('button',name=label,exact=True).click();selector()
 selector()
 if not args.live_scenario:
  # Isolated fault injection; normal real-origin acceptance below is unchanged.
  from urllib.parse import urljoin
  target=card('arduous').get_by_role('link',name='New Mission',exact=True)
  mission_url=urljoin(page.url,target.get_attribute('href'))
  probe=context.new_page()
  probe.emulate_media(reduced_motion='reduce')
  held=[]
  def delay_config(route):
   held.append(route)
  pattern='**/games/arduous/native-preview/config.json'
  probe.route(pattern,delay_config)
  probe.goto(mission_url,wait_until='domcontentloaded')
  expect(probe.locator('#mission-loading')).to_be_visible()
  expect(probe.locator('#mission-loading')).to_have_attribute('data-state','loading')
  expect(probe.locator('[data-loading-status]')).to_contain_text('configuration')
  assert probe.evaluate("document.querySelector('main').inert")
  assert probe.locator('.mission-loading-spinner').evaluate("(el)=>getComputedStyle(el).animationName")=='none'
  until=time.monotonic()+10
  while not held and time.monotonic()<until:probe.wait_for_timeout(50)
  assert len(held)==1
  if args.evidence_dir:
   probe.screenshot(path=str(args.evidence_dir/'arduous-loading-desktop.png'))
   probe.set_viewport_size({'width':820,'height':1180})
   probe.screenshot(path=str(args.evidence_dir/'arduous-loading-tablet.png'))
  held[0].abort('failed')
  expect(probe.locator('#mission-loading')).to_have_attribute('data-state','error')
  expect(probe.get_by_role('button',name='Retry loading')).to_be_visible()
  expect(probe.get_by_role('link',name='Choose mission',exact=True)).to_be_visible()
  assert probe.evaluate("document.querySelector('main').inert")
  if args.evidence_dir:probe.screenshot(path=str(args.evidence_dir/'arduous-loading-error.png'))
  probe.unroute(pattern,delay_config)
  probe.get_by_role('button',name='Retry loading').click()
  expect(probe.locator('#mission-loading')).to_have_attribute('data-state','ready',timeout=60000)
  expect(probe.locator('#mission-loading')).to_be_hidden()
  assert probe.evaluate("!document.querySelector('main').inert")
  probe.close()
  print('PASS delayed startup, reduced motion, resource failure and retry',flush=True)
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
  # Exercise the shared transport in the actual browser, independent of menu placement.
  with page.expect_download() as export:
   page.evaluate("id=>document.getElementById(id==='battle-for-moscow'?'save-game':'save').click()",id)
  exported=export.value
  if id=='battle-for-moscow':assert exported.suggested_filename==f'native-{id}-turn-{before["state"]["turn"]}.json'
  else:assert exported.suggested_filename in ('historical-deployment-save.json','historical-candidate-save.json')
  assert json.loads(Path(exported.path()).read_text())==before
  verify_reference(id)
  # Cancellation must not mutate or navigate, and must release the controls.
  menu()
  page.once('dialog',lambda d:d.dismiss())
  page.get_by_role('button',name='Abandon Mission',exact=True).click()
  expect(page.get_by_role('button',name='Save Mission',exact=True)).to_be_enabled()
  assert snapshot(id)==before
  assert not page.evaluate("(id)=>WargameMissionStorage.defaultStore().exists(id)",id)
  menu();page.get_by_role('button',name='Exit Game',exact=True).click()
  dialog=page.get_by_role('dialog',name='Leave mission')
  dialog.get_by_role('button',name='Cancel',exact=True).click()
  expect(dialog).to_be_hidden()
  assert snapshot(id)==before
  leave('Save and return');expect(card(id).locator('[data-resume]')).to_be_visible()
  # An actual successful new save should not be stored in the legacy quota-limited key.
  assert page.evaluate('(id)=>localStorage.getItem(WargameMissionStorage.key(id))===null',id)
  card(id).locator('[data-resume]').click();ready(id);assert snapshot(id)==before
  menu();page.once('dialog',lambda d:d.dismiss())
  page.get_by_role('button',name='Resume Mission',exact=True).click()
  expect(page.get_by_role('button',name='Resume Mission',exact=True)).to_be_enabled()
  assert snapshot(id)==before
  assert page.evaluate("(id)=>WargameMissionStorage.defaultStore().exists(id)",id)
  page.locator('#mission-menu-toggle').click()
  if id=='battle-for-moscow':
   verify_moscow_orders()
   verify_moscow_stacking_and_interrupt()
   verify_moscow_pending()
  else:verify_historical_mandatory_orders(id)
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
