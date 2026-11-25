from pathlib import Path
import json,base64,re
from playwright.sync_api import sync_playwright
r=Path(__file__).resolve().parent.parent
html=(r/'legacy/index.html').read_text()
for css in re.findall(r'<link\s+rel="stylesheet" href="([^"]+)"\s*/?>',html):
 p=r/'legacy'/css
 html=html.replace(f'<link rel="stylesheet" href="{css}">',f'<style>\n{p.read_text()}\n</style>')
textures={kind:'data:image/png;base64,'+base64.b64encode((r/f'supplied_assets/flat/terrain-{kind}.png').read_bytes()).decode() for kind in ['open','woods','forest','swamp','hills','mountain','rough']}
html=html.replace('</head>',f'<script>window.__inlineTextures={json.dumps(textures)};</script></head>')
for src in re.findall(r'<script src="([^"]+)"></script>',html):
 p=(r/'legacy'/src).resolve();code=p.read_text()
 if src=='ui.js':
  code=code.replace("WargamePresentation.textures('../supplied_assets/flat/')",'window.__inlineTextures')
  for filename in ['fortification-overlay.svg','city-hex-highlight.svg']:
   art='data:image/svg+xml;base64,'+base64.b64encode((r/'supplied_assets/flat'/filename).read_bytes()).decode()
   code=code.replace("'../supplied_assets/flat/"+filename+"'",json.dumps(art))
 html=html.replace(f'<script src="{src}"></script>','<script>\n'+code+'\n</script>')
out=r/'evidence';out.mkdir(exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1680,'height':1040},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=30000)
 page.wait_for_selector('#engine-units [data-unit-id]',timeout=25000)
 page.wait_for_timeout(900)
 rail_network=page.locator('#engine-terrain .hex-center-rail-network')
 assert rail_network.count()==1,'Playable Moscow is not using the shared railway renderer'
 assert rail_network.get_attribute('data-rail-link-count')=='70'
 assert rail_network.get_attribute('data-rail-boundary-exits')=='10'
 assert rail_network.get_attribute('data-rail-interpolation')=='clamped-cubic-b-spline'
 assert page.locator('#engine-terrain .hex-center-rail').count()==80
 assert page.locator('#engine-terrain .route-rail').count()==0,'Obsolete straight-line railway still active'
 initial_count=page.locator('#engine-units [data-unit-id]').count()
 print('units',initial_count,'play bar',page.locator('#ol-top').is_visible(),'research',page.locator('#ol-research-drawer').is_visible(),'phase',page.locator('#ol-phase').inner_text())
 page.screenshot(path=str(out/'battle-for-moscow-v265-chromium-play.png'))
 page.locator('#ol-new').click();print('new game dialog',page.locator('#ol-game-dialog').is_visible())
 page.locator('#ol-mode-german').click()
 page.wait_for_timeout(200)
 print('selected mode',page.locator('#mode').input_value(),'phase',page.locator('#ol-phase').inner_text())
 page.screenshot(path=str(out/'battle-for-moscow-v265-chromium-human-setup.png'))
 page.locator('#options button').first.click()
 start=page.evaluate('''() => { const E=window.B4MEngine,p=window.B4M_RULES,c=E.buildScenario(window.B4M_SCENARIO,p.profiles[p.defaultRuleset]); const Hex=Honeycomb.extendHex({size:{width:114.55,height:101.9},orientation:'flat',offset:1}),Grid=Honeycomb.defineGrid(Hex),geom=Grid.rectangle({width:14,height:11,start:[0,0],direction:1}); const h=c.raw.hexes.find(h=>h.germanStart),hex=geom.get([h.x,h.y]),o=hex.toPoint(),center=hex.center(); return {x:o.x+center.x,y:o.y+center.y} }''')
 box=page.locator('#board').bounding_box()
 page.locator('#board').click(position={'x':start['x']*box['width']/1600,'y':start['y']*box['height']/1139})
 page.wait_for_timeout(100)
 text=page.locator('#options').inner_text()
 print('placement',text[:100].replace('\n',' '),'strength',page.locator('#scorebar').inner_text()[:60])
 assert '1/22 German units deployed' in text, text[:150]
 page.screenshot(path=str(out/'battle-for-moscow-v265-chromium-first-placement.png'))
 page.locator('#ol-stack-toggle').click();print('stack demo',page.locator('#stack-example-two').is_visible());page.screenshot(path=str(out/'battle-for-moscow-v265-chromium-stacking.png'))
 page.locator('#ol-research').click();print('research drawer',page.locator('#ol-research-drawer').is_visible())
 page.locator('#ol-rules').click();print('rules dialog',page.locator('#ol-rules-dialog').is_visible())
 print('JS errors:',errors[:20])
 assert initial_count==36
 assert not errors,errors
 b.close()
