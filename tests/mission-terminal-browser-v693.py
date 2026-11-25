"""Real native Moscow UI with full played terminal saves and a quota-limited
storage/IndexedDB transaction fixture. The actual hosted origin gate remains separate.
Usage: python tests/mission-terminal-browser-v693.py [--saves DIRECTORY]
Without --saves, generates two fresh, complete seed-71 campaigns in a temp directory.
"""
import argparse,json,os,re,subprocess,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from native_browser_asset_fixture import install_fetch
parser=argparse.ArgumentParser();parser.add_argument('--saves',type=Path);args=parser.parse_args()
work=tempfile.TemporaryDirectory() if args.saves is None else None
saves=args.saves if args.saves else Path(work.name)
profiles=[('historical','standard','historical','historical'),('variant','advanced','double','graduated')]
if work:
 for name,crt,stack,victory in profiles:
  env={**os.environ,'SAVE_PATH':str(saves/(name+'.json')),'B4M_STACKING':stack,'VICTORY_MODE':victory}
  report=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/run-native-campaign.js'),crt,'71','5000','0','0'],env=env,text=True,cwd=ROOT))
  assert report['status']=='complete' and report['exactRestore']
folder=ROOT/'games/battle-for-moscow/native-preview';html=(folder/'index.html').read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(folder/m.group(1)).read_text()+'</style>',html)
paths=re.findall(r'<script src="([^"]+)"></script>',html);html=re.sub(r'<script src="[^"]+"></script>','',html)
files={p:json.loads((folder/p).read_text()) for p in ['../game.json','../map.json','../units.json','../deployments.json','../rules.json','../objectives.json','config.json','ui-config.json','ai-config.json','ai-config-objective.json','ai-config-capture.json','../../../maps/battle-for-moscow.json','../../../maps/registry.json']}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1180,'height':820});page.set_default_timeout(30000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded');install_fetch(page,files,ROOT)
 page.add_script_tag(path=str(ROOT/'tests/fixtures/mission-indexeddb-fixture-v693.js'))
 page.evaluate('''()=>{window.dbFixture=MissionStorageFixture.fixture();Object.defineProperty(window,'indexedDB',{value:dbFixture.indexedDB});Object.defineProperty(window,'localStorage',{value:MissionStorageFixture.quotaStorage()});}''')
 for p in paths:page.add_script_tag(content=(folder/p).read_text())
 page.evaluate('window.__nativePreviewReady');page.wait_for_function('!!__nativePreview.getSession()')
 raw='WargameSession.serialize(__nativePreview.getSession())'
 for name,crt,stack,victory in profiles:
  path=saves/(name+'.json');expected=json.loads(path.read_text());sha=expected['sha256'];n=len(expected['history']);assert path.stat().st_size>5*1024*1024
  page.locator('#load-game').set_input_files(str(path));expect(page.locator('#load-game')).to_have_value('',timeout=60000);expect(page.locator('#phase-status')).to_contain_text('Game finished',timeout=60000)
  assert page.evaluate(raw+'.sha256')==sha;assert page.evaluate(raw+'.history.length')==n
  assert page.locator('#finish-phase').is_disabled();assert page.locator('#stacking-mode').input_value()==stack and page.locator('#victory-mode').input_value()==victory
  assert page.locator('#advanced-crt').is_checked()==(crt=='advanced')
  assert page.evaluate('''()=>{try{WargameMissionStorage.write(localStorage,'battle-for-moscow',WargameSession.serialize(__nativePreview.getSession()));return false;}catch(e){return e.name==='QuotaExceededError';}}''')
  page.locator('#mission-menu-toggle').click();page.get_by_role('button',name='Save Mission',exact=True).click()
  expect(page.locator('.mission-local-status')).to_have_text('Mission saved on this browser.',timeout=60000)
  assert page.evaluate('''async()=>{const stored=await WargameMissionStorage.defaultStore().read('battle-for-moscow');return JSON.stringify(stored)===JSON.stringify(WargameSession.serialize(__nativePreview.getSession()));}''')
  # The complete save retains the last Undo state, and the actual menu restores it.
  page.locator('#undo').click();assert not page.evaluate('__nativePreview.getSession().state.over');assert page.locator('#redo').is_enabled()
  page.locator('#redo').click();assert page.evaluate(raw+'.sha256')==sha
  page.locator('#undo').click();assert not page.evaluate('__nativePreview.getSession().state.over')
  if not page.locator('#mission-menu').is_visible():page.locator('#mission-menu-toggle').click()
  page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Resume Mission',exact=True).click()
  expect(page.locator('.mission-local-status')).to_have_text('Saved mission restored.',timeout=60000)
  assert page.evaluate(raw+'.sha256')==sha;assert page.locator('#finish-phase').is_disabled();assert page.locator('#redo').is_disabled()
  # Cancel is initial focus; cancellation and rejected storage writes are non-destructive.
  page.get_by_role('button',name='Exit Game',exact=True).click();dialog=page.get_by_role('dialog',name='Leave mission');expect(dialog).to_be_visible();expect(dialog.get_by_role('button',name='Cancel')).to_be_focused();dialog.get_by_role('button',name='Cancel').click()
  assert page.evaluate(raw+'.sha256')==sha
  print(f'PASS {name}: {path.stat().st_size} bytes, {n} committed history snapshots, terminal UI, exact database save/resume, Undo/Redo, safe exit focus (transport fixture)',flush=True)
  if page.locator('#mission-menu').is_visible():page.locator('#mission-menu-toggle').click()
 assert not errors,errors
 browser.close()
