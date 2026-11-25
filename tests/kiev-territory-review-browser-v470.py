#!/usr/bin/env python3
"""Actual packaged Kiev manual border review UI in Chromium.
Uses the exact approved original engine SVG and source files, inlined only
because local HTTP is unavailable in the execution environment.
This is not a gameplay simulator or a substitute map renderer.
"""
from __future__ import annotations
import base64, json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=0

def eq(a,b,why):
 global checks
 assert a==b,f'{why}: {a!r} != {b!r}'
 checks+=1

def yes(a,why):
 global checks
 assert a,why
 checks+=1

PAGE=(ROOT/'tools/territory-review/index.html').read_text()
CFG=json.loads((ROOT/'tools/territory-review/kiev.json').read_text())
FILES={'kiev.json':CFG,CFG['map']:json.loads((ROOT/'maps/kiev.json').read_text()),
 CFG['setup']:json.loads((ROOT/'maps/setup/kiev.json').read_text())}
uri='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'exports/kiev.svg').read_bytes()).decode()
PAGE=PAGE.replace('src="../../exports/kiev.svg"',f'src="{uri}"')
scan='data:image/jpeg;base64,'+base64.b64encode((ROOT/'maps/source/kiev-map-scan.jpg').read_bytes()).decode()
PAGE=PAGE.replace('src="../../maps/source/kiev-map-scan.jpg"',f'src="{scan}"')
PAGE=PAGE.replace('<script src="../../core/sync_sha256.js"></script>',
 '<script>window.__sourceFiles='+json.dumps(FILES,separators=(',',':'))+';window.fetch=async p=>({ok:Object.hasOwn(__sourceFiles,p),status:200,json:async()=>__sourceFiles[p]});</script>'+ 
 '<script>'+ (ROOT/'core/sync_sha256.js').read_text().replace('</script','<\\/script')+'</script>')
