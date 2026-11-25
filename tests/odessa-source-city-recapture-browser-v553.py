#!/usr/bin/env python3
"""Checkpoint 317: real Kiev–Odessa Chromium Orders/retreat arrows and two-sided
Kovel conquest, with shared historical game rules and engine map render.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
# Reuse the tested offline loader. It embeds the real page, CSS, JS, config and
# original shared-engine PNG export, not mock counters or invented map artwork.
ns={'__file__':str(ROOT/'tests/odessa-mixed-seam-city-seven-turn-browser-v549.py')}
source=Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0]
exec(source,ns)
checks=0
def ok(value,reason):
 global checks
 assert value,reason
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True, executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1340,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(ns['html'],wait_until='load',timeout=60000)
 api='window.HistoricalBrowserPreview'
 page.wait_for_function(api+' && '+api+'.snapshot().phaseId === "german-combat"',timeout=35000)
 snap=lambda:page.evaluate(api+'.snapshot()')
 view=lambda:page.evaluate(api+'.view()')
 def choose(action):
  ok(page.evaluate('(x)=>HistoricalBrowserPreview.choose(x)',action),str(action)+' rejected: '+page.locator('#message').inner_text())
  return snap()
 ok(page.locator('#map-art').evaluate('(e)=>e.complete&&e.naturalWidth>0'),'Approved source-rendered game-engine map decoded')
 ok(page.locator('#counter-overlay .official-counter').count()==36,'All 36 original game-engine starting counters rendered')
 ok(page.locator('#game-support-window .support-counter-svg').count()==4,'Original SVG Support/Fleet counters shown')
 choose({'type':'combat','action':{'type':'finish-air-sea'}})
 proposal={'defenderHex':'0502','attackers':['kiev-front-r02c03']}
 ok(proposal in view()['proposals'],'The recovered source city is offered as original combat declaration')
 choose({'type':'combat','action':{'type':'commit-battles','battles':[proposal]}})
 choose({'type':'combat','action':{'type':'select-battle','defenderHex':'0502'}})
 choose({'type':'combat','action':{'type':'commit-ground-air','faceId':None}})
 page.locator('#die').select_option('2')
 page.locator('#submit-die').click()
 ok(view()['crtOutcome']=='EX','German source battle committed the B4M EX die through visible roll control')
 ok(page.locator('#actions button').count()==2,'Two legal Exchange consequences rendered as Orders')
 before=snap()
 page.locator('#actions button').filter(has_text='Advance:').click()
 ok(snap()['state']['units']['kiev-front-r02c03']['hex']=='0502','DOM Orders advance enters Kovel after EX')
 ok('kiev-front-r05c02' not in snap()['state']['units'],'Untried one-step defender eliminated')
 ok(snap()['state']['cityControl']['Kovel']=='soviet','City change deferred until combat phase close')
 ok(page.locator('#counter-overlay [data-unit-id="kiev-front-r02c03"]').count()==1,'Reduced original German unit visible on board')
 ok(page.locator('#counter-overlay [data-unit-id="kiev-front-r02c03"] [data-role="status_reduced"]').count()>0,'Actual SVG damage template retains status indicator')
 page.locator('#actions button').filter(has_text='finish combat').click()
 ok(snap()['state']['cityControl']['Kovel']=='german','German combat phase-close awards Kovel')
 ok('Kovel' in page.locator('#message').inner_text(),'Game UI announces Kovel capture')
 visuals=ROOT/'rules/audit/visual';visuals.mkdir(parents=True,exist_ok=True)
 page.screenshot(path=str(visuals/'odessa-kovel-capture-browser-v553.png'),full_page=False)
 for phase in ['german-special-movement','soviet-buildup','soviet-special-movement']:
  ok(snap()['phaseId']==phase,'source phase '+phase)
  choose({'type':'finish-buildup'} if phase=='soviet-buildup' else {'type':'finish-phase'})
 ok(snap()['phaseId']=='soviet-combat','Soviet counterattack phase reached')
 choose({'type':'combat','action':{'type':'commit-battles','battles':[{'defenderHex':'0502','attackers':['kiev-front-r03c05']}]}})
 choose({'type':'combat','action':{'type':'select-battle','defenderHex':'0502'}})
 page.locator('#die').select_option('1')
 page.locator('#submit-die').click()
 ok(view()['crtOutcome']=='DR','Genuine Soviet counterattack generates defender retreat')
 routes=page.evaluate(api+'.retreatMap()')
 ok(routes['active'] and len(routes['routes'])>=1,'Validated on-map retreat arrows shown')
 ok(page.locator('#counter-overlay .retreat-arrow-base').count()>=2,'Approved double-blue outer arrow stems present')
 ok(page.locator('#counter-overlay .retreat-arrow-inner').count()>=2,'Approved light-blue inner strokes present')
 # All arrow geometry uses the same light-blue source color; no dark outline.
 uniform=page.evaluate('''() => {
  const base=[...document.querySelectorAll('#counter-overlay .retreat-arrow-base')];
  const inner=[...document.querySelectorAll('#counter-overlay .retreat-arrow-inner')];
  const head=document.querySelector('#counter-overlay #retreat-arrow-head path');
  return base.length>=2 && inner.length>=2 &&
   [...base,...inner].every(el=>getComputedStyle(el).stroke==='rgb(114, 201, 255)') &&
   head?.getAttribute('fill')==='#72c9ff' && head?.getAttribute('stroke')==='none';
}''')
 ok(uniform,'Entire block arrow uses solid light blue #72c9ff')
 chosen=None
 for route in routes['routes']:
  if route['routes'][0]['hexes']==['0502','0601','0701'] and any(opt['action']['choices'].get('advanceUnitId')=='kiev-front-r03c05' for opt in route['options']):
   chosen=route['id'];break
 ok(chosen is not None,'Source-validated German retreat 0502→0601→0701 discovered')
 page.locator('[data-retreat-route="'+chosen+'"]').nth(1).click(force=True)
 ok(page.evaluate(api+'.retreatSelection()')==chosen,'Real map arrow click stages exact route')
 ok(snap()['state']['units']['kiev-front-r02c03']['hex']=='0502','Staging does not prematurely move German counter')
 page.screenshot(path=str(visuals/'odessa-kovel-soviet-retreat-arrows-v553.png'),full_page=False)
 saved=page.evaluate(api+'.save()')
 ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',saved),'Pending Soviet combat Save/Restore succeeds')
 ok(snap()['state']['cityControl']['Kovel']=='german','Pending retreat restores source city owner')
 page.locator('[data-retreat-route="'+chosen+'"]').nth(1).click(force=True)
 page.locator('#actions button[data-retreat-confirm="true"]').filter(has_text='Advance:').first.click()
 ok(snap()['state']['units']['kiev-front-r02c03']['hex']=='0701','Selected German retreat reaches second source hex')
 ok(snap()['state']['units']['kiev-front-r03c05']['hex']=='0502','Soviet counterattacker advances into vacated city')
 ok(snap()['state']['cityControl']['Kovel']=='german','City authority awaits phase close')
 page.locator('#actions button').filter(has_text='finish combat').click()
 ok(snap()['state']['cityControl']['Kovel']=='soviet','Kovel recaptured at Soviet combat phase close')
 ok('Kovel' in page.locator('#message').inner_text(),'UI reports the Soviet city recapture')
 page.screenshot(path=str(visuals/'odessa-kovel-recapture-browser-v553.png'),full_page=False)
 final=snap();now=page.evaluate(api+'.save()')
 import json
 savepath=ROOT/'rules/audit/saves/odessa-kovel-recapture-browser-v553.json'
 savepath.parent.mkdir(parents=True,exist_ok=True)
 savepath.write_text(json.dumps(now,indent=2)+'\n')
 ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',now),'Recaptured-game Save/Restore succeeds')
 ok(snap()==final,'Full recaptured-game snapshot exactly restored')
 ok(page.evaluate(api+'.undo()'),'UI Undo available after restore')
 ok(snap()['state']['cityControl']['Kovel']=='german','Undo restores pre-finish German city control')
 ok(not errors,'No Chromium JS exceptions '+str(errors))
 print('PASS v553 Kovel original engine Chromium capture/recapture:',checks,'assertions',flush=True)
 browser.close()
