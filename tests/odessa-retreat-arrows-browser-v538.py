#!/usr/bin/env python3
"""Chromium acceptance of shared source-approved Kiev–Odessa retreat arrows and
source Support counter artwork. Uses shipped engine, map, cards, CRT, no mockups.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,base64,os
ROOT=Path(__file__).resolve().parents[1]
# Match existing seven-turn test's in-memory, actual-source document runner.
ns={'__file__':str(ROOT/'tests/odessa-contested-seven-turn-browser-v537.py')}
source=Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0]
exec(source,ns)
checks=0
def ok(condition,why):
 global checks
 assert condition,why
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['html'],wait_until='load',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=35000)
 api='window.HistoricalBrowserPreview'
 snap=lambda:page.evaluate(api+'.snapshot()')
 view=lambda:page.evaluate(api+'.view()')
 choose=lambda a:page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',a)
 # Verify original printed Support artwork; not broken-image alt text.
 images=page.locator('[data-support-face] img, [data-support-fleet] img')
 ok(images.count()==4,'all three air and Fleet source faces present at Turn 1')
 info=images.evaluate_all('imgs=>imgs.map(i=>({ok:i.complete&&i.naturalWidth>0&&i.naturalHeight>0,src:i.getAttribute("src"),face:i.dataset.supportFaceId}))')
 for item in info:
  ok(item['ok'],'original photo decoded: '+item['face'])
  ok(item['src'].startswith('data:image/png;base64,'),'offline-safe art data URL: '+item['face'])
  original=(ROOT/'assets/support-counters'/(item['face']+'.png')).read_bytes()
  ok(base64.b64decode(item['src'].split(',',1)[1])==original,'byte-for-byte source counter matches: '+item['face'])
 ok(page.locator('.support-art-fallback').count()==0,'no broken-image fallback')
 # Render source cards for support screenshot before the combat choice.
 page.locator('[data-support-window]').screenshot(path=str(ROOT/'rules/audit/visual/support-original-counter-art-v538.png'))
 for act in [
  {'type':'combat','action':{'type':'finish-air-sea'}},
  {'type':'combat','action':{'type':'commit-battles','battles':[{'defenderHex':'0205','attackers':['kiev-front-r01c01','kiev-front-r01c03']}]}},
  {'type':'combat','action':{'type':'select-battle','defenderHex':'0205'}},
  {'type':'combat','action':{'type':'commit-ground-air','faceId':'kiev-front-r03c01'}}
 ]: ok(choose(act),'source-legal battle declaration '+str(act))
 ok(page.evaluate('HistoricalBrowserPreview.roll(3)'),'committed d6=3')
 ok(view()['crtOutcome']=='EX','same B4M Exchange as checkpoint 303')
 rm=page.evaluate('HistoricalBrowserPreview.retreatMap()')
 ok(rm['active'],'shared retreat map presentation active')
 ok(len(rm['routes'])>=1,'at least one engine-validated retreat route')
 ok(rm['routes'][0]['routes'][0]['hexes']==['0205','0306','0405'],'correct actual retreat path from engine')
 ok(page.locator('#historical-retreat-route-layer .retreat-arrow').count()>=2,'visible arrow segments for both legs')
 ok(page.locator('[data-retreat-route]').count()>=2,'real clickable arrows')
 ok(page.locator('[data-retreat-target="0405"]').count()==1,'end hex uses shared legal-placement outline')
 ok(page.locator('[data-retreat-confirm]').count()==0,'route selection not implicitly committed')
 before=snap();options=view()['options']
 ok(len(options)==9,'original nine source-validated EX consequences retained')
 # Accessible keyboard selection and cancellation share the map contract.
 page.locator('[data-retreat-route]').first.focus()
 page.keyboard.press('Enter')
 ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()')=='retreat-0','keyboard Enter stages the arrow')
 page.keyboard.press('Escape')
 ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()') is None,'Escape cancels staged preview without consequence')
 # Selecting a route filters options but does not mutate the human journal.
 page.locator('[data-retreat-route]').first.click(force=True)
 ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()')=='retreat-0','arrow click staged legal path')
 ok(snap()==before,'stage is only a preview; damage and phase unchanged')
 ok(page.locator('[data-retreat-confirm]').count()>=1,'only exact source-validated outcomes offered')
 ok(page.locator('[data-retreat-group].is-selected').count()==1,'selected arrows visually emphasized')
 ok(page.locator('[data-retreat-target="0405"].retreat-target-selected').count()==1,'selected destination bold border')
 # Save/Restore of the pending die is independent of ephemeral route selection.
 saved=page.evaluate('HistoricalBrowserPreview.save()')
 ok(page.evaluate('(v)=>HistoricalBrowserPreview.restore(v)',saved),'original post-roll pending save restore')
 ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()') is None,'UI preview cleared on restore')
 ok(snap()==before,'restore did not commit a premature retreat')
 # Stage by map destination, screenshot real engine state with visible counter + arrows.
 page.locator('[data-retreat-target="0405"]').click(force=True)
 ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()')=='retreat-0','destination click stages route')
 page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-retreat-arrows-actual-browser-v538.png'),full_page=False)
 # One confirmed complete combat consequence, no invented separate route action.
 page.locator('[data-retreat-confirm]').first.click()
 ok(view()['kind']!='post-roll-choice','player confirmed a complete combat consequence')
 ok(snap()['state']['units']['kiev-front-r03c04']['hex']=='0405','actual defender retreats two hexes')
 ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()') is None,'route overlay state clears after commitment')
 ok(page.locator('[data-retreat-route]').count()==0,'arrows disappear after resolving')
 ok(page.evaluate('HistoricalBrowserPreview.undo()'),'undo authoritative combat action')
 ok(snap()==before,'undo restores committed die and exact pre-resolution state')
 ok(view()['kind']!='post-roll-choice','Undo clears transient committed die, requiring a new roll')
 ok(page.evaluate('HistoricalBrowserPreview.roll(3)'),'same committed die can be retried after Undo')
 ok(page.locator('[data-retreat-route]').count()>=2,'arrows return after reroll')
 ok(not errors,'no Chromium JS exceptions '+repr(errors))
 # Mobile tap / arrow via same shared SVG: no overlay obstructing standard map controls.
 mobile=browser.new_page(viewport={'width':768,'height':910},has_touch=True,is_mobile=True)
 errs=[];mobile.on('pageerror',lambda e:errs.append(str(e)))
 mobile.set_content(ns['html'],wait_until='load',timeout=60000)
 mobile.wait_for_function('!!window.HistoricalBrowserPreview',timeout=35000)
 for act in [
  {'type':'combat','action':{'type':'finish-air-sea'}},
  {'type':'combat','action':{'type':'commit-battles','battles':[{'defenderHex':'0205','attackers':['kiev-front-r01c01','kiev-front-r01c03']}]}},
  {'type':'combat','action':{'type':'select-battle','defenderHex':'0205'}},
  {'type':'combat','action':{'type':'commit-ground-air','faceId':'kiev-front-r03c01'}}
 ]: ok(mobile.evaluate('(v)=>HistoricalBrowserPreview.choose(v)',act),'mobile legal action')
 ok(mobile.evaluate('HistoricalBrowserPreview.roll(3)'),'mobile committed combat die')
 ok(mobile.locator('[data-retreat-route]').count()>=2,'touch route exists')
 ok(not mobile.locator('#support-window-body').is_visible(),'touch retreat starts with Support dock collapsed for map space')
 mobile.locator('[data-retreat-route]').first.scroll_into_view_if_needed()
 mobile.locator('[data-retreat-route]').first.tap()
 ok(mobile.evaluate('HistoricalBrowserPreview.retreatSelection()')=='retreat-0','touch picks an arrow')
 ok(mobile.evaluate('HistoricalBrowserPreview.snapshot().state.units["kiev-front-r03c04"].hex')=='0205','touch preview no movement')
 ok(not errs,'no tablet JS exceptions')
 mobile.wait_for_timeout(4400) # Real first-tap map help auto-expires.
 mobile.screenshot(path=str(ROOT/'rules/audit/visual/odessa-retreat-arrows-tablet-v538.png'),full_page=False)
 browser.close()
print('PASS v538 shared original Support art + engine retreat arrows:',checks,'Chromium assertions')
