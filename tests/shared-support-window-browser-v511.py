#!/usr/bin/env python3
"""Real historical game browser UI: source-photo Air Support window + legal actions.

The sandbox blocks localhost navigation, so original packaged JS/CSS, certified
map SVG and real source-photo counter PNG bytes are loaded in-memory. Gameplay
is NEVER simulated; the actual historical campaign/session is used.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import importlib.util,base64,json,re,sys
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('browser_fixture',ROOT/'tests/arduous-browser-v419.py')
fixture=importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
visual=ROOT/'rules/audit/visual';visual.mkdir(parents=True,exist_ok=True)
checks=0
def ok(test,label):
 global checks
 assert test,label
 checks+=1

def art_map():
 return {file.stem:'data:image/png;base64,'+base64.b64encode(file.read_bytes()).decode('ascii')
         for file in (ROOT/'assets/support-counters').glob('*.png')}
ART=art_map()
def hydrate(page):
 # The live page resolves these HTTP image paths naturally. A browser opened
 # with an about:blank in-memory document has no relative URL base, so this
 # substitutes the same shipped cropped source pixels for screenshot checks.
 result=page.evaluate(r'''data=>{let n=0;for(const img of document.querySelectorAll('[data-support-face] img')){
  const match=img.getAttribute('src').match(/([^/]+)\.png$/);if(match&&data[decodeURIComponent(match[1])]){
   img.src=data[decodeURIComponent(match[1])];n++;
  }
 }return n;}''',ART)
 page.wait_for_function('Array.from(document.querySelectorAll("[data-support-face] img")).every(x=>x.complete&&x.naturalWidth>0)')
 return result

def setup(page,game):
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture.html_for(game),wait_until='load',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 ok(page.locator('[data-support-window]').count()==1,game+' shared window mounted')
 ok(page.locator('[data-support-face]').count()==2,game+' two source air markers')
 ok(page.locator('[data-support-assign]').count()==0,game+' cannot commit outside legal choice')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==0,game+' initial campaign untouched')
 ok(page.locator('#map-art').evaluate('(img)=>img.complete&&img.naturalWidth>0'),game+' actual exported game map rendered')
 ok(not errors,game+' no browser exceptions on load '+str(errors))
 return errors

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1480,'height':970},device_scale_factor=1)
 errors=setup(page,'arduous')
 window=page.locator('[data-support-window]')
 ok(window.is_visible(),'desktop panel visible')
 ok(hydrate(page)==2,'two photographed counter faces visible in actual browser')
 ok(all(page.locator('[data-support-face] img').evaluate_all('(xs)=>xs.map(x=>x.naturalWidth>0)')),'source counter bitmaps decoded')
 page.screenshot(path=str(visual/'support-window-arduous-desktop-v511.png'),full_page=False)
 # Desktop window can be moved by its title bar, with no campaign effects.
 before=window.bounding_box();heading=page.locator('[data-support-drag-handle]');rect=heading.bounding_box()
 page.mouse.move(rect['x']+90,rect['y']+15);page.mouse.down()
 page.mouse.move(rect['x']+15,rect['y']+65,steps=6);page.mouse.up()
 after=window.bounding_box()
 ok(abs(after['x']-before['x'])>10 or abs(after['y']-before['y'])>10,'desktop drag changes panel position')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==0,'drag does not touch game state')
 page.locator('[data-support-collapse]').click()
 ok(page.locator('[data-support-window]').is_visible(),'collapsed title bar stays visible')
 ok(not page.locator('#support-window-body').is_visible(),'collapse hides body')
 page.locator('[data-support-collapse]').click()
 ok(page.locator('#support-window-body').is_visible(),'expand restores body')
 page.locator('[data-support-close]').click()
 ok(not page.locator('[data-support-window]').is_visible(),'close hides, not destroys')
 ok(page.locator('[data-support-launcher]').is_visible(),'persistent reopen launcher available')
 page.locator('[data-support-launcher]').click()
 ok(window.is_visible(),'reopen restores window')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==0,'visibility controls did not alter combat state')
 # Now drive the real authoritative campaign into a live air support decision.
 api='HistoricalBrowserPreview'
 first=page.evaluate(api+'.view().commands.find(a=>a.action?.type==="finish-air-sea")')
 ok(bool(first),'real source air-sea prelude exists')
 ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',first),'finish prelude via real legal action')
 choice=page.evaluate(api+'.view().proposals[0]')
 ok(bool(choice),'real combat proposal available')
 ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',{'type':'combat','action':{'type':'commit-battles','battles':[choice]}}),'commit source-validated battle')
 select=page.evaluate(api+'.view().commands.find(a=>a.action?.type==="select-battle")')
 ok(bool(select),'real select-battle choice available')
 ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',select),'select real combat')
 ok(page.locator('[data-support-assign]').count()==2,'only legal air markers offered for selected battle')
 ok(page.locator('[data-support-none]').count()==1,'explicit no-air decision offered')
 hydrate(page)
 page.screenshot(path=str(visual/'support-window-arduous-eligible-v511.png'),full_page=False)
 available=page.locator('[data-support-assign]').first.get_attribute('data-support-assign')
 # Actual UI click must transact via the same authoritative legal-action path.
 page.locator('[data-support-assign]').first.click()
 snap=page.evaluate(api+'.snapshot()')
 ok(snap['combat']['groundAirLocked'] is True,'air decision locked by shared engine')
 ok(snap['combat']['groundAirChoice']==available,'chosen marker stored by engine')
 ok(page.locator('[data-support-assign]').count()==0,'no repeat assignment after lock')
 ok(page.locator(f'[data-support-face="{available}"]').get_attribute('data-support-status')=='committed','pending assignment shown committed')
 save=page.evaluate(api+'.save()')
 ok(page.evaluate('(save)=>HistoricalBrowserPreview.restore(save)',save),'source-backed save/restore preserves support choice')
 ok(page.evaluate(api+'.snapshot().combat.groundAirChoice')==available,'restored support identity unchanged')
 ok(page.evaluate(api+'.undo()'),'Undo air choice accepted')
 ok(page.evaluate(api+'.snapshot().combat.groundAirLocked') is False,'Undo restores undecided air choice')
 ok(page.locator('[data-support-assign]').count()==2,'legal choices restored after Undo')
 ok(not errors,'no browser exceptions across combat transactions: '+str(errors))
 page.close()
 # Leningrad: second marker arrives Turn 6, not a selectable candidate on Turn 1.
 leningrad=browser.new_page(viewport={'width':1500,'height':930})
 errors=setup(leningrad,'leningrad')
 ok(leningrad.locator('[data-support-status="not-arrived"]').count()==1,'source Turn-6 reinforcement disabled on Turn 1')
 ok(leningrad.locator('[data-support-face] img').count()==2,'Leningrad counter artwork has two registered faces')
 ok(not errors,'Leningrad browser no JS errors')
 leningrad.close()
 # Tablet/mobile: the panel is docked/collapsed by default; the map remains visible.
 tablet=browser.new_page(viewport={'width':768,'height':910},device_scale_factor=1,has_touch=True,is_mobile=True)
 errors=setup(tablet,'arduous')
 title=tablet.locator('[data-support-window]')
 ok(title.is_visible(),'tablet bottom dock visible')
 ok(not tablet.locator('#support-window-body').is_visible(),'touch initial compact state avoids occluding map')
 ok(tablet.locator('#map-scroll').is_visible(),'mobile map remains accessible')
 tablet.locator('[data-support-collapse]').click()
 ok(tablet.locator('#support-window-body').is_visible(),'tablet tap expands panel')
 geom=title.bounding_box()
 ok(geom['x']>=0 and geom['x']+geom['width']<=768 and geom['y']+geom['height']<=910,'tablet panel in viewport')
 hydrate(tablet)
 tablet.screenshot(path=str(visual/'support-window-tablet-docked-v511.png'),full_page=False)
 tablet.locator('[data-support-close]').click()
 ok(not title.is_visible(),'touch close hides sheet')
 ok(tablet.locator('[data-support-launcher]').is_visible(),'touch launcher remains available')
 ok(not errors,'tablet no JS exceptions')
 tablet.close()
 browser.close()
print('PASS shared Support Window Chromium',checks,'checks; authoritative Arduous + Leningrad engines, actual map exports and source-photo counters')
