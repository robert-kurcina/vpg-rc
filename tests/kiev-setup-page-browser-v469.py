#!/usr/bin/env python3
"""Packaged Kiev setup-only HTML loaded in isolated Chromium with original source bytes.
Localhost is unavailable in this test environment, so real assets and source
modules are supplied in-memory. No rules or renderer are substituted.
"""
from __future__ import annotations
import json, base64, re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
checks=0

def yes(condition,why):
 global checks
 assert condition,why
 checks+=1

def eq(actual,expected,why):
 global checks
 assert actual==expected,f'{why}: {actual!r} != {expected!r}'
 checks+=1

CONFIG=json.loads((ROOT/'games/kiev/setup-preview/config.json').read_text())
files={'config.json':CONFIG}
for key in ['map','counterConfig','setup','profile','phaseConfig','inventoryPolicy','candidateData']:
 path=(ROOT/'games/kiev/setup-preview'/CONFIG[key]).resolve()
 files[CONFIG[key]]=json.loads(path.read_text())
source_html=(ROOT/'games/kiev/setup-preview/index.html').read_text()
for css in re.findall(r'<link rel="stylesheet" href="([^"]+)"[^>]*>',source_html):
 path=(ROOT/'games/kiev/setup-preview'/css).resolve()
 source_html=source_html.replace(f'<link rel="stylesheet" href="{css}">','<style>'+path.read_text()+'</style>')
map_uri='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'exports/kiev.svg').read_bytes()).decode()
CONFIG['mapExport']=map_uri
source_html=source_html.replace('src="../../../exports/kiev.svg"','src="'+map_uri+'"')
source_html=source_html.replace('<script src="../../../core/sync_sha256.js"></script>',
 '<script>window.__sourceFiles='+json.dumps(files,separators=(',',':'))+';window.fetch=async p=>({ok:Object.hasOwn(__sourceFiles,p),json:async()=>__sourceFiles[p]});</script>'+ 
 '<script>'+ (ROOT/'core/sync_sha256.js').read_text().replace('</script','<\\/script')+'</script>')
for js in re.findall(r'<script src="../../../core/([^"]+)"></script>',source_html):
 content=(ROOT/'core'/js).read_text().replace('</script','<\\/script')
 source_html=source_html.replace(f'<script src="../../../core/{js}"></script>','<script>'+content+'</script>')
