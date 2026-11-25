#!/usr/bin/env python3
"""Review the authentic engine-rendered Kiev–Odessa map with source audit markers."""
from pathlib import Path
import base64,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
AUDIT=json.loads((ROOT/'rules/audit/odessa-composite-movement-candidate-v493.json').read_text())
HTML=(ROOT/'tools/odessa-movement-review/index.html').read_text()
ART='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev-odessa.png').read_bytes()).decode()
BOOT='<script>window.__odessaAudit='+json.dumps(AUDIT).replace('</script',r'<\/script')+';window.fetch=async()=>({ok:true,json:async()=>window.__odessaAudit});</script>'
HTML=HTML.replace('<script>\n(async()=>',BOOT+'<script>\n(async()=>')
HTML=HTML.replace('src="../../exports/kiev-odessa.png"',f'src="{ART}"')
assert 'window.__odessaAudit' in HTML
SCREEN=ROOT/'rules/audit/visual/odessa-seam-shore-review-browser-v493.png'
SHORE_SCREEN=ROOT/'rules/audit/visual/odessa-land-shore-review-browser-v493.png'
SCREEN.parent.mkdir(parents=True,exist_ok=True)
checks=0
def ok(cond,message):
 global checks
 assert cond,message;checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1420,'height':1020},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(HTML,wait_until='load',timeout=45000)
 page.wait_for_function('document.querySelectorAll("#overlay circle").length===24',timeout=30000)
 ok(page.title()=='Kiev–Odessa Source Topology Review','title')
 ok(page.locator('#overlay circle').count()==24,'24 source-derived seam markers')
 ok(page.locator('#results button').count()==24,'seam list')
 ok(page.locator('#map-art').evaluate('(img)=>img.complete&&img.naturalWidth===1360&&img.naturalHeight===1350'),'genuine engine PNG rendered')
 ok(page.locator('#stats .metric').count()==6,'six descriptive metrics')
 ok('714' in page.locator('#stats').inner_text(),'714 edge count')
 ok('not authorized' in page.locator('footer').inner_text(),'no gameplay authorization')
 ok(not errors,'no script errors: '+str(errors))
 page.locator('#results button').first.click()
 ok('seam' in page.locator('#detail').inner_text().lower(),'selected seam details')
 page.locator('input[value="shore-land-land"]').check()
 ok(page.locator('#overlay circle').count()==7,'seven land-land shore markers')
 ok(page.locator('#results button').count()==7,'seven shore inspection choices')
 page.locator('#results button').nth(0).click()
 ok('ground crossing is prohibited' in page.locator('#detail').inner_text(),'source Coast barrier is impassable')
 ok(page.locator('#overlay circle.selected').count()==1,'selection active')
 page.screenshot(path=str(SHORE_SCREEN),full_page=True)
 page.locator('input[value="seam"]').check()
 ok(page.locator('#overlay circle').count()==24,'filter restores seam markers')
 page.screenshot(path=str(SCREEN),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 ok(page.locator('#overlay circle').count()==24,'mobile keeps candidate markers')
 ok(page.locator('#map-art').is_visible(),'mobile map visible')
 ok(not errors,'no errors on mobile')
 browser.close()
print('PASS Odessa composite topology browser v493',checks,'checks',SCREEN,SHORE_SCREEN)
