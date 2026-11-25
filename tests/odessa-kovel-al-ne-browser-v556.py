#!/usr/bin/env python3
"""Real Chromium AL/NE Kovel consequences from the shared historical engine.
The screenshots are browser renders of original game-engine SVG counters and map.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
ns={'__file__':str(ROOT/'tests/odessa-mixed-seam-city-seven-turn-browser-v549.py')}
source=Path(ns['__file__']).read_text().split('with sync_playwright() as pw:')[0]
exec(source,ns)
checks=0
def ok(value,reason):
 global checks
 assert value,reason
 checks+=1
VIS=ROOT/'rules/audit/visual';VIS.mkdir(parents=True,exist_ok=True)
attacker='kiev-front-r02c03';defender='kiev-front-r05c02'
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 for die,label in [(6,'AL'),(4,'NE')]:
  page=browser.new_page(viewport={'width':1340,'height':1000},device_scale_factor=1)
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(ns['html'],wait_until='load',timeout=60000)
  api='window.HistoricalBrowserPreview'
  page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=35000)
  snap=lambda:page.evaluate(api+'.snapshot()')
  view=lambda:page.evaluate(api+'.view()')
  def choose(a):
   result=page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',a)
   ok(result,str(a)+' rejected: '+page.locator('#message').inner_text())
  ok(page.locator('#map-art').evaluate('(e)=>e.complete&&e.naturalWidth>0'),'Official source-rendered map decoded')
  ok(page.locator('#counter-overlay .official-counter').count()==36,'36 source-faced ground counters displayed')
  ok(page.locator('#game-support-window .support-counter-svg').count()==4,'Support artwork uses shared SVG renderer')
  choose({'type':'combat','action':{'type':'finish-air-sea'}})
  battle={'defenderHex':'0502','attackers':[attacker]}
  ok(battle in view()['proposals'],'Kovel original battle present in legal catalog')
  choose({'type':'combat','action':{'type':'commit-battles','battles':[battle]}})
  choose({'type':'combat','action':{'type':'select-battle','defenderHex':'0502'}})
  choose({'type':'combat','action':{'type':'commit-ground-air','faceId':None}})
  before=snap()
  page.locator('#die').select_option(str(die))
  page.locator('#submit-die').click()
  ok(view()['crtOutcome']==label,'Actual B4M combat outcome '+label)
  ok(len(view()['options'])==1,'One validated consequence')
  ok(len(view()['optionEffects'])==1,'One matching read-only consequence receipt')
  ok(view()['optionEffects'][0]['revealed']==[defender],'Source one-step defender will be revealed in combat')
  ok(page.locator('#actions button').count()==1,'One visible Orders action')
  labelText=page.locator('#actions button').first.inner_text()
  ok('Revealed: soviet mechanized at 0502' in labelText,'Orders visibly identify a face revelation without showing concealed combat strength')
  ok('(' + label + ')' in labelText,'Combat button names actual CRT outcome')
  if label=='AL':
   ok('Reduced:' in labelText,'AL accurately advertises a source counter reduction')
   ok('No additional losses' not in labelText,'AL does not falsely report no losses')
  else:
   ok('Reduced:' not in labelText and 'Eliminated:' not in labelText,'NE displays no invented loss')
  pending=page.evaluate(api+'.save()')
  ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',pending),'Pending result Save/Restore succeeds')
  ok(page.locator('#actions button').first.inner_text()==labelText,'Restored label is deterministic')
  page.screenshot(path=str(VIS/('odessa-kovel-'+label.lower()+'-orders-v556.png')),full_page=False)
  page.locator('#actions button').first.click()
  result=snap()
  ok(result['state']['units'][defender]['strengthStatus']=='revealed-one-step','Soviet unit is revealed without step loss')
  ok(result['state']['cityControl']['Kovel']=='soviet','Kovel remains Soviet-controlled')
  ok(page.locator('#counter-overlay [data-unit-id="'+defender+'"]').count()==1,'Revealed source Soviet counter renders on real board')
  if label=='AL':
   ok(result['state']['units'][attacker]['strengthStatus']=='printed-reduced','German 6–4 reduced by AL')
   ok(page.locator('#counter-overlay [data-unit-id="'+attacker+'"] [data-role="status_reduced"]').count()>0,'Actual SVG damage strip visible on German counter')
  else:
   ok(result['state']['units'][attacker]['strengthStatus']=='printed-full','German remains full after NE')
  page.screenshot(path=str(VIS/('odessa-kovel-'+label.lower()+'-resolved-v556.png')),full_page=False)
  saved=page.evaluate(api+'.save()')
  ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',saved),'Resolved choice Save/Restore succeeds')
  ok(snap()==result,'Authenticated restore preserves all state')
  ok(page.evaluate(api+'.undo()'),'Undo actual committed '+label)
  ok(snap()==before,'Undo returns to exact pre-roll selected battle')
  ok(not errors,'No browser exceptions '+repr(errors))
  page.close()
 browser.close()
print('PASS v556 real Kovel AL+NE browser results:',checks,'assertions')
