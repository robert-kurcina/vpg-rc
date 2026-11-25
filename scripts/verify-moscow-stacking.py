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
 page=browser.new_page(viewport={'width':1680,'height':1110},device_scale_factor=2)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=30000)
 page.wait_for_selector('#engine-units [data-unit-id]',timeout=12000)
 page.wait_for_selector('#stack-example-two [data-unit-id]',timeout=12000)
 def check(condition,message):
  if not condition:raise AssertionError(message)
 actual=page.locator('#engine-units [data-unit-id]').count()
 two=page.locator('#stack-example-two .official-counter').count()
 three=page.locator('#stack-example-three .official-counter').count()
 check(actual==36,f'expected 36 historical counters, got {actual}')
 fidelity=page.evaluate('''() => Array.from(document.querySelectorAll('#engine-units .official-counter')).map(g=>{
  const x=g.getAttribute('transform')||'';
  const body=g.querySelector('[data-role="primary"]');
  const unit=g.querySelector('[data-role="unit_id"]');
  const side=g.getAttribute('data-side');
  const rect=Array.from(g.querySelectorAll('rect')).find(e=>e.getAttribute('data-role')==='primary');
  return {side,transform:x,unit:unit?.textContent?.trim(),
   fill:rect?.style?.fill||rect?.getAttribute('fill')||'',id:g.getAttribute('data-unit-id')};
 })''')
 check(len(fidelity)==actual,'counter art audit count mismatch')
 marker_status=page.evaluate("""() => [...document.querySelectorAll('#engine-terrain [data-deployment-hex]')].reduce((a,m)=>{a[m.style.visibility||'unspecified']=(a[m.style.visibility||'unspecified']||0)+1;return a;},{})""")
 check(marker_status.get('hidden',0)>=actual,'occupied deployment symbols must not protrude from counter faces')
 check(all('scale(1.080,1.080)' in q['transform'] for q in fidelity),'source 50x50 counter must render without stretching')
 check(all(q['unit'] and not re.match(r'^[gs]\d+$',q['unit']) for q in fidelity),'internal IDs must not leak into printed designations')
 # Validate authored colors in the actual DOM instead of CSS screenshots alone.
 color_usage={side:sorted(set(q['fill'] for q in fidelity if q['side']==side)) for side in ('german','soviet')}
 check(color_usage['german']==['rgb(208, 219, 212)'],f'German reference palette is not applied: {color_usage}')
 check(color_usage['soviet']==['rgb(208, 166, 126)'],f'Soviet reference palette is not applied: {color_usage}')
 
 check(two==2 and three==3,f'expected two and three example counters; got {two} and {three}')
 check(page.locator('#engine-units [data-stack-size="1"]').count()==actual,'Moscow must have single-occupant positions')
 text=page.locator('#stack-examples').inner_text()
 check('Presentation examples only' in text,'stacking demo must not claim Moscow rules allow 2 or 3')
 before=page.locator('#stack-example-three [data-stack-top="true"]').get_attribute('data-unit-id')
 image=r/'evidence/battle-for-moscow-v264-browser.png';page.screenshot(path=str(image),full_page=True)
 panel=r/'evidence/moscow-stacking-examples-v264-browser.png';page.locator('#stack-examples').screenshot(path=str(panel))
 # Test click to select top in the *actual* browser UI.
 page.locator('#stack-example-three').click()
 selected=page.locator('#stack-example-three .stack-example-meta').inner_text()
 check(f'selected: {before}' in selected,f'normal click should select current top {before}: {selected}')
 # Shift click must swap current top and bottom, not rearrange the remaining counter.
 first=page.locator('#stack-example-three [data-stack-index="0"]').get_attribute('data-unit-id')
 second=page.locator('#stack-example-three [data-stack-index="1"]').get_attribute('data-unit-id')
 page.locator('#stack-example-three').click(modifiers=['Shift'])
 after=page.locator('#stack-example-three [data-stack-top="true"]').get_attribute('data-unit-id')
 middle=page.locator('#stack-example-three [data-stack-index="1"]').get_attribute('data-unit-id')
 check(after==first,f'shift click should promote former bottom {first}; got {after}')
 check(middle==second,'shift click should not change middle counter')
 check(after!=before,'shift click should change top')
 check(page.locator('#engine-units [data-unit-id]').count()==actual,'demo interaction must not alter game units')
 check(not errors,f'javascript errors: {errors}')
 swap=r/'evidence/moscow-stacking-swap-v264-browser.png';page.locator('#stack-examples').screenshot(path=str(swap))
 # Isolate the unmodified map and unit SVG nodes from the actual initialized
 # game viewer. No recreation or restyling of the authored game-map geometry.
 map_image=r/'evidence/battle-for-moscow-v264-full-map.png'
 page.evaluate("""() => {
  const node=document.querySelector('#mapCanvasStack');
  const snapshot=node.cloneNode(true);
  snapshot.querySelector('#board')?.remove();
  document.body.replaceChildren(snapshot);
  document.body.style.margin='0';document.body.style.padding='0';document.body.style.background='#e5e8e6';
  snapshot.style.width='1600px';snapshot.style.height='1139px';
  snapshot.style.position='relative';
 }""")
 page.set_viewport_size({'width':1600,'height':1139})
 page.screenshot(path=str(map_image),full_page=True)

 report={'runtime':'Chromium, local JavaScript source inlined only for file-loading restrictions','map':'Battle for Moscow','historical_counters':actual,'max_legal_historical_stack':1,'presentation_example_2_counter':two,'presentation_example_3_counter':three,'pre_swap_top':before,'pre_swap_bottom':first,'post_swap_top':after,'middle_unchanged':middle==second,'click_selected_top':True,'state_isolated':True,'counter_art':{'occupied_deployment_markers_hidden':marker_status.get('hidden',0),'square_source_geometry':True,'no_internal_prefix_in_printed_labels':True,'colors':color_usage},'errors':errors,'evidence':[str(image),str(panel),str(swap),str(map_image)]}
 (r/'evidence/stacking-regression-v264.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))
 browser.close()
