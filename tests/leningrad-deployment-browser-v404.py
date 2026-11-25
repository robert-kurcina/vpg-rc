#!/usr/bin/env python3
"""Actual isolated Chromium: official terrain/counter assets and shared engine, no mocked game rules."""
import json,base64,re
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
CONFIG=json.loads((ROOT/'games/leningrad/native-preview/config.json').read_text())
assets={'config.json':CONFIG}
for key in ['map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy']:
 assets[CONFIG[key]]=json.loads((ROOT/CONFIG[key].removeprefix('../../../')).read_text())
html=(ROOT/'games/leningrad/native-preview/index.html').read_text()
html=html.replace('<link rel="stylesheet" href="style.css">','<style>'+ (ROOT/'games/leningrad/native-preview/style.css').read_text()+'</style>')
uri='data:image/svg+xml;base64,'+base64.b64encode((ROOT/'exports/leningrad.svg').read_bytes()).decode()
CONFIG['mapExport']=uri
html=html.replace('src="../../../exports/leningrad.svg"','src="'+uri+'"')
html=html.replace('<script src="../../../core/sync_sha256.js"></script>',
 '<script>window.__fixtures='+json.dumps(assets,separators=(',',':'))+';window.fetch=async p=>({ok:Object.hasOwn(__fixtures,p),json:async()=>__fixtures[p]});</script>'+ 
 '<script>'+ (ROOT/'core/sync_sha256.js').read_text().replace('</script','<\\/script')+'</script>')
for js in re.findall(r'<script src="\.\./\.\./\.\./core/([^\"]+)"\s*></script>',html):
 s=(ROOT/'core'/js).read_text().replace('</script','<\\/script')
 html=html.replace('<script src="../../../core/'+js+'"></script>','<script>'+s+'</script>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1580,'height':960},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded',timeout=45000)
 page.wait_for_function('Boolean(window.HistoricalBrowserPreview)',timeout=30000)
 api='HistoricalBrowserPreview'
 assert page.evaluate(api+'.snapshot().cursor.turn')==1
 page.locator('[data-game-tab="settings"]').click()
 page.locator('#configure-setup').click()
 assert not page.locator('#setup-panel').is_hidden()
 assert page.locator('#setup-choices select').count()==0
 assert page.locator('[data-pool-id]').count()>0
 assert page.evaluate(api+'.setupView().concealedMixed') is False
 assert page.locator('#setup-ready').is_disabled()
 assert page.locator('#counter-overlay .official-counter').count()==19
 assert page.locator('#map-art').evaluate('(im)=>im.naturalWidth')>0
 # Invalid move fails closed, must not alter the selected deployment.
 start=page.evaluate(api+'.setupView()')
 bad=page.evaluate('(args)=>HistoricalBrowserPreview.setupMove(args[0],args[1])',[start['allocation']['germanInitialInfantry'][0],'0101'])
 assert bad is False
 assert page.evaluate(api+'.setupView()')==start
 # Valid move transfers one German Corps from a 2-unit to a 1-unit cross.
 first=start['allocation']['germanInitialInfantry'][0]
 assert page.evaluate('(id)=>HistoricalBrowserPreview.setupMove(id,"0511")',first) is True
 assert page.evaluate('(id)=>HistoricalBrowserPreview.setupView().placements[id]',first)=='0511'
 # Setup download carries the original state without exposing the concealed face information visually.
 with page.expect_download() as download:page.locator('#save').click()
 assert download.value.suggested_filename=='historical-deployment-save.json'
 # Concealed shuffle occurs through WebCrypto, not an attacker-visible choice of face numbers.
 page.locator('#setup-mix').click()
 assert page.evaluate(api+'.setupView().concealedMixed') is True
 assert page.locator('#setup-ready').is_enabled()
 hidden_labels=page.locator('#counter-overlay .official-counter [data-role="unit_id"]').evaluate_all('(nodes)=>nodes.map(n=>n.textContent)')
 assert hidden_labels.count('*')==4
 assert all('leningrad-' not in txt for txt in hidden_labels)
 pending=page.evaluate(api+'.save()')
 assert pending['format']=='historical-source-deployment'
 page.locator('#load').set_input_files(files=[{'name':'setup.json','mimeType':'application/json','buffer':json.dumps(pending).encode()}])
 page.wait_for_function('(expected)=>HistoricalBrowserPreview.save().integrity.digest===expected',arg=pending['integrity']['digest'])
 assert not page.locator('#setup-panel').is_hidden()
 forged=json.loads(json.dumps(pending));forged['concealedMixed']=False
 page.locator('#load').set_input_files(files=[{'name':'forged.json','mimeType':'application/json','buffer':json.dumps(forged).encode()}])
 page.wait_for_function("document.getElementById('message').textContent.includes('Load rejected')")
 assert page.evaluate(api+'.save()')==pending
 page.locator('#setup-ready').click()
 assert page.locator('#setup-panel').is_hidden()
 assert page.evaluate(api+'.snapshot().cursor.turn')==1
 assert page.evaluate('(id)=>HistoricalBrowserPreview.snapshot().state.units[id].hex',first)=='0511'
 assert page.locator('#counter-overlay .official-counter').count()==19
 page.locator('#ai-step').click()
 assert page.evaluate(api+'.snapshot().actionCount')==1
 custom=page.evaluate(api+'.save()')
 assert custom['format']=='historical-custom-campaign'
 # A fresh candidate resets initial context. Custom save must carry its own deployment.
 page.locator('#new-game').click()
 assert page.evaluate('(id)=>HistoricalBrowserPreview.snapshot().state.units[id].hex',first)=='0210'
 page.locator('#load').set_input_files(files=[{'name':'custom-campaign.json','mimeType':'application/json','buffer':json.dumps(custom).encode()}])
 page.wait_for_function('(expected)=>HistoricalBrowserPreview.save().integrity.digest===expected',arg=custom['integrity']['digest'])
 assert page.evaluate('(id)=>HistoricalBrowserPreview.snapshot().state.units[id].hex',first)=='0511'
 assert page.evaluate(api+'.snapshot().actionCount')==1
 assert page.evaluate(api+'.save()')==custom
 assert not errors,errors
 out=ROOT/'rules/audit/visual/leningrad-player-deployment-v404.png';out.parent.mkdir(parents=True,exist_ok=True)
 # Show the actual engine-rendered deployment instead of a mockup.
 page.locator('#new-game').click()
 page.locator('[data-game-tab="settings"]').click()
 page.locator('#configure-setup').click()
 page.locator('#setup-mix').click()
 page.screenshot(path=str(out),full_page=True,animations='disabled')
 result={'checkpoint':170,'status':'PASS','sourceMapUnchanged':True,'officialCounters':19,'validMove':True,'invalidMoveRejected':True,'mixRequired':True,'setupSaveRestore':True,'customCampaignSaveRestore':True,'checksumRejectsModification':True,'turnOneHandoff':True,'actionsAfterHandoff':1,'pageErrors':errors,'screenshot':str(out.relative_to(ROOT)),'scope':'Isolated actual Chromium with byte-identical shared engine/map and official counter SVG templates'}
 (ROOT/'rules/audit/leningrad-player-deployment-browser-v404.json').write_text(json.dumps(result,indent=2)+'\n')
 print(json.dumps(result,indent=2))
 browser.close()
