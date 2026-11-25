#!/usr/bin/env python3
"""Map-viewer settings test with actual shared SVG map renderer."""
from pathlib import Path
import re,json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
folder=ROOT/'maps';h=(folder/'index.html').read_text()
assets={'registry.json':json.loads((folder/'registry.json').read_text())}
registry=assets['registry.json']
for entry in registry['maps']:
 for rel in [entry.get('file'),(entry.get('compose') or {}).get('extension')]:
  if rel and (folder/rel).is_file():assets[rel]=json.loads((folder/rel).read_text())
h=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(folder/m[1]).resolve().read_text()+'</style>',h)
h=re.sub(r'<script src="([^"]+)"></script>',lambda m:'<script>'+(folder/m[1]).resolve().read_text().replace('</script>','<\\/script>')+'</script>',h)
shim='<script>const __localFiles='+json.dumps(assets,separators=(',',':'))+';window.fetch=async file=>{if(!(file in __localFiles))throw Error("Missing map "+file);return new Response(JSON.stringify(__localFiles[file]),{status:200})};</script>'
h=h.replace('<script>\n(async()=>',shim+'<script>\n(async()=>')
if __name__=='__main__':
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1560,'height':1100})
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(h,wait_until='domcontentloaded',timeout=120000)
  page.wait_for_function('!!document.querySelector("#render svg")',timeout=90000)
  assert page.locator('#viewer-settings').is_hidden()
  page.locator('[data-viewer-tab=settings]').click()
  assert page.locator('#viewer-settings').is_visible()
  assert page.locator('#display-showCoast').is_disabled()
  page.locator('#game').select_option('leningrad')
  page.wait_for_function('document.querySelectorAll("#render .source-coast-connected-wavelet-fringe").length === 1')
  assert page.locator('#display-showCoast').is_enabled()
  page.locator('#display-coastWavelets').uncheck()
  assert page.locator('#render .settings-flat-coast').count()==1
  page.locator('#display-showCoast').uncheck()
  assert page.locator('#render .settings-flat-coast').count()==0
  assert page.locator('#display-coastWavelets').is_disabled()
  page.locator('#display-showCoast').check()
  page.locator('#display-coastWavelets').check()
  assert page.locator('#render .source-coast-connected-wavelet-fringe').evaluate('e=>e.style.display')!='none'
  page.locator('#game').select_option('kiev-odessa')
  assert page.locator('#render .registered-shore-fringe[data-water-kind=coast]').count()>0
  page.locator('#display-coastWavelets').uncheck()
  assert page.locator('#render .settings-flat-coast').count()>0
  assert not errors,errors
  browser.close()
 print('PASS all-five-map viewer Settings and coastline rendering')
