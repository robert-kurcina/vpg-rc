#!/usr/bin/env python3
"""Original shared-engine Kiev SVG + exact source-reviewed graph evidence
in real Chromium, no recreated terrain or network-fetched imagery."""
from __future__ import annotations
import base64, hashlib, json, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
N=0
def ok(cond,what):
 global N
 assert cond,what
 N+=1
def eq(actual,expected,what):
 global N
 assert actual==expected,f'{what}: {actual!r} != {expected!r}'
 N+=1
cfg=json.loads((ROOT/'tools/movement-review/kiev.json').read_text())
files={'kiev.json':cfg,
 cfg['map']:json.loads((ROOT/'maps/kiev.json').read_text()),
 cfg['candidateEdges']:json.loads((ROOT/'rules/audit/kiev-movement-edge-review-v478.json').read_text())}
page_html=(ROOT/'tools/movement-review/index.html').read_text()
asset=base64.b64encode((ROOT/'exports/kiev.svg').read_bytes()).decode('ascii')
scan=base64.b64encode((ROOT/'maps/source/kiev-map-scan.jpg').read_bytes()).decode('ascii')
page_html=page_html.replace('src="../../exports/kiev.svg"',f'src="data:image/svg+xml;base64,{asset}"')
page_html=page_html.replace('src="../../maps/source/kiev-map-scan.jpg"',f'src="data:image/jpeg;base64,{scan}"')
for src,filename in [('../../core/sync_sha256.js','core/sync_sha256.js'),('app.js','tools/movement-review/app.js')]:
 code=(ROOT/filename).read_text().replace('</script','<\\/script')
 if src=='../../core/sync_sha256.js':
  code='window.__sourceFiles='+json.dumps(files,separators=(',',':'))+';window.fetch=async p=>({ok:Object.hasOwn(__sourceFiles,p),json:async()=>__sourceFiles[p]});'+code
 page_html=page_html.replace(f'<script src="{src}"></script>',f'<script>{code}</script>')
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':1460,'height':980},accept_downloads=True)
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(page_html,wait_until='domcontentloaded',timeout=50000)
 page.wait_for_function('!!window.MovementEdgeReview',timeout=25000)
 eq(page.locator('#edges g').count(),442,'all source-reviewed sides rendered on shared engine map')
 eq(page.locator('#edges g[data-kind="major-river"]').count(),10,'major river sides')
 eq(page.locator('#edges g[data-kind="river"]').count(),72,'ordinary river sides without major')
 ok('93 rail' in page.locator('#counts').inner_text(),'rail source count visible')
 ok('442 unreviewed' in page.locator('#counts').inner_text(),'no automatic source review')
 ok(page.locator('#map-art').evaluate('(el)=>el.complete&&el.naturalWidth>0'),'actual approved engine SVG loaded')
 eq(page.evaluate('MovementEdgeReview.audit().source.currentGraphAuthorization'),'source-verified-experimental-not-historically-certified','bounded experimental graph authorization disclosed')
 ids=page.locator('#edges g').evaluate_all('(els)=>els.map(e=>e.dataset.edge)')
 eq(len(set(ids)),442,'unique source pair IDs')
 # No classification on inspection; explicit manual controls only.
 selected=page.locator('#edges g').first
 selected.locator('.hit').click(force=True)
 edge=selected.get_attribute('data-edge')
 eq(page.evaluate('MovementEdgeReview.snapshot().selected'),edge,'click selects source edge')
 eq(page.evaluate('Object.keys(MovementEdgeReview.snapshot().reviews).length'),0,'inspection does not classify')
 page.locator('#note').fill('TEST ONLY: check original source SVG finite-side rail stroke')
 page.locator('#confirm').click()
 eq(selected.get_attribute('data-review'),'confirmed','manual confirmation recorded')
 ok('1 reviewed' in page.locator('#counts').inner_text(),'review coverage counted')
 eq(page.evaluate(f'MovementEdgeReview.snapshot().reviews[{json.dumps(edge)}].note'),
    'TEST ONLY: check original source SVG finite-side rail stroke','manual note preserved')
 page.locator('#dispute').click()
 eq(selected.get_attribute('data-review'),'disputed','dispute overrides confirmation')
 ok('1 disputed' in page.locator('#counts').inner_text(),'dispute visible')
 page.locator('#filter').select_option('disputed')
 eq(page.locator('#edges g:not([hidden])').count(),1,'disputed filter isolates single edge')
 page.locator('#filter').select_option('major-river')
 eq(page.locator('#edges g:not([hidden])').count(),10,'major river filter source-pinned')
 page.locator('#filter').select_option('rail')
 eq(page.locator('#edges g:not([hidden])').count(),93,'rail filter includes shared river/rail hexsides')
 page.locator('#filter').select_option('river')
 eq(page.locator('#edges g:not([hidden])').count(),72,'river filter includes shared rail/river hexsides')
 page.locator('#next').click()
 next_id=page.evaluate('MovementEdgeReview.snapshot().selected')
 ok(next_id is not None and next_id!=edge,'review navigation skips already-reviewed edge')
 ok(page.locator(f'#edges g[data-edge="{next_id}"]').get_attribute('data-kind')=='major-river',
    'unreviewed navigation prioritizes major river')
 eq(page.locator('#filter').input_value(),'all','navigation makes next edge visible')
 eq(page.evaluate('Object.keys(MovementEdgeReview.snapshot().reviews).length'),1,
    'next navigation does not classify')
 with page.expect_download() as dl:page.locator('#save').click()
 eq(dl.value.suggested_filename,'kiev-movement-edges-UNAPPROVED-DRAFT.json','explicit draft filename')
 temp=Path(tempfile.gettempdir())/'kiev-movement-review-browser-v478.json';dl.value.save_as(temp)
 draft=json.loads(temp.read_text());temp.unlink()
 eq(draft['gameplayAuthorized'],False,'draft cannot authorize historical gameplay')
 eq(draft['reviews'][edge]['status'],'disputed','review state exported')
 ok(draft['sourceAuditSHA256']==files[cfg['candidateEdges']]['integrity']['digest'],'source audit digest exported')
 page.locator('#reset').click()
 eq(page.evaluate('Object.keys(MovementEdgeReview.snapshot().reviews).length'),0,'reset clears only draft')
 page.locator('#load').set_input_files(files=[{'name':'review.json','mimeType':'application/json','buffer':json.dumps(draft).encode()}])
 page.wait_for_function("document.getElementById('message').textContent.includes('restored')")
 eq(page.evaluate('MovementEdgeReview.exportDraft()'),draft,'source-matched draft exact roundtrip')
 forged=json.loads(json.dumps(draft));forged['reviews'][edge]['status']='confirmed'
 page.locator('#load').set_input_files(files=[{'name':'tamper.json','mimeType':'application/json','buffer':json.dumps(forged).encode()}])
 page.wait_for_function("document.getElementById('message').textContent.includes('rejected')")
 eq(page.evaluate('MovementEdgeReview.exportDraft()'),draft,'checksum failure import atomic')
 wrong=json.loads(json.dumps(draft));wrong['sourceAuditSHA256']='0'*64
 payload={k:v for k,v in wrong.items() if k!='integrity'}
 wrong['integrity']['digest']=hashlib.sha256(json.dumps(payload,separators=(',',':')).encode()).hexdigest()
 page.locator('#load').set_input_files(files=[{'name':'wrong.json','mimeType':'application/json','buffer':json.dumps(wrong).encode()}])
 page.wait_for_function("document.getElementById('message').textContent.includes('rejected')")
 eq(page.evaluate('MovementEdgeReview.exportDraft()'),draft,'source mismatch import rejected atomically')
 # Edge remains keyboard accessible; do not classify by focus alone.
 key_edge=page.locator('#edges g[data-kind="rail"] .hit').first
 key_edge.focus();key_edge.press('Enter')
 ok(page.evaluate('MovementEdgeReview.snapshot().selected') in ids,'keyboard source edge selection')
 ok(not errors,'no real browser JS errors: '+str(errors))
 page.locator('#filter').select_option('major-river');page.locator('#next').click()
 page.screenshot(path=str(ROOT/'rules/audit/visual/kiev-movement-edge-review-browser-v478.png'),full_page=True,animations='disabled')
 mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True)
 mp=mobile.new_page();mp.set_content(page_html,wait_until='domcontentloaded',timeout=45000)
 mp.wait_for_function('!!window.MovementEdgeReview',timeout=25000)
 eq(mp.locator('#edges g').count(),442,'same source ledger on touch device')
 ok(mp.locator('#map-scroll').evaluate('(el)=>el.scrollWidth>el.clientWidth*1.7'),'touch map scrollable')
 mp.locator('#edges g[data-kind="major-river"] .hit').first.tap(force=True)
 ok(mp.evaluate('MovementEdgeReview.snapshot().selected') is not None,'touch edge selection')
 ok(mp.locator('#map-art').evaluate('(el)=>el.complete&&el.naturalWidth>0'),'approved engine map on mobile')
 mobile.close();browser.close()
print('PASS Kiev movement edge review actual Chromium:',N,'assertions, source 442 edges, mobile, save/restore; no game activation')
