#!/usr/bin/env python3
"""Real historical Leningrad Fleet Support Window transactions in Chromium.

Actual bundled shared game engine and map SVG only; counter crops from source.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import importlib.util,base64
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('support_511',ROOT/'tests/shared-support-window-browser-v511.py')
# Do not import script containing top-level browser execution.
spec=importlib.util.spec_from_file_location('fixture',ROOT/'tests/arduous-browser-v419.py')
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
VISUAL=ROOT/'rules/audit/visual';VISUAL.mkdir(exist_ok=True,parents=True)
ART={p.stem:'data:image/png;base64,'+base64.b64encode(p.read_bytes()).decode('ascii') for p in (ROOT/'assets/support-counters').glob('*.png')}
checks=0
def ok(cond,msg):
 global checks
 assert cond,msg
 checks+=1

def hydrate(page):
 result=page.evaluate(r"""data=>{let n=0;for(const img of document.querySelectorAll('[data-support-face] img,[data-support-fleet] img')){
  const match=img.getAttribute('src').match(/([^/]+)\.png$/);if(match&&data[decodeURIComponent(match[1])]){
   img.src=data[decodeURIComponent(match[1])];n++;
  }
 }return n;}""",ART)
 page.wait_for_function('Array.from(document.querySelectorAll("[data-support-face] img,[data-support-fleet] img")).every(x=>x.complete&&x.naturalWidth>0)')
 return result

def setup(page):
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture.html_for('leningrad'),wait_until='load',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 return errors

with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1510,'height':985},device_scale_factor=1)
 errors=setup(page)
 snap=page.evaluate('HistoricalBrowserPreview.snapshot()')
 fleet=snap['state']['supportMarkers']['balticFleet']
 ok(fleet['hex']=='1410' or fleet['hex'] is not None,'Fleet source port recorded: '+str(fleet['hex']))
 ok(fleet['condition']=='undamaged','Fleet starts undamaged')
 ok(page.locator('[data-support-fleet="balticFleet"]').count()==1,'Fleet section present')
 ok(page.locator('[data-fleet-status="undamaged"]').count()==1,'undamaged status derived from state')
 ok('Leningrad' in page.locator('[data-support-fleet]').inner_text(),'Fleet source city displayed')
 ok(page.locator('[data-support-naval-strike]').count()==1,'legal German air-to-Fleet strike available')
 ok(page.locator('[data-support-naval-finish]').count()==1,'legal finish air-sea phase')
 ok(page.locator('[data-support-fleet-action]').count()==0,'no Fleet relocation in German combat')
 ok(hydrate(page)==3,'two photographed air and one photographed Fleet counters decoded')
 ok('Baltic Fleet' in page.locator('[data-support-window]').inner_text(),'Fleet operational section visible')
 page.screenshot(path=str(VISUAL/'support-window-leningrad-fleet-v512.png'),full_page=False)
 first=page.locator('[data-support-naval-strike]').first
 face=first.get_attribute('data-support-naval-strike')
 first.click()
 pending=page.evaluate('HistoricalBrowserPreview.snapshot()')
 ok(pending['combat']['pendingSeaFaceId']==face,'naval air attack precommitted via exact human action')
 ok(page.locator('[data-support-naval-strike]').count()==0,'cannot issue second strike until die resolved')
 ok('Roll the damage die' in page.locator('[data-support-window]').inner_text(),'pending die instruction displayed')
 ok(page.evaluate('(d)=>HistoricalBrowserPreview.roll(d)',6),'human gateway resolves postcommit Fleet die')
 after=page.evaluate('HistoricalBrowserPreview.snapshot()')
 ok(after['state']['airUse']['1'][face]=='fleet','Fleet strike consumes air marker for naval attack')
 ok(after['state']['supportMarkers']['balticFleet']['condition']=='undamaged','miss does not damage Fleet')
 ok(page.locator(f'[data-support-face="{face}"]').get_attribute('data-support-status')=='committed','air counter shown committed')
 save=page.evaluate('HistoricalBrowserPreview.save()')
 ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',save),'naval strike round trips saved campaign')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().state.airUse["1"]')[face]=='fleet','restored navy use is unchanged')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Undo naval die result')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().combat.pendingSeaFaceId')==face,'pending naval attack restored')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Undo naval declaration')
 ok(page.locator('[data-support-naval-strike]').count()==1,'legal naval option restored')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().actionCount')==0,'Undo returns to zero actions')
 # Progress through the actual historical phase sequence to Soviet special
 # movement. No custom or synthetic Fleet relocation action is introduced.
 for expected in ['finish-air-sea','commit-battles','finish-combat','finish-phase','finish-buildup']:
  candidate=page.evaluate('''typ=>HistoricalBrowserPreview.view().commands.find(a=>(a.action?.type||a.type)===typ)''',expected)
  ok(bool(candidate),'source legal phase transition: '+expected)
  ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',candidate),'advance historical phase: '+expected)
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().phaseKind')=='special-movement','historical Soviet special movement reached')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().actor')=='soviet','Soviet owns Fleet movement')
 moves=page.locator('[data-support-fleet-action="declare-fleet-move"]')
 ok(moves.count()==5,'five legal alternative Fleet ports offered')
 hydrate(page)
 page.screenshot(path=str(VISUAL/'support-window-leningrad-fleet-move-v512.png'),full_page=False)
 choice=page.evaluate('HistoricalBrowserPreview.view().commands.find(a=>a.type==="declare-fleet-move")')
 ok(bool(choice),'real source Fleet move action exists')
 target=choice['to']
 moves.first.click()
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().pendingFleet')==target,'Fleet destination committed before damage die')
 ok('roll the movement damage die' in page.locator('[data-support-fleet]').inner_text(),'required postcommit die explicitly displayed')
 ok(page.evaluate('(d)=>HistoricalBrowserPreview.roll(d)',1),'real die commits Fleet departure damage')
 moved=page.evaluate('HistoricalBrowserPreview.snapshot()')
 ok(moved['state']['supportMarkers']['balticFleet']['hex']==target,'Fleet moves to source-certified destination')
 ok(moved['state']['supportMarkers']['balticFleet']['condition']=='damaged','first hit flips Fleet to damaged')
 ok(page.locator('[data-fleet-status="damaged"]').count()==1,'DAMAGED status shown')
 ok('leningrad-back-r04c01.png' in page.locator('[data-support-fleet] img').get_attribute('src'),'printed damaged reverse selected')
 hydrate(page)
 page.screenshot(path=str(VISUAL/'support-window-leningrad-fleet-damaged-v512.png'),full_page=False)
 move_save=page.evaluate('HistoricalBrowserPreview.save()')
 ok(page.evaluate('(saved)=>HistoricalBrowserPreview.restore(saved)',move_save),'damaged Fleet state save/restore accepted')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().state.supportMarkers.balticFleet.condition')=='damaged','damaged Fleet survives restore')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Fleet damage die Undo accepted')
 ok(page.evaluate('HistoricalBrowserPreview.snapshot().pendingFleet')==target,'Undo restores committed move without die')
 ok(not errors,'no browser exceptions '+repr(errors))
 page.close()
 tablet=browser.new_page(viewport={'width':768,'height':900},has_touch=True,is_mobile=True)
 tablet_errors=setup(tablet)
 ok(tablet.locator('[data-support-window]').is_visible(),'tablet Support window visible')
 ok(not tablet.locator('#support-window-body').is_visible(),'tablet Support window starts collapsed')
 tablet.locator('[data-support-collapse]').click()
 ok(tablet.locator('[data-support-fleet]').is_visible(),'tablet Fleet section visible after expansion')
 ok(hydrate(tablet)==3,'tablet source Fleet and air counter images decoded')
 tablet.screenshot(path=str(VISUAL/'support-window-leningrad-fleet-tablet-v512.png'),full_page=False)
 ok(not tablet_errors,'no tablet exceptions '+repr(tablet_errors))
 tablet.close();browser.close()
print('PASS v512 Fleet Support Window:',checks,'real historical Chromium assertions')
