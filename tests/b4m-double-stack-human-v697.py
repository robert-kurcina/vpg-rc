"""Native Moscow local save integration using shipped page and existing source transport fixture."""
import json,re,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from native_browser_asset_fixture import install_fetch
folder=ROOT/'games/battle-for-moscow/native-preview';html=(folder/'index.html').read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(folder/m.group(1)).read_text()+'</style>',html)
paths=re.findall(r'<script src="([^"]+)"></script>',html);html=re.sub(r'<script src="[^"]+"></script>','',html)
files={p:json.loads((folder/p).read_text()) for p in ['../game.json','../map.json','../units.json','../deployments.json','../rules.json','../objectives.json','config.json','ui-config.json','ai-config.json','ai-config-objective.json','ai-config-capture.json','../../../maps/battle-for-moscow.json','../../../maps/registry.json']}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1440,'height':950});page.set_default_timeout(20000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded');install_fetch(page,files,ROOT)
 page.evaluate('''()=>{const m=new Map();Object.defineProperty(window,'localStorage',{value:{getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}})}''')
 for p in paths:page.add_script_tag(content=(folder/p).read_text())
 page.evaluate('window.__nativePreviewReady');page.wait_for_function('!!__nativePreview.getSession()')
 raw=lambda:page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 import subprocess
 fixtures=json.loads(subprocess.check_output(['node',str(ROOT/'tests/b4m-double-stack-browser-fixture-v697.js')],text=True))
 for outcome,fixture in fixtures.items():
  page.locator('#load-game').set_input_files({'name':'pending.json','mimeType':'application/json','buffer':json.dumps(fixture['pending']).encode()})
  page.wait_for_function("!!document.querySelector('#choice-defender-loss')")
  assert raw()==fixture['pending']
  choices=fixture['choices']
  page.locator('#choice-defender-loss').select_option(choices['defenderLossId'])
  if outcome=='EX':page.locator('#choice-exchange').fill(','.join(choices['exchangeOrder']))
  for id,point in choices['retreats'].items():page.locator(f'[data-stack-retreat="{id}"]').select_option(f"{point['x']},{point['y']}")
  page.locator('#choice-advance').select_option('none')
  assert raw()==fixture['pending']
  page.locator('#resolve-battle').click();assert raw()==fixture['resolved']
  page.locator('#undo').click();assert raw()==fixture['pending']
  page.locator('#redo').click();assert raw()==fixture['resolved']
  print(f'PASS {outcome}: explicit defender loss, separate retreats, no advance, exact session and Undo/Redo',flush=True)
 assert not errors,errors
 browser.close()
