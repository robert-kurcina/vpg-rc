#!/usr/bin/env python3
"""Actual engine/browser acceptance: click Support counter -> legal hex -> confirm.

No fake interactions, alternate map render, gameplay API server or inferred target
locations. Published source SVG, core modules, counters and real legal actions.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import importlib.util,base64
ROOT=Path(__file__).resolve().parents[1]
sp=importlib.util.spec_from_file_location('fixture_v419',ROOT/'tests/arduous-browser-v419.py')
fixture=importlib.util.module_from_spec(sp);sp.loader.exec_module(fixture)
VIS=ROOT/'rules/audit/visual';VIS.mkdir(parents=True,exist_ok=True)
ART={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode('ascii') for p in (ROOT/'assets/support-counters').glob('*.png')}
checks=0
def ok(cond,label):
 global checks
 assert cond,label
 checks+=1

def start(browser,scenario,**new_page_kwargs):
 page=browser.new_page(**{'viewport':{'width':1510,'height':960},'device_scale_factor':1,**new_page_kwargs})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture.html_for(scenario),wait_until='domcontentloaded',timeout=28000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=24000)
 ok(page.locator('[data-support-window]').count()==1,scenario+' live shared Support Window')
 ok(page.locator('[data-support-pick]').count()>=1,scenario+' source Support row selectable')
 ok(page.locator('[data-support-target]').count()==0,scenario+' no unsolicited legal target')
 ok(not errors,scenario+' initialized without page errors: '+repr(errors))
 return page,errors

def hydrate(page):
 page.evaluate('''data=>{for(const img of document.querySelectorAll('[data-support-face] img,[data-support-fleet] img')){
  const match=(img.getAttribute('src')||'').match(/([^/]+)\\.png$/);
  if(match&&data[decodeURIComponent(match[1])])img.src=data[decodeURIComponent(match[1])];
 }}''',ART)
 try:
  page.wait_for_function('Array.from(document.querySelectorAll("[data-support-face] img,[data-support-fleet] img")).filter(x=>x.getClientRects().length>0).every(x=>x.complete&&x.naturalWidth>0)',timeout=7500)
 except Exception:
  print('Image hydration diagnostic:',page.evaluate('''()=>[...document.querySelectorAll('[data-support-face] img,[data-support-fleet] img')].map(i=>({src:i.getAttribute('src')?.slice(0,140),loaded:i.complete,width:i.naturalWidth}))'''))
  raise

def act(page,kind):
 action=page.evaluate('''kind=>HistoricalBrowserPreview.view().commands.find(a=>(a.action?.type||a.type)===kind)''',kind)
 ok(action is not None,'source transition '+kind+' offered')
 ok(page.evaluate('a=>HistoricalBrowserPreview.choose(a)',action),'source transition '+kind+' accepted')

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 # Arduous: choose counter first; no phantom targets before declaration.
 page,errors=start(browser,'arduous')
 selected=page.locator('[data-support-pick^="air:"]').first
 face=selected.get_attribute('data-support-pick').split(':',1)[1]
 selected.click()
 ok(page.evaluate('HistoricalBrowserPreview.supportSelection().id')==face,'clicked air counter becomes selected')
 ok(page.locator('[data-support-target]').count()==0,'no fabricated target before declaration')
 ok(page.locator('#support-window-body').is_visible(),'window explains unavailable targets before battle declaration')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==0,'picking counter does not commit game action')
 act(page,'finish-air-sea')
 proposal=page.evaluate('HistoricalBrowserPreview.view().proposals[0]')
 ok(proposal is not None,'first genuine battle proposal exists')
 ok(page.evaluate('a=>HistoricalBrowserPreview.choose(a)',{'type':'combat','action':{'type':'commit-battles','battles':[proposal]}}),'actual battle declaration commits')
 act(page,'select-battle')
 hex=proposal['defenderHex']
 ok(page.evaluate('HistoricalBrowserPreview.supportMap().hexes')==[hex],'map highlights the exact declared defender hex only')
 ok(page.locator('[data-support-target]').count()==1,'one map target rendered from exact legal action')
 style=page.locator('[data-support-target]').first.evaluate('''e=>{const c=getComputedStyle(e);return {stroke:c.stroke,width:parseFloat(c.strokeWidth),dash:c.strokeDasharray,join:c.strokeLinejoin}}''')
 ok(style['stroke']=='rgb(158, 121, 0)','Arduous legal hex uses solid dark yellow stroke')
 ok(style['width']>=5,'Arduous legal hex has thick border')
 ok(style['dash']=='none','Arduous legal hex has no stroke dashes')
 ok(style['join']=='round','Arduous legal hex uses rounded joins')
 ok(not page.locator('#support-window-body').is_visible(),'window collapses when legal targets become available')
 ok(page.locator('[data-support-assign]').count()==0,'no one-click commit from Support row')
 page.screenshot(path=str(VIS/'support-map-arduous-highlights-v514.png'),full_page=False)
 page.locator('[data-support-target]').first.click(force=True)
 ok(page.locator('[data-support-confirm]').count()==1,'map click exposes a confirmation')
 selectedStyle=page.locator('[data-support-target]').first.evaluate('''e=>{const c=getComputedStyle(e);return {stroke:c.stroke,width:parseFloat(c.strokeWidth),dash:c.strokeDasharray}}''')
 ok(selectedStyle['stroke']=='rgb(128, 97, 0)' and selectedStyle['width']>=6 and selectedStyle['dash']=='none','selected hex remains thick solid dark yellow')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().combat.groundAirLocked') is False,'map click does not commit combat')
 ok(page.locator('#support-window-body').is_visible(),'Support Window expands after a destination is chosen')
 hydrate(page)
 page.screenshot(path=str(VIS/'support-map-arduous-confirm-v514.png'),full_page=False)
 page.locator('[data-support-confirm]').click()
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().combat.groundAirChoice')==face,'confirmed exact source face')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().combat.groundAirLocked') is True,'engine locks choice only on confirmation')
 ok(page.evaluate('HistoricalBrowserPreview.supportSelection()') is None,'selection clears after committed action')
 saved=page.evaluate('HistoricalBrowserPreview.save()')
 ok(page.evaluate('saved=>HistoricalBrowserPreview.restore(saved)',saved),'save/restore preserves confirmed air choice')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().combat.groundAirChoice')==face,'restored face is unchanged')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Undo successful')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().combat.groundAirLocked') is False,'Undo resets air choice')
 ok(not errors,'Arduous browser no errors after transaction: '+repr(errors))
 # Escape cancels selection; no side effect.
 page.locator('[data-support-pick^="air:"]').first.click()
 page.keyboard.press('Escape')
 ok(page.evaluate('HistoricalBrowserPreview.supportSelection()') is None,'Escape cancels map mode')
 ok(page.locator('[data-support-target]').count()==0,'Escape removes overlays')
 page.close()
 # Leningrad: naval air attack targets the actual Fleet port, not every port.
 page,errors=start(browser,'leningrad')
 fleet_hex=page.evaluate('HistoricalBrowserPreview.snapshot().state.supportMarkers.balticFleet.hex')
 naval=page.locator('[data-support-pick^="air:"]').first
 naval_face=naval.get_attribute('data-support-pick').split(':',1)[1]
 naval.click()
 ok(page.evaluate('HistoricalBrowserPreview.supportMap().hexes')==[fleet_hex],'naval air target exactly Fleet port')
 ok(not page.locator('#support-window-body').is_visible(),'naval air selection minimizes window')
 page.locator('[data-support-target]').first.click(force=True)
 ok(page.locator('[data-support-confirm]').count()==1,'naval strike is staged not committed')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().combat.pendingSeaFaceId') is None,'no naval strike before confirmation')
 hydrate(page)
 page.screenshot(path=str(VIS/'support-map-leningrad-naval-v514.png'),full_page=False)
 page.locator('[data-support-confirm]').click()
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().combat.pendingSeaFaceId')==naval_face,'naval strike commits exact source face')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'naval Undo succeeds')
 # Follow actual phase chain to Fleet movement; test all five legal ports.
 for kind in ['finish-air-sea','commit-battles','finish-combat','finish-phase','finish-buildup']:
  act(page,kind)
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().phaseKind')=='special-movement','Fleet legal movement phase reached')
 fleet=page.locator('[data-support-pick^="fleet:"]')
 ok(fleet.count()==1,'Fleet source counter selectable for legal destinations')
 fleet.click()
 destinations=page.evaluate('HistoricalBrowserPreview.supportMap().hexes')
 ok(len(destinations)==5,'all five certified Fleet destination ports highlighted')
 ok(page.locator('[data-support-target]').count()==5,'five exact map hotspots generated')
 ok(page.evaluate('Array.from(document.querySelectorAll("[data-support-target]")).every(e=>getComputedStyle(e).stroke==="rgb(158, 121, 0)"&&parseFloat(getComputedStyle(e).strokeWidth)>=5&&getComputedStyle(e).strokeDasharray==="none")'),'all five Fleet targets use the same thick solid dark yellow')
 ok(page.locator('[data-support-fleet-action]').count()==0,'Fleet movement buttons replaced by map targets')
 page.screenshot(path=str(VIS/'support-map-leningrad-fleet-highlights-v514.png'),full_page=False)
 target=page.locator('[data-support-target]').first.get_attribute('data-support-target')
 page.locator('[data-support-target]').first.click(force=True)
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().pendingFleet') is None,'Fleet map click stages without commitment')
 ok(page.locator('[data-support-confirm]').count()==1,'Fleet confirmation available')
 page.locator('[data-support-confirm]').click()
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().pendingFleet')==target,'exact Fleet movement committed')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Fleet destination Undo accepted')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().pendingFleet') is None,'undo clears unrolled Fleet commitment')
 ok(not errors,'Leningrad browser no exceptions: '+repr(errors))
 page.close()
 # iPad starts docked; user selection collapses and map targets can be tapped.
 page,errors=start(browser,'arduous',viewport={'width':768,'height':910},has_touch=True,is_mobile=True)
 ok(not page.locator('#support-window-body').is_visible(),'iPad initial dock compact')
 page.locator('[data-support-collapse]').click()
 ok(page.locator('#support-window-body').is_visible(),'iPad can expand window')
 page.locator('[data-support-pick^="air:"]').first.tap()
 ok(page.locator('#support-window-body').is_visible(),'iPad keeps instructions visible when no target is legal')
 ok(page.locator('[data-support-target]').count()==0,'iPad creates no premature legal targets')
 ok(page.evaluate('HistoricalBrowserPreview.supportSelection()') is not None,'iPad keeps selected marker')
 ok(not errors,'iPad browser no exceptions')
 page.screenshot(path=str(VIS/'support-map-tablet-docked-v514.png'),full_page=False)
 page.close()
 browser.close()
print('PASS v514 Support map Chromium:',checks,'assertions')
