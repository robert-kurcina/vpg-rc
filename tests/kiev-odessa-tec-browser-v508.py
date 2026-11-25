#!/usr/bin/env python3
from pathlib import Path
import base64,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
chart=json.loads((ROOT/'maps/presentation/kiev-terrain-effects.json').read_text())
art={row['id']: 'data:image/png;base64,'+base64.b64encode((ROOT/'assets/terrain-chart'/row.get('sampleMap','kiev')/(row['id']+'.png')).read_bytes()).decode('ascii') for row in chart['rows']}
html=(ROOT/'tools/terrain-effects-chart/index.html').read_text()
needle="img.src='../../assets/terrain-chart/'+sampleMap+'/'+row.id+'.png';"
assert needle in html
html=html.replace(needle,'img.src=window.__art[row.id];')
bootstrap='<script>window.__config='+json.dumps(chart).replace('</script',r'<\/script')+';window.__art='+json.dumps(art)+';window.fetch=async()=>({json:async()=>window.__config});</script>'
html=html.replace('<script>\n(async()=>',bootstrap+'<script>\n(async()=>')
checks=0
def chk(value,msg):
 global checks
 assert value,msg
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1460,'height':1200},device_scale_factor=1)
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=30000)
 page.wait_for_function('document.querySelectorAll("#chart-body tr").length===14')
 chk(page.title()=='Objective: Kiev — Terrain Effects Chart (Odessa supplement)','title')
 chk(page.locator('#chart-body tr').count()==14,'14 rows')
 chk(page.locator('#chart-body tr').nth(12).get_attribute('data-kind')=='romanian','Romania penultimate')
 chk(page.locator('#chart-body tr').nth(13).get_attribute('data-kind')=='bessarabia','Bessarabia last')
 chk(page.locator('#chart-body tr').nth(7).get_attribute('data-kind')=='coast','Coast inserted')
 chk(page.locator('#chart-body tr').nth(8).get_attribute('data-kind')=='lake','Lake inserted')
 chk(page.locator('#chart-body tr').nth(9).get_attribute('data-kind')=='sea','Sea inserted')
 chk(page.locator('tr[data-kind="lake"] .sample-id').inner_text().strip()=='Based on 0710 · Leningrad','lake caption')
 chk(page.locator('tr[data-kind="sea"] .sample-id').inner_text().strip()=='Based on 1516 · Odessa','sea caption')
 chk(page.evaluate('Array.from(document.images).every(i=>i.complete&&i.naturalWidth===160&&i.naturalHeight===150)'),'all specimen art loads at 160x150')
 dep_text=page.locator('tr[data-kind="deployment"]').inner_text()
 chk('Infantry' in dep_text and 'Cavalry' in dep_text and 'Mechanized' in dep_text,'deployment note updated')
 chk('single-hex engine render' in page.locator('header p').inner_text(),'header text')
 chk(not errors,'no JS exceptions '+str(errors))
 dest=ROOT/'rules/audit/visual/kiev-odessa-tec-territory-browser-v508.png';dest.parent.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(dest),full_page=True)
 page.set_viewport_size({'width':390,'height':844})
 chk(page.evaluate('document.documentElement.scrollWidth<=window.innerWidth+2'),'mobile no horizontal scroll')
 chk(page.locator('#chart-body tr').count()==14,'all mobile cards')
 chk(page.locator('tr[data-kind="lake"]').is_visible(),'mobile Lake row visible')
 chk(page.locator('tr[data-kind="sea"]').is_visible(),'mobile Sea row visible')
 chk(page.locator('tr[data-kind="deployment"]').is_visible(),'mobile Deployment row visible')
 chk(page.evaluate('getComputedStyle(document.querySelector("#chart-body tr")).display')=='block','mobile card layout')
 mobile=ROOT/'rules/audit/visual/kiev-odessa-tec-territory-mobile-v508.png'
 page.screenshot(path=str(mobile),full_page=True)
 browser.close()
print('PASS v508 TEC browser:',checks,'checks; screenshot',dest)
