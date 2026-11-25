#!/usr/bin/env python3
"""Real isolated-Chromium Leningrad human browser test using source modules and real art.

Hosted navigation is blocked in this environment. Only fetch transport is
replaced by byte-for-byte local JSON. The browser executes the packaged engine,
GUI and original artwork without a mocked rules implementation.
"""
import json,base64,subprocess,hashlib,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
visual=root/'rules/audit/visual';visual.mkdir(parents=True,exist_ok=True)
html=(root/'games/leningrad/native-preview/index.html').read_text()
html=html[:html.index('<script src=')]+html[html.index('</body>',html.index('<script src=')):]
config=json.loads((root/'games/leningrad/native-preview/config.json').read_text())
sources={'config.json':config}
for key in ['map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy']:
 sources[config[key]]=json.loads((root/config[key].replace('../../../','')).read_text())
map_svg=(root/'exports/leningrad.svg').read_bytes()
assert b'forest-drop-shadow' not in map_svg
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1500,'height':950},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'games/leningrad/native-preview/style.css').read_text())
 page.evaluate("""sources => {window.fetch=async path=>({ok:Object.prototype.hasOwnProperty.call(sources,String(path)),status:404,json:async()=>sources[String(path)]});}""",sources)
 for name in ['sync_sha256.js','official_counter_templates.js','counter_visuals.js','historical_counter_face_projection.js','historical_engine_browser_bundle.js','historical_browser_app.js']:
  page.add_script_tag(content=(root/'core'/name).read_text())
 page.wait_for_function('Boolean(window.HistoricalBrowserPreview)',timeout=25000)
 src='data:image/svg+xml;base64,'+base64.b64encode(map_svg).decode()
 page.locator('#map-art').evaluate('(image,src)=>image.src=src',src)
 page.wait_for_function("document.querySelector('#map-art').complete && document.querySelector('#map-art').naturalWidth>0",timeout=30000)
 def run_js(js):return page.evaluate(js)
 assert run_js('HistoricalBrowserPreview.snapshot().cursor.turn')==1
 assert run_js('HistoricalBrowserPreview.snapshot().actor')=='german'
 assert page.locator('.official-counter').count()==19
 page.locator('.counter-hit-area').first.click(force=True)
 assert page.locator('#filter').input_value().startswith('leningrad-')
 page.locator('#filter').fill('')
 with page.expect_download() as result:
  page.locator('#save').click()
 assert result.value.suggested_filename=='historical-candidate-save.json'
 assert run_js('WargameSyncSha256.sha256("abc")')=='ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
 first_save=run_js('HistoricalBrowserPreview.save()')
 # Browser and independent Node must produce exactly the same source-state digest.
 node_script="""const H=require('./core/historical_campaign_human');const C=require('./core/historical_campaign_session');const B=require('./core/scenario_opening_bridge');const I=require('./core/leningrad_starting_inventory');const F=require('./tests/fixtures/leningrad-source-setup-v357');const map=require('./maps/leningrad.json');const cc=require('./maps/counter-configs/leningrad.json');const setup=require('./maps/setup/leningrad.json');const p=require('./maps/movement-configs/leningrad.json');const cfg=require('./maps/phase-configs/leningrad.json');const cb=require('./maps/combat-configs/leningrad.json');const bp=require('./maps/buildup-configs/leningrad.json');const hp=require('./maps/housekeeping-configs/leningrad.json');const opening=B.create({map,setupSpec:setup,counterConfig:cc,inventory:I,allocation:F.selected,placements:F.placements,phaseConfig:cfg,movementProfile:p,phaseFactories:{combat:()=>({})},supportPolicy:cb}).snapshot();const context={...JSON.parse(JSON.stringify(opening)),map,profile:p,config:cfg,counterConfig:cc,combatPolicy:cb,enableAirSupport:true,buildupPolicy:bp,buildupAllocation:F.selected,housekeepingPolicy:hp};console.log(JSON.stringify(H.create({session:C.create(context),context}).save()));"""
 node_save=json.loads(subprocess.check_output(['node','-e',node_script],cwd=root,text=True))
 assert first_save==node_save,'Browser/Node session or SHA256 parity failed'
 assert page.locator('#map-art').evaluate('(im)=>im.naturalWidth')>0
 assert page.locator('.hex-hit').count()>150
 # Canonical source-face labels must be printable (not internal IDs),
 # with correct concealment and source Army size marks.
 labels=run_js('''[...document.querySelectorAll('.official-counter')].map(p=>({
  id:p.getAttribute('data-unit-id'),name:p.querySelector('[data-role=unit_id]').textContent,
  size:p.querySelector('[data-role=size]').textContent}))''')
 assert all('leningrad-' not in x['name'] for x in labels),labels
 assert len([x for x in labels if x['name']=='*'])==4,labels
 assert all(x['size'] in ['XXX','XXXX'] for x in labels),labels
 # The first decision is the Air/Sea window. Resolve via a real GUI button.
 page.locator('#actions button').filter(has_text='finish air sea').click()
 options=run_js('HistoricalBrowserPreview.view()')
 assert options['phaseKind']=='combat' and len(options['proposals'])>0
 assert page.locator('#battle-proposals input[type=checkbox]').count()>0
 page.locator('#battle-proposals input[type=checkbox]').first.check()
 page.locator('#commit-battles').click()
 assert run_js('HistoricalBrowserPreview.snapshot().combat.status')=='committed'
 page.locator('#actions button').filter(has_text='Resolve battle at').first.click()
 assert run_js('HistoricalBrowserPreview.snapshot().combat.status')=='battle-selected'
 no_air=page.locator('#actions button').filter(has_text='Commit no air support')
 if no_air.count():no_air.first.click()
 assert not page.locator('#roll-panel').is_hidden()
 before_roll=run_js('HistoricalBrowserPreview.save()')
 # Exactly one die is committed; automatic NE requires a null die instead.
 post=False
 for d in [1,2,3,4,5,6,None]:
  if d is None:page.locator('#automatic-ne').click()
  else:
   page.locator('#die').select_option(str(d))
   page.locator('#submit-die').click()
  if run_js('HistoricalBrowserPreview.view().kind')=='post-roll-choice':post=True;break
 assert post,'no valid authoritative CRT choice found'
 after_roll=run_js('HistoricalBrowserPreview.save()')
 assert after_roll['pendingRoll'] is not None
 assert after_roll['campaign']==before_roll['campaign'],'die commit should not alter campaign state'
 assert run_js('HistoricalBrowserPreview.view().kind')=='post-roll-choice'
 assert page.locator('#actions button').count()>0
 assert page.locator('#roll-panel').is_hidden()
 screenshot=visual/'leningrad-human-browser-v403.png'
 page.screenshot(path=str(screenshot),full_page=True,animations='disabled')
 # UI Undo removes the committed but not-yet-adjudicated die.
 page.locator('#undo').click()
 assert run_js('HistoricalBrowserPreview.save()')==before_roll
 # Save to file and verify upload restores both die and consequences.
 page.locator('#load').set_input_files(files=[{'name':'v402-pending.json','mimeType':'application/json',
  'buffer':json.dumps(after_roll).encode()}])
 page.wait_for_function('expected => HistoricalBrowserPreview.save().integrity.digest===expected',arg=after_roll['integrity']['digest'],timeout=15000)
 assert run_js('HistoricalBrowserPreview.save()')==after_roll
 # A forged checksum must be rejected WITHOUT changing the current game.
 forged=json.loads(json.dumps(after_roll));forged['pendingRoll']['die']=5 if after_roll['pendingRoll']['die']!=5 else 1
 page.locator('#load').set_input_files(files=[{'name':'bad-v402.json','mimeType':'application/json',
  'buffer':json.dumps(forged).encode()}])
 page.wait_for_function("document.querySelector('#message').textContent.includes('Load rejected')",timeout=12000)
 assert 'Load rejected' in page.locator('#message').inner_text()
 assert run_js('HistoricalBrowserPreview.save()')==after_roll
 # Apply a real validated post-roll consequence from a visible player choice.
 old_count=run_js('HistoricalBrowserPreview.snapshot().actionCount')
 page.locator('#actions button').first.click()
 assert run_js('HistoricalBrowserPreview.snapshot().actionCount')==old_count+1
 resolved_save=run_js('HistoricalBrowserPreview.save()')
 page.locator('#undo').click()
 assert run_js('HistoricalBrowserPreview.snapshot().actionCount')==old_count
 page.locator('#new-game').click()
 assert run_js('HistoricalBrowserPreview.save()')==first_save
 # AI step is a separate test policy; it still commits an actual engine action.
 page.locator('#ai-step').click()
 assert run_js('HistoricalBrowserPreview.snapshot().actionCount')==1
 # A baseline AI opponent can finish its current side without manually clicking
 # dozens of individual actions; it still uses source-authorized transactions.
 page.locator('#ai-side').click()
 page.wait_for_function("!document.querySelector('#ai-side').disabled",timeout=75000)
 assert run_js('HistoricalBrowserPreview.snapshot().actor')!='german' or run_js('HistoricalBrowserPreview.snapshot().cursor.complete')
 assert not errors,errors
 report={'checkpoint':169,'version':'v403','status':'PASS','browser':'real isolated Chromium with source-byte JSON fetch',
  'networkNavigation':'blocked by administrator; not independently certified',
  'scenario':'leningrad','setup':'candidate, not certified',
  'moduleCount':run_js('HistoricalCampaignBrowserEngine.moduleCount'),
  'counterCount':19,'mapSvgSHA256':hashlib.sha256(map_svg).hexdigest(),
  'sameByteStateAsNode':True,'battleViaGUI':True,'dieCommitBeforeConsequences':True,
  'pendingDieFileRestore':True,'saveDownload':True,'counterClickFilter':True,'invalidSaveFailClosed':True,'undo':True,'baselineAiStep':True,'baselineAiSide':True,
  'visualScreenshot':str(screenshot.relative_to(root)),
  'limitations':['Source-certified individual counter assignment and printed coordinates pending',
   'Full eight-turn user-operated browser acceptance not yet demonstrated',
   'Hosted Chromium navigation blocked by administrator',
   'Oberlabs UX parity deferred by user']}
 (root/'rules/audit/leningrad-human-browser-v403.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
 browser.close()
