#!/usr/bin/env python3
"""Actual-engine Kiev–Odessa route and discrepancy review acceptance."""
from pathlib import Path
import json,base64
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
source=json.loads((ROOT/'rules/audit/odessa-source-railway-trace-v495.json').read_text())
prior=json.loads((ROOT/'rules/audit/odessa-composite-movement-candidate-v493.json').read_text())
html=(ROOT/'tools/odessa-movement-review/index.html').read_text()
base='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev-odessa.png').read_bytes()).decode()
bootstrap='<script>window.__topology='+json.dumps(prior).replace('</script',r'<\/script')+';window.__rail='+json.dumps(source).replace('</script',r'<\/script')+';window.__ledger='+json.dumps(json.loads((ROOT/'maps/movement-configs/odessa-source-route-rail-ledger-v496.json').read_text())).replace('</script',r'<\/script')+';window.fetch=async url=>({ok:true,json:async()=>String(url).includes("odessa-source-railway-trace")?window.__rail:String(url).includes("odessa-source-route-rail-ledger")?window.__ledger:window.__topology});</script>'
html=html.replace('<script>\n(async()=>',bootstrap+'<script>\n(async()=>')
html=html.replace('src="../../exports/kiev-odessa.png"',f'src="{base}"')
assert 'window.__rail' in html
out=ROOT/'rules/audit/visual';out.mkdir(parents=True,exist_ok=True)
checks=0
def ok(value,message):
 global checks
 assert value,message
 checks+=1
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1440,'height':1024},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=45000)
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===24')
 ok(page.locator('#overlay circle').count()==24,'legacy seam dots preserved')
 ok(page.locator('#map-art').evaluate('(img)=>img.complete && img.naturalWidth===1360 && img.naturalHeight===1350'),'actual shared-engine map asset loaded')
 page.locator('input[value="rail-source"]').check()
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===117')
 ok(page.locator('input[value="rail-source"]').is_checked(),'rail filter selected')
 ok(page.locator('#overlay circle[data-kind="rail-source"]').count()==117,'117 source-traced railway edge points')
 ok(page.locator('#results button').count()==117,'117 navigable edges')
 ok('117' in page.locator('#source-summary').inner_text(),'railway count visible')
 ok('77' in page.locator('#source-summary').inner_text(),'incomplete annotation count visible')
 ok('2 unsupported' in page.locator('#source-summary').inner_text(),'unsupported annotation count visible')
 page.locator('#results button').first.click()
 ok('path' in page.locator('#detail').inner_text(),'traced source SVG path ID shown')
 ok('not authorized for rail movement' in page.locator('#detail').inner_text(),'no gameplay claim')
 page.screenshot(path=str(out/'odessa-source-railway-browser-v495.png'),full_page=True)
 page.locator('input[value="rail-unmatched"]').check()
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===2')
 ok(page.locator('#results button').count()==2,'two unmatched-annotation review entries')
 ok(page.locator('#results button').nth(0).inner_text().startswith('1106 ↔ 1107'),'first exact mismatch')
 ok(page.locator('#results button').nth(1).inner_text().startswith('1106 ↔ 1205'),'second exact mismatch')
 page.locator('#results button').nth(0).click()
 ok('do not authorize' in page.locator('#detail').inner_text(),'untraced rail annotation explanation')
 ok(page.locator('#overlay circle.selected').count()==1,'diagnostic selection visible')
 page.screenshot(path=str(out/'odessa-rail-unmatched-browser-v495.png'),full_page=True)
 page.locator('input[value="shore-land-land"]').check()
 ok(page.locator('#overlay circle').count()==7,'original Coast barrier filter preserved')
 page.locator('input[value="seam"]').check()
 ok(page.locator('#overlay circle').count()==24,'original seam filter preserved')
 page.set_viewport_size({'width':390,'height':844})
 page.locator('input[value="rail-unmatched"]').check()
 ok(page.locator('#overlay circle').count()==2,'mobile rail review')
 ok(page.locator('#map-art').is_visible(),'mobile shared-engine map')
 ok('not authorized' in page.locator('footer').inner_text(),'read-only status visible')
 ok(not errors,'no JS page errors '+repr(errors))
 browser.close()
print('PASS Odessa source railway Chromium v495',checks,'checks')
