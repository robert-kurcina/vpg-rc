#!/usr/bin/env python3
"""Render the real TEC HTML in Chromium using source-pinned actual map-export snippets."""
from pathlib import Path
import base64,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
chart=json.loads((ROOT/'maps/presentation/kiev-terrain-effects.json').read_text())
art={row['id']: 'data:image/png;base64,'+base64.b64encode((ROOT/'assets/terrain-chart'/row.get('sampleMap','kiev')/(row['id']+'.png')).read_bytes()).decode('ascii') for row in chart['rows']}
html=(ROOT/'tools/terrain-effects-chart/index.html').read_text()
assert "img.src='../../assets/terrain-chart/'+(row.sampleMap==='kiev-odessa'?'kiev-odessa':'kiev')+'/'+row.id+'.png';" in html
html=html.replace("img.src='../../assets/terrain-chart/'+(row.sampleMap==='kiev-odessa'?'kiev-odessa':'kiev')+'/'+row.id+'.png';",'img.src=window.__art[row.id];')
bootstrap='<script>window.__config='+json.dumps(chart).replace('</script',r'<\/script')+';window.__art='+json.dumps(art)+';window.fetch=async()=>({json:async()=>window.__config});</script>'
html=html.replace('<script>\n(async()=>',bootstrap+'<script>\n(async()=>')
checks=0
def chk(value,msg):
 global checks
 assert value,msg
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1460,'height':1050},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=30000)
 page.wait_for_function('document.querySelectorAll("#chart-body tr").length===11')
 chk(page.title()=='Objective: Kiev — Terrain Effects Chart (Odessa supplement)','updated title')
 chk(page.locator('#chart-body tr').count()==11,'11 rows')
 chk(page.locator('#chart-body tr').nth(9).get_attribute('data-kind')=='romanian','Romania penultimate')
 chk(page.locator('#chart-body tr').nth(10).get_attribute('data-kind')=='bessarabia','Bessarabia last')
 chk(page.locator('tr[data-kind="bessarabia"]').inner_text().find('Hungarian units may never enter Bessarabia')!=-1,'territorial rule visible')
 chk(page.locator('tr[data-kind="bessarabia"]').inner_text().find('later return')!=-1,'permanent annexation visible')
 chk(page.locator('tr[data-kind="romanian"]').inner_text().find('0709')!=-1,'Kiev Turn 1 rule preserved')
 chk(page.locator('tr[data-kind="bessarabia"] img.sample').get_attribute('alt').find('Kiev–Odessa')!=-1,'combined engine sample marked')
 chk(page.locator('tr[data-kind="bessarabia"] .sample-id').inner_text().strip()=='Hex 1212 · Odessa','sample host ID')
 chk(page.evaluate('Array.from(document.images).every(i=>i.complete&&i.naturalWidth===88&&i.naturalHeight===82)'),'all actual engine art loads')
 chk(not errors,'no JS exceptions '+str(errors))
 dest=ROOT/'rules/audit/visual/kiev-odessa-tec-territory-browser-v505.png';dest.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(dest),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 chk(page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2'),'mobile no horizontal scroll')
 chk(page.locator('#chart-body tr').count()==11,'all mobile cards')
 chk(page.locator('tr[data-kind="romanian"]').is_visible(),'mobile Romania row visible')
 chk(page.locator('tr[data-kind="bessarabia"]').is_visible(),'mobile Bessarabia row visible')
 chk(page.evaluate('getComputedStyle(document.querySelector("#chart-body tr")).display')=='block','mobile card layout')
 mobile=ROOT/'rules/audit/visual/kiev-odessa-tec-territory-mobile-v505.png'
 page.screenshot(path=str(mobile),full_page=True)
 browser.close()
print('PASS v505 TEC browser:',checks,'checks; screenshot',dest)
