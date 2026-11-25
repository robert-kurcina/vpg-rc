from pathlib import Path
import json,base64,re
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parent.parent;f=r/'legacy/index.html';html=f.read_text()
# Preserve DOM, bootstrap & runtime behavior, but replace local file loads that
# Chromium blocks in this environment with the exact same local bytes inline.
for css in re.findall(r'<link\s+rel="stylesheet" href="([^"]+)"\s*/?>',html):
 p=(r/'legacy'/css);html=html.replace(f'<link rel="stylesheet" href="{css}">',f'<style>\n{p.read_text()}\n</style>')
tex={kind:'data:image/png;base64,'+base64.b64encode((r/f'supplied_assets/flat/terrain-{kind}.png').read_bytes()).decode() for kind in ['open','woods','forest','swamp','hills','mountain','rough']}
html=html.replace('</head>',f'<script>window.__inlineTextures={json.dumps(tex)};</script></head>')
for src in re.findall(r'<script src="([^"]+)"></script>',html):
 p=(r/'legacy'/src).resolve()
 if not p.exists():print('missing file',p);continue
 code=p.read_text()
 if src=='ui.js':
  code=code.replace("WargamePresentation.textures('../supplied_assets/flat/')",'window.__inlineTextures')
  for filename in ['fortification-overlay.svg','city-hex-highlight.svg']:
   art='data:image/svg+xml;base64,'+base64.b64encode((r/'supplied_assets/flat'/filename).read_bytes()).decode()
   code=code.replace("'../supplied_assets/flat/"+filename+"'",json.dumps(art))
 html=html.replace(f'<script src="{src}"></script>','<script>\n'+code+'\n</script>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1720,'height':1060},device_scale_factor=1)
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html,wait_until='load',timeout=30000)
 try:page.wait_for_selector('#engine-units [data-unit-id]',timeout=10000)
 except Exception as e:print('UNITS TIMEOUT',str(e)[:300])
 print('title',page.title(),'tokens',page.locator('#engine-units [data-unit-id]').count(),'official',page.locator('#engine-units .official-counter').count(),'error',errs[:7])
 page.screenshot(path=str(r/'evidence/live-moscow-portable-v262.png'),full_page=True)
 browser.close()
