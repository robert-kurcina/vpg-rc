#!/usr/bin/env python3
"""Actual Chromium, actual shared-engine map, source-grounded 117-link review."""
from pathlib import Path
import json,base64
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
read=lambda f: json.loads((ROOT/f).read_text())
prior=read('rules/audit/odessa-composite-movement-candidate-v493.json')
trace=read('rules/audit/odessa-source-railway-trace-v495.json')
ledger=read('maps/movement-configs/odessa-source-route-rail-ledger-v496.json')
html=(ROOT/'tools/odessa-movement-review/index.html').read_text()
art='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev-odessa.png').read_bytes()).decode()
bootstrap='<script>window.__data='+json.dumps({'topology':prior,'trace':trace,'ledger':ledger}).replace('</script',r'<\/script')+''';window.fetch=async url=>({ok:true,json:async()=>String(url).includes("odessa-source-route-rail-ledger")?window.__data.ledger:String(url).includes("odessa-source-railway-trace")?window.__data.trace:window.__data.topology});</script>'''
html=html.replace('<script>\n(async()=>',bootstrap+'<script>\n(async()=>')
html=html.replace('src="../../exports/kiev-odessa.png"',f'src="{art}"')
shots=ROOT/'rules/audit/visual';shots.mkdir(parents=True,exist_ok=True)
checks=0
def ok(value,msg):
 global checks
 assert value,msg
 checks+=1
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1430,'height':1030},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=45000)
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===24')
 ok(page.locator('#map-art').evaluate('(img)=>img.complete && img.naturalWidth===1360 && img.naturalHeight===1350'),'actual shared-engine map export')
 ok(page.locator('#overlay circle').count()==24,'original seam retained')
 page.locator('input[value="rail-added"]').check()
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===77')
 ok(page.locator('#overlay circle[data-kind="rail-added"]').count()==77,'77 source-only links')
 ok(page.locator('#results button').count()==77,'77 navigable source-only links')
 page.locator('#results button').first.click()
 ok('source railway' in page.locator('#detail').inner_text(),'source route displayed')
 ok('not authorized' in page.locator('#detail').inner_text(),'no gameplay claim')
 page.screenshot(path=str(shots/'odessa-reconciled-rail-links-browser-v496.png'),full_page=True)
 page.locator('input[value="rail-unmatched"]').check()
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===2')
 ok(page.locator('#results button').nth(0).inner_text().startswith('1106 ↔ 1107'),'ordinary shortcut #1')
 ok(page.locator('#results button').nth(1).inner_text().startswith('1106 ↔ 1205'),'ordinary shortcut #2')
 page.locator('#results button').first.click()
 ok('direct ordinary-ground shortcut' in page.locator('#detail').inner_text(),'not railway classification')
 ok('1206' in page.locator('#detail').inner_text(),'source rail detour specified')
 ok('do not authorize this shortcut as rail' in page.locator('#detail').inner_text(),'no false direct rail')
 page.screenshot(path=str(shots/'odessa-ground-shortcuts-browser-v496.png'),full_page=True)
 page.locator('input[value="rail-source"]').check()
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===117')
 ok(page.locator('#overlay circle').count()==117,'all 117 traced source railway links')
 page.locator('input[value="shore-land-land"]').check()
 ok(page.locator('#overlay circle').count()==7,'seven impassable Coast barriers')
 page.set_viewport_size({'width':390,'height':844})
 page.locator('input[value="rail-added"]').check()
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===77')
 ok(page.locator('#map-art').is_visible(),'mobile source map visible')
 ok(page.locator('#results button').count()==77,'mobile rail review')
 ok('not authorized' in page.locator('footer').inner_text(),'experimental source audit only')
 ok(not errors,'no page errors '+repr(errors))
 browser.close()
print('PASS Odessa reconciled rail Chromium v496',checks,'checks')
