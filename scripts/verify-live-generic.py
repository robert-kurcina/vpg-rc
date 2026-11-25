from pathlib import Path
import json, base64
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parent.parent
html=(r/'index.html').read_text()
for style in ['core/ui.css','style.css']:
 html=html.replace('<link rel="stylesheet" href="'+style+'">', '<style>\n'+(r/style).read_text()+'\n</style>')
data={}
for f in (r/'games').rglob('*.json'):
 data[str(f.relative_to(r))]=json.loads(f.read_text())
js_fetch=f'''<script>\nwindow.__data={json.dumps(data,separators=(',',':'))};window.fetch=(url)=>Promise.resolve({{ok:!!window.__data[url],json:async()=>window.__data[url]}});window.__inlineTextures={json.dumps({kind:'data:image/png;base64,'+base64.b64encode((r/f'supplied_assets/flat/terrain-{kind}.png').read_bytes()).decode('ascii') for kind in ['open','woods','forest','swamp','hills','mountain','rough']})};\n</script>'''
html=html.replace('</head>',js_fetch+'</head>')
for script in ['core/modules.js','core/engine.js','core/ai.js','core/factions.js','core/terrain_tiles.js','core/presentation.js','core/official_counter_templates.js','core/counter_visuals.js','core/stack_view.js','core/terrain_adapter.js','app.js']:
 content=(r/script).read_text()
 if script=='app.js':content=content.replace('const tex=WargamePresentation.textures();','const tex=window.__inlineTextures;')
 html=html.replace(f'<script src="{script}"></script>',f'<script>\n{content}\n</script>')
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1600,'height':1080},device_scale_factor=1)
 errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
 page.set_content(html,wait_until='load',timeout=30000)
 page.wait_for_selector('#board [data-unit-id]',timeout=30000)
 print('scenario:',page.locator('#scenario-name').inner_text(),'tokens:',page.locator('#board [data-unit-id]').count(),'templates',page.locator('#board .official-counter').count(),'errors',errs)
 print('icon active',page.locator('#board g[data-nato]').evaluate_all('els => els.filter(e => e.style.display !== "none").length'))
 # show full game board centered enough and actual counters
 page.screenshot(path=str(r/'evidence/live-game-portable-v262.png'),full_page=True)
 first=page.locator('#board .official-counter').first
 print('first',first.get_attribute('data-unit-id'),first.get_attribute('data-counter-template'))
 first.click(force=True)
 print('selection:',page.locator('#selection').inner_text()[:170], 'errors:',errs)
 b.close()
