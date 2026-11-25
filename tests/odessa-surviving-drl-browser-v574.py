#!/usr/bin/env python3
"""Real browser UI, synthetic Turn 2 fixture. Only test harness origin is injected."""
from pathlib import Path
import json, subprocess
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-contested-seven-turn-browser-v537.py')}
exec(Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0],ns)
fixture=(ROOT/'tests/odessa-surviving-drl-controller-v573.test.js').read_text().split('let n=0,branches=0;')[0]
origin=json.loads(subprocess.check_output(['node','-e',fixture+'\nconsole.log(JSON.stringify({state,cursor:{...opening.cursor,turn:2}}));'],cwd=ROOT/'tests'))
html=ns['html']; needle='const nextContext={...clone(candidateOpening),...sourceData.contextSettings};'
assert html.count(needle)==1
html=html.replace(needle,'const nextContext={...clone(candidateOpening),...sourceData.contextSettings,...clone(window.__drlOrigin)};')
needle='root.HistoricalBrowserPreview=Object.freeze({'
assert html.count(needle)==1
html=html.replace(needle,'window.__drlOrigin='+json.dumps(origin)+'; window.__startDRL=(variant)=>{crtPreference=variant;context=withCRT({...clone(candidateOpening),...sourceData.contextSettings,...clone(window.__drlOrigin)},variant);human=E.Human.create({session:E.Campaign.create(context),context});customGame=false;setupActive=false;retreatSelection=null;postRollPage=0;refresh();};\n'+needle)
checks=0
def ok(v,msg):
 global checks
 assert v,msg
 checks+=1
D='kiev-front-r03c04'; A=['kiev-front-r01c01','kiev-front-r01c02','kiev-front-r01c03']
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1600,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=35000)
 snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
 view=lambda:page.evaluate('HistoricalBrowserPreview.view()')
 for variant,die in [('standard',4),('advanced',2)]:
  page.evaluate('(v)=>__startDRL(v)',variant)
  ok(snap()['cursor']['turn']==2,'Synthetic Turn 2')
  ok(page.locator('#counter-overlay [data-unit-id]').count()==4,'Four original ground counters')
  for a in [{'type':'finish-air-sea'},{'type':'commit-battles','battles':[{'defenderHex':'0605','attackers':A}]},{'type':'select-battle','defenderHex':'0605'},{'type':'commit-ground-air','faceId':None}]:
   ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose({type:"combat",action:a})',a),str(a))
  ok(page.evaluate('(d)=>HistoricalBrowserPreview.roll(d)',die),'Committed DRL die')
  ok(view()['crtOutcome']=='DRL','DRL result');ok(len(view()['options'])==12,'12 validated options')
  before=snap(); saved=page.evaluate('HistoricalBrowserPreview.save()')
  ok(not page.evaluate('(d)=>HistoricalBrowserPreview.roll(d)',die),'Reject reroll');ok(snap()==before,'Reroll rejection atomic')
  ok(page.evaluate('HistoricalBrowserPreview.retreatMap().active'),'Retreat map active')
  ok(page.locator('[data-retreat-route]').count()>=3,'Clickable arrows rendered');ok(page.locator('[data-retreat-target]').count()==3,'Three legal destinations')
  page.locator('[data-retreat-route]').first.focus();page.keyboard.press('Enter')
  ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()') is not None,'Keyboard stages route');ok(snap()==before,'Preview non-mutating')
  page.keyboard.press('Escape');ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()') is None,'Keyboard cancels route')
  ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',saved),'Pending die restore: '+page.locator('#message').inner_text());ok(snap()==before,'Pending restore exact')
  for destination in ['0707','0805','0806']:
   page.locator('[data-retreat-target="'+destination+'"]').click(force=True)
   ok(page.evaluate('HistoricalBrowserPreview.retreatSelection()') is not None,'Destination staged');ok(snap()==before,'Stage remains read only')
   ok(page.locator('[data-retreat-confirm]').count()==4,'Four advance alternatives')
   if destination=='0707':page.screenshot(path=str(ROOT/'rules/audit/visual'/('odessa-drl-'+variant+'-v574.png')))
   page.locator('[data-retreat-confirm]').first.click()
   after=snap();ok(after['state']['units'][D]['hex']==destination,'Retreated to selected hex');ok(after['state']['units'][D]['strengthStatus']=='printed-reduced','Mandatory reduction')
   ok(page.locator('[data-retreat-route]').count()==0,'Overlay cleared')
   committed=page.evaluate('HistoricalBrowserPreview.save()');ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',committed),'Committed save replay');ok(snap()==after,'Exact committed restore')
   ok(page.evaluate('HistoricalBrowserPreview.undo()'),'Undo');ok(snap()==before,'Exact state after undo');ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',saved),'Restore pending original die')
  print('PASS',variant,checks,'cumulative assertions',flush=True)
 ok(not errors,'No JS exceptions '+repr(errors));browser.close()
print('PASS v574 browser DRL',checks,'assertions')
