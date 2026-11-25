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
 fixture=json.loads(subprocess.check_output(['node',str(ROOT/'tests/b4m-double-stack-browser-fixture-v686.js')],text=True))
 page.locator('#load-game').set_input_files({'name':'pending.json','mimeType':'application/json','buffer':json.dumps(fixture['pending']).encode()})
 page.wait_for_function("!!document.querySelector('#choice-stand-fast')")
 assert raw()==fixture['pending']
 page.locator('#choice-stand-fast').select_option('s5')
 assert page.locator('#choice-advance').is_disabled()
 assert all(page.locator('[data-stack-retreat]').nth(i).is_disabled() for i in range(page.locator('[data-stack-retreat]').count()))
 assert raw()==fixture['pending']
 page.locator('#resolve-battle').click()
 assert raw()==fixture['hold']
 page.locator('#undo').click();assert raw()==fixture['pending']
 page.locator('#redo').click();assert raw()==fixture['hold']
 page.locator('#undo').click();assert raw()==fixture['pending']
 page.locator('#choice-stand-fast').select_option('none')
 assert page.locator('#choice-advance').is_enabled()
 if page.locator('#choice-advance').count():page.locator('#choice-advance').select_option('none')
 page.locator('#resolve-battle').click();assert raw()==fixture['retreat']
 assert page.locator('#redo').is_disabled()
 assert not errors,errors
 print('PASS stacked human Stand Fast and retreat, exact session and Undo/Redo',flush=True)
 browser.close()
