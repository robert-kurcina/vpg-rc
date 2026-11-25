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
 before=raw()
 page.locator('#mission-settings').click()
 page.locator('#stacking-mode').select_option('double')
 assert raw()==before
 page.locator('#advanced-crt').check()
 page.locator('[data-game-tab=play]').click();page.locator('#new-game').click()
 page.wait_for_function("__nativePreview.getSession().config.rules.specialRules.some(x=>x.module==='stacked-battle-v1')")
 double=raw();assert double['packageSHA256']!=before['packageSHA256']
 page.locator('[data-game-tab=play]').click()
 page.locator('#mission-menu-toggle').click();page.get_by_role('button',name='Save Mission',exact=True).click()
 page.locator('#finish-phase').click();after=raw();assert after!=double
 page.locator('#undo').click();assert raw()==double
 page.locator('#redo').click();assert raw()==after
 page.locator('#mission-settings').click();page.locator('#stacking-mode').select_option('historical');page.locator('#advanced-crt').uncheck();page.locator('[data-game-tab=play]').click();page.locator('#new-game').click()
 assert raw()['packageSHA256']==before['packageSHA256']
 page.locator('[data-game-tab=play]').click();page.locator('#mission-menu-toggle').click();page.once('dialog',lambda d:d.accept());page.get_by_role('button',name='Resume Mission',exact=True).click();assert raw()==double
 assert page.locator('#stacking-mode').input_value()=='double' and page.locator('#advanced-crt').is_checked()
 assert not errors,errors
 print('PASS native Moscow Settings, new mission only, historical fingerprint, double Advanced save/resume and exact Undo/Redo',flush=True)
 browser.close()
