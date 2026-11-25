#!/usr/bin/env python3
"""Actual shared browser Orders, original source opening, naval evacuation/return."""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-mixed-seam-city-seven-turn-browser-v549.py')}
exec(Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0],ns)
n=0
def ok(x,m):
 global n
 assert x,m
 n+=1
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 p=b.new_page(viewport={'width':1280,'height':900});errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content(ns['html'],wait_until='load',timeout=60000)
 api='HistoricalBrowserPreview';p.wait_for_function(api+' && '+api+'.snapshot().phaseId === "german-combat"',timeout=35000)
 snap=lambda:p.evaluate(api+'.snapshot()');view=lambda:p.evaluate(api+'.view()');save=lambda:p.evaluate(api+'.save()')
 def choose(a):ok(p.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',a),str(a)+' '+p.locator('#message').inner_text())
 def click_action(a):
  v=view();i=v['commands'].index(a);btn=p.locator('#actions [data-action-index="'+str(i)+'"]');ok(btn.count()==1,'visible action '+str(a));btn.click(timeout=15000)
 def restore(s):ok(p.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',s),'restore')
 finish={'type':'finish-phase'}
 for a in [{'type':'combat','action':{'type':'finish-air-sea'}},{'type':'combat','action':{'type':'commit-battles','battles':[]}},{'type':'combat','action':{'type':'finish-combat'}},finish,{'type':'finish-buildup'}]:choose(a)
 ok(snap()['phaseId']=='soviet-special-movement','preceding phase');ok(not any(a['type'].startswith('declare-naval') or a['type']=='declare-fleet-move' for a in view()['commands']),'no voluntary naval actions in land phase')
 choose(finish);ok(snap()['phaseId']=='soviet-naval-operations','dedicated phase');ok('soviet-naval-operations' in p.locator('#status').inner_text(),'visible phase');ok(not any(a['type']=='declare-ground-move' for a in view()['commands']),'no ground movement')
 unit='kiev-odessa/soviet-coastal-army';a={'type':'declare-naval-ground-transport','unitId':unit,'destination':{'kind':'off-map'}}
 before=snap();click_action(a);pending=snap();ok(pending['pendingNavalGround']['unitId']==unit,'committed evac');ok(p.locator('#roll-panel').is_visible(),'damage die displayed');ok(not view()['commands'],'no competing choices');pending_save=save();restore(pending_save);ok(snap()==pending,'pending restore');ok(p.evaluate(api+'.undo()'),'undo commitment');ok(snap()==before,'undo returns exact prior state');click_action(a)
 p.locator('#die').select_option('1');p.locator('#submit-die').click();s=snap();ok(unit not in s['state']['units'],'unit removed');ok(s['state']['evacuatedNavalUnits'][unit]['unit']['strengthStatus']=='printed-reduced','source reduction');ok(s['state']['evacuatedNavalUnits'][unit]['firstReturnTurn']==2,'next turn');ok(p.locator('#counter-overlay [data-unit-id="'+unit+'"]').count()==0,'counter no longer on board');evsave=save();restore(evsave);ok(snap()==s,'postroll restore')
 for a in [finish,{'type':'combat','action':{'type':'commit-battles','battles':[]}},{'type':'combat','action':{'type':'finish-combat'}},finish,{'type':'finish-housekeeping'},{'type':'finish-buildup'},finish,{'type':'combat','action':{'type':'finish-air-sea'}},{'type':'combat','action':{'type':'commit-battles','battles':[]}},{'type':'combat','action':{'type':'finish-combat'}},finish]:choose(a)
 ok(snap()['phaseId']=='soviet-buildup' and snap()['cursor']['turn']==2,'next buildup reached');entry=next(a for a in view()['commands'] if a['type']=='place-evacuated-reinforcement' and a['unitId']==unit);ok(not any(a['type']=='apply-replacement' and a['unitId']==unit for a in view()['commands']),'no replacement duplicate');
 # Filter Orders to guarantee that the selected legal entry is visible.
 p.locator('#filter').fill(unit);click_action(entry);s=snap();ok(s['state']['units'][unit]['strengthStatus']=='printed-reduced','returned reduced');ok(unit not in s['state']['evacuatedNavalUnits'],'reserve consumed');ok(p.locator('#counter-overlay [data-unit-id="'+unit+'"]').count()==1,'one actual source counter');restore(save());ok(snap()==s,'return restore');ok(not errors,str(errors));b.close()
print('PASS v564 actual Chromium naval phase:',n,'assertions')
