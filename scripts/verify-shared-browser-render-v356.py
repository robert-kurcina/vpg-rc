from playwright.sync_api import sync_playwright
from pathlib import Path
from shutil import which
import json
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'maps/index.html').read_text()
# Supply the same source scripts and scenario JSON inline so browser tests do not
# depend on the sandbox's restricted loopback networking.
for f in ['../core/factions.js','../core/terrain_tiles.js','../core/presentation.js','composer.js']:
 content=(ROOT/'maps'/f).resolve().read_text()
 html=html.replace(f'<script src="{f}"></script>', '<script>\n'+content+'\n</script>')
source={'registry.json':json.loads((ROOT/'maps/registry.json').read_text())}
for item in source['registry.json']['maps']:
 for ref in [item.get('file'),(item.get('compose') or {}).get('extension')]:
  if ref:source[ref]=json.loads((ROOT/'maps'/ref).read_text())
script='<script>window.fetch=async name=>{const data='+json.dumps(source)+';return {ok:!!data[name],json:async()=>structuredClone(data[name])};}</script>'
html=html.replace("<script>\n(async()=>",script+"\n<script>\n(async()=>",1)
with sync_playwright() as p:
 browser_path=which('chromium') or which('google-chrome') or which('chromium-browser')
 launch_opts={'executable_path':browser_path} if browser_path else {}
 browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage'],**launch_opts)
 page=browser.new_page(viewport={'width':1440,'height':900})
 errs=[]
 page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_selector('#render svg',timeout=45000)
 out=[]
 for id in ['battle-for-moscow','arduous','leningrad','kiev','kiev-odessa']:
  page.select_option('#game',id)
  d=page.evaluate("""() => ({id:document.querySelector('#game').value, svg:!!document.querySelector('#render svg'), cells:document.querySelectorAll('#render [data-hex-id]').length, viewBox:document.querySelector('#render svg')?.getAttribute('viewBox'),smoothRivers:document.querySelectorAll('#render [data-river-smoothing=cubic]').length,status:document.querySelector('#status').textContent.slice(0,70)})""")
  out.append(d)
 print(json.dumps({'maps':out,'pageErrors':errs},indent=2))
 assert [x['cells'] for x in out]==[147,155,197,165,261]
 assert out[2]['smoothRivers']==10
 assert not errs
 browser.close()