for src in ['../../core/historical_territory_review.js','app.js']:
 content=(ROOT/('core/historical_territory_review.js' if src.startswith('../') else 'tools/territory-review/app.js')).read_text().replace('</script','<\\/script')
 PAGE=PAGE.replace(f'<script src="{src}"></script>',f'<script>{content}</script>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1450,'height':920},accept_downloads=True)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.set_content(PAGE,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_function("document.getElementById('counts').textContent.includes('165 map hexes')",timeout=20000)
 yes('Kiev' in page.title(),'packaged original page loaded')
 eq(page.locator('#hex-layer polygon').count(),165,'all 165 source map hexes have hit polygons')
 yes(page.locator('#map-stage img').first.evaluate('(x)=>x.complete&&x.naturalWidth>0'), 'unaltered approved engine SVG displayed')
 yes('154 unreviewed' in page.locator('#counts').inner_text(),'unreviewed region correctly explicit')
 eq(page.locator('#hex-layer polygon[data-evidence="printed-Romanian-setup"]').count(),4,'four printed Romanian source slots')
 eq(page.locator('#hex-layer polygon[data-evidence="printed-Polish-setup"]').count(),7,'seven printed Polish source slots')
 eq(page.locator('#hex-layer polygon[data-evidence="none"]').count(),154,'the remaining map is unclassified')
 eq(page.locator('#hex-layer polygon[data-hex="0708"]').get_attribute('data-label'),'unreviewed','Soviet border origin is not inferred Romanian')
 for x in ['0709','0809','0910','1010']:
  eq(page.locator(f'#hex-layer polygon[data-hex="{x}"]').get_attribute('data-label'),'romanian','source-anchored Romanian '+x)
 # The source-anchored hex cannot be replaced by a selected outsider label.
 page.locator('input[value="outside"]').check()
 page.locator('#hex-layer polygon[data-hex="0709"]').click(force=True)
 yes('cannot be edited' in page.locator('#message').inner_text(),'printed region refuses edit in actual UI')
 eq(page.locator('#hex-layer polygon[data-hex="0709"]').get_attribute('data-label'),'romanian','source Romanian anchor immutable')
 # Manual visible click changes ONLY the selected source cell.
 page.locator('input[value="romanian"]').check()
 page.locator('#hex-layer polygon[data-hex="0708"]').click(force=True)
 eq(page.locator('#hex-layer polygon[data-hex="0708"]').get_attribute('data-label'),'romanian','new manual draft rendered')
 eq(page.locator('#hex-layer polygon[data-hex="0708"]').get_attribute('data-evidence'),'manual-draft','manual/source provenance visibly separate')
 yes('153 unreviewed' in page.locator('#counts').inner_text(),'coverage updates')
 with page.expect_download() as dl:page.locator('#save').click()
 eq(dl.value.suggested_filename,'kiev-romania-territory-review-DRAFT.json','explicit DRAFT download')
 savepath=ROOT/'rules/audit/kiev-territory-review-download-v470.json'
 dl.value.save_as(str(savepath))
 saved=json.loads(savepath.read_text())
 eq(saved['gameplayAuthorized'],False,'export never authorizes game')
 eq(saved['coverage'],'incomplete-draft','one classified cell is partial')
 eq(saved['labels'],{'0708':'romanian'},'only manual draft fields saved; source pins elsewhere')
 page.locator('#reset').click()
 eq(page.locator('#hex-layer polygon[data-hex="0708"]').get_attribute('data-label'),'unreviewed','reset clears manual choice')
 eq(page.locator('#hex-layer polygon[data-evidence="printed-Romanian-setup"]').count(),4,'source pin survives reset')
 page.locator('#load').set_input_files(files=[{'name':'review.json','mimeType':'application/json','buffer':json.dumps(saved).encode()}])
 page.wait_for_function("document.getElementById('message').textContent.includes('restored')")
 eq(page.locator('#hex-layer polygon[data-hex="0708"]').get_attribute('data-label'),'romanian','import restores reviewed label')
 tampered=json.loads(json.dumps(saved));tampered['labels']['0708']='outside'
 page.locator('#load').set_input_files(files=[{'name':'tamper.json','mimeType':'application/json','buffer':json.dumps(tampered).encode()}])
 page.wait_for_function("document.getElementById('message').textContent.includes('rejected')")
 eq(page.locator('#hex-layer polygon[data-hex="0708"]').get_attribute('data-label'),'romanian','tamper load does not mutate draft')
 yes('checksum' in page.locator('#message').inner_text(),'checksum mismatch visible to user')
 # Tooltip always conveys unclassified vs source vs manual; keyboard accessible.
 el=page.locator('#hex-layer polygon[data-hex="0808"]')
 yes('Unreviewed' in el.get_attribute('aria-label'),'accessibility state exposed')
 el.focus()
 page.locator('input[value="outside"]').check()
 el.focus();el.press('Enter')
 eq(el.get_attribute('data-label'),'outside','keyboard Enter labels map hex')
 yes(not errors,'no real Chromium script errors: '+str(errors))
 page.screenshot(path=str(ROOT/'rules/audit/visual/kiev-territory-review-browser-v470.png'),full_page=True,animations='disabled')
 # Real emulated phone page: map remains visible, controls follow underneath.
 phone=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 mp=phone.new_page();mp.set_content(PAGE,wait_until='domcontentloaded',timeout=45000)
 mp.wait_for_function("document.getElementById('counts').textContent.includes('165 map hexes')")
 yes(mp.locator('#map-stage').is_visible(),'phone map visible')
 yes(mp.locator('#hex-layer polygon').count()==165,'same source polygons on phone')
 eq(mp.evaluate('getComputedStyle(document.querySelector("main")).gridTemplateColumns.split(" ").length'),1,'single-column mobile layout')
 yes(mp.evaluate('document.getElementById("map-scroll").scrollWidth>document.getElementById("map-scroll").clientWidth*2'),'scrollable higher-resolution touch map')
 mp.locator('#hex-layer polygon[data-hex="0708"]').tap()
 eq(mp.locator('#hex-layer polygon[data-hex="0708"]').get_attribute('data-label'),'romanian','touch input proposes region')
 phone.close();browser.close()
report={'checkpoint':236,'version':'v470','assertions':checks,'status':'PASS',
 'source':'approved original source SVG export; original Kiev geometry/setup JSON; explicit territory draft adapter',
 'screenshot':'rules/audit/visual/kiev-territory-review-browser-v470.png',
 'gameplayAuthorized':False,'sourceTerritoryCertified':False,
 'scope':'Actual interactive Chromium desktop and touch, UI clicks, source pins, keyboard, checksum draft save/restore'}
(ROOT/'rules/audit/kiev-territory-review-browser-v470.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS v470 Kiev territorial review UI:',checks,'Chromium assertions, live Kiev remains gated')