with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1570,'height':940},accept_downloads=True)
  errors=[]
  page.on('pageerror',lambda exc:errors.append(str(exc)))
  page.set_content(source_html,wait_until='domcontentloaded',timeout=45000)
  yes('Objective: Kiev' in page.title(),'original packaged HTML loaded')
  page.wait_for_function('Boolean(window.HistoricalBrowserPreview)',timeout=20000)
  api='HistoricalBrowserPreview'
  eq(page.evaluate(api+'.view().kind'),'deployment-preview','API clearly identifies preview mode')
  eq(page.evaluate(api+'.view().gameplayAuthorized'),False,'gameplay not authorized')
  yes(page.locator('#setup-panel').is_visible(),'deployment panel available from page load')
  yes(page.locator('#decision-section').is_hidden(),'no combat/deployment-to-game decision panel')
  yes(page.locator('#orders-section').is_hidden(),'no legal gameplay action buttons')
  yes(page.locator('#ai-section').is_hidden(),'no AI controller exposed')
  eq(page.locator('#counter-overlay .official-counter').count(),30,'actual Kiev opening has 30 vector counters')
  yes(page.locator('#map-art').evaluate('(el)=>el.complete&&el.naturalWidth>0'),'real engine exported SVG loaded')
  eq(page.evaluate('HistoricalCampaignBrowserEngine.moduleCount'),48,'no Kiev-specific engine modules bundled')
  eq(page.evaluate(api+'.setupView().concealedMixed'),False,'concealed identities initially unmixed')
  yes(page.locator('#setup-ready').is_disabled(),'setup validation disabled before mixing')
  first=page.evaluate(api+'.setupView()')
  panzer=first['allocation']['germanInitialPanzer'][0]
  romania=first['allocation']['romanianInitialArmy'][0]
  eq(page.evaluate('(id)=>HistoricalBrowserPreview.setupView().placements[id]',panzer),first['placements'][panzer],'initial position accessible')
  # Wrong-country destinations must not be offered and cannot be committed.
  yes(page.evaluate('(id)=>!HistoricalBrowserPreview.setupMove(id,"0709")',panzer),
      'German Polish-only Panzer cannot move to Romanian cross')
  eq(page.evaluate(api+'.setupView()'),first,'illegal move leaves full allocation immutable')
  yes(page.evaluate('(id)=>!HistoricalBrowserPreview.setupMove(id,"0203")',romania),
      'Romanian unit cannot cross national setup boundary')
  eq(page.evaluate(api+'.setupView()'),first,'illegal Romanian attempt leaves state unchanged')
  # Real UI counter selection and a same-nationality swap through SVG clicks.
  second=next(id for id in first['allocation']['germanPolandInfantry'] if first['placements'][id]=='0301')
  oldp,olds=first['placements'][panzer],first['placements'][second]
  yes(oldp!=olds,'sample contains distinct Polish setup positions')
  page.locator(f'#counter-overlay [data-unit-id="{panzer}"] .counter-hit-area').click(position={'x':3,'y':3},force=True)
  eq(page.evaluate(api+'.setupSelection().id'),panzer,'first SVG click selects Panzer')
  eq(page.locator('#counter-overlay .setup-eligible-hex').count(),7,'only seven Polish source destinations highlighted')
  eq(page.locator('#counter-overlay .setup-eligible-hex[data-hex="0709"]').count(),0,'Romanian marker is not highlighted for Polish Panzer')
  page.locator(f'#counter-overlay [data-unit-id="{second}"] .counter-hit-area').click(force=True)
  eq(page.evaluate('(id)=>HistoricalBrowserPreview.setupView().placements[id]',panzer),olds,'second SVG click swaps Panzer position')
  eq(page.evaluate('(id)=>HistoricalBrowserPreview.setupView().placements[id]',second),oldp,'second SVG click swaps infantry position')
  yes(page.evaluate(api+'.setupSelection()') is None,'selection clears after swap')
  eq(page.locator('#counter-overlay .setup-eligible-hex').count(),0,'destination highlights clear after swap')
  page.evaluate('(id)=>HistoricalBrowserPreview.setupPick("map",id)',romania)
  eq(page.locator('#counter-overlay .setup-eligible-hex').count(),4,'Romanian source unit highlights four authorized Romanian markers')
  page.evaluate('HistoricalBrowserPreview.setupPick("map",HistoricalBrowserPreview.setupSelection().id)')
  # Real UI shuffle uses WebCrypto, then source validation has no game handoff.
  page.locator('#setup-mix').click()
  yes(page.evaluate(api+'.setupView().concealedMixed'),'source-constrained mix recognized')
  yes(page.locator('#setup-ready').is_enabled(),'validation available after mix')
  with page.expect_download() as dl:page.locator('#save').click()
  eq(dl.value.suggested_filename,'historical-deployment-save.json','download is a deployment save only')
  saved=page.evaluate(api+'.save()')
  eq(saved['format'],'historical-source-deployment','no campaign save emitted')
  page.locator('#setup-ready').click()
  yes(page.locator('#message').inner_text().startswith('Source-constrained sample deployment validated:'),
      'button validates but does not initiate gameplay')
  yes(page.locator('#setup-panel').is_visible(),'validation leaves editor open')
  eq(page.evaluate(api+'.view().gameplayAuthorized'),False,'validation does not authorize campaign')
  eq(page.locator('#counter-overlay .official-counter').count(),30,'map counters persist')
  # Round-trip and checksum rejection via actual browser Load control.
  page.locator('#new-game').click()
  eq(page.evaluate(api+'.setupView().concealedMixed'),False,'reset restores unmixed candidate')
  page.locator('#load').set_input_files(files=[{'name':'kiev.json','mimeType':'application/json','buffer':json.dumps(saved).encode()}])
  page.wait_for_function('(h)=>HistoricalBrowserPreview.save().integrity.digest===h',arg=saved['integrity']['digest'])
  eq(page.evaluate(api+'.save()'),saved,'source deployment saved state restores identically')
  tampered=json.loads(json.dumps(saved));tampered['concealedMixed']=False
  page.locator('#load').set_input_files(files=[{'name':'tampered.json','mimeType':'application/json','buffer':json.dumps(tampered).encode()}])
  page.wait_for_function("document.getElementById('message').textContent.includes('Load rejected')")
  eq(page.evaluate(api+'.save()'),saved,'tampered checksum leaves deployment immutable')
  wrong={'format':'historical-custom-campaign','version':1,'deployment':saved,'human':{}}
  page.locator('#load').set_input_files(files=[{'name':'game.json','mimeType':'application/json','buffer':json.dumps(wrong).encode()}])
  page.wait_for_function("document.getElementById('message').textContent.includes('Only source-constrained deployment saves')")
  eq(page.evaluate(api+'.save()'),saved,'campaign saves cannot bypass setup-only gate')
  yes(page.locator('#setup-panel').is_visible(),'illegal load does not open gameplay')
  yes(not errors,'no Chromium page errors: '+str(errors))
  out=ROOT/'rules/audit/visual/kiev-setup-browser-v469.png'
  page.locator('#setup-ready').click()
  page.screenshot(path=str(out),full_page=True,animations='disabled')
  browser.close()
report={'checkpoint':235,'version':'v469','assertions':checks,'status':'PASS',
 'scope':'packaged Kiev setup-only HTML in Chromium using in-memory original source JSON and identical shared map/counter vector assets; localhost unavailable',
 'gameplayAuthorized':False,'candidateLayoutCertifiedHistorical':False,
 'screenshot':'rules/audit/visual/kiev-setup-browser-v469.png','mapSourceTested':'approved SVG engine export'}
(ROOT/'rules/audit/kiev-setup-page-browser-v469.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'PASS v469 Kiev source-only setup UI: {checks} Chromium assertions; NOT playable')
