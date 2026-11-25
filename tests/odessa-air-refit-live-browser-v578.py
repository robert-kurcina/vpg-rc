#!/usr/bin/env python3
"""Live four-turn air/Fleet/REFIT campaign from the shipped opening, with a restored ground-support exclusion branch. No synthetic state."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,json,re
ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev-odessa/experimental-preview/index.html'
CONF=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(CONF)}
for k,v in CONF.items():
 if k in {'map','counterConfig','profile','phaseConfig','combatPolicy','rosterOverlay','opening','setupPolicy','firstTurnEmptyBuildupPolicy','buildupPolicy','buildupAllocation','housekeepingPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev-odessa.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
checks=0
def ok(value,label):
 global checks
 assert value,label
 checks+=1
plan={2:[('t2-slovak','0101','kiev-front-r02c07'),('t2-hungarian','0201','kiev-front-r04c08')],
      3:[('t3-german-infantry','0102','kiev-front-r02c06'),('t3-italian-motorized','0102','kiev-front-r04c01')],
      5:[('t5-soviet-army','1601','kiev-front-r04c05')],6:[('t6-soviet-army','1701','kiev-front-r04c06')]}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load',timeout=60000)
 api='window.HistoricalBrowserPreview'
 page.wait_for_function('window.HistoricalBrowserPreview && window.HistoricalBrowserPreview.snapshot().phaseId === "german-combat"',timeout=30000)
 snap=lambda:page.evaluate(api+'.snapshot()')
 view=lambda:page.evaluate(api+'.view()')
 def choose(action):
  result=page.evaluate('(a)=>'+api+'.choose(a)',action)
  ok(result,'Rejected action '+str(action)+'; '+page.locator('#message').inner_text())
  return snap()
 romanian='odessa-front-r01c07'; fk4='kiev-front-r03c01'; fk5='kiev-front-r03c02'
 def combat(t,**kw):return choose({'type':'combat','action':{'type':t,**kw}})
 def marker(face):return page.locator('[data-support-face="'+face+'"]')
 def status(face,want):ok(marker(face).get_attribute('data-support-status')==want,face+' '+want)
 def fleet(want):ok(page.locator('[data-support-fleet]').get_attribute('data-fleet-status')==want,'Fleet '+want)
 def strike(face,die):
  combat('declare-fleet-attack',faceId=face)
  pending=snap();ok(pending['combat']['pendingSeaFaceId']==face,'committed face')
  saved=page.evaluate(api+'.save()');ok(page.evaluate('(s)=>'+api+'.restore(s)',saved),'restore pending');ok(snap()==pending,'exact pending')
  ok(page.evaluate('(d)=>HistoricalBrowserPreview.roll(d)',die),'roll')
  ok(snap()['state']['airUse'][str(snap()['cursor']['turn'])][face]=='fleet','shared ledger')
  status(face,'committed')
  resolved=snap();ok(page.evaluate(api+'.undo()'),'undo strike');ok(snap()==pending,'undo exact')
  ok(page.evaluate('(d)=>HistoricalBrowserPreview.roll(d)',die),'replay strike');ok(snap()==resolved,'exact replay')
 status(romanian,'not-arrived');fleet('undamaged')
 for i in range(90):
  s=snap();t=s['cursor']['turn'];phase=s['phaseId'];kind=s['phaseKind']
  if phase=='german-combat':
   print('Air campaign turn',t,flush=True)
   if t==2:
    status(romanian,'available');strike(romanian,1);fleet('damaged')
    ok(not any(a.get('action',{}).get('faceId')==romanian for a in view()['commands']),'no repeated strike')
    branch=snap();save=page.evaluate(api+'.save()');combat('finish-air-sea')
    battle=next(x for x in view()['proposals'] if x['defenderHex']=='0205' and x['attackers']==['kiev-front-r01c01','kiev-front-r01c03'])
    combat('commit-battles',battles=[battle]);combat('select-battle',defenderHex='0205')
    airChoices=[a['action'].get('faceId') for a in view()['commands'] if a.get('action',{}).get('type')=='commit-ground-air']
    ok(romanian not in airChoices and fk4 in airChoices and fk5 in airChoices,'Fleet commitment excludes ground support, other markers remain legal')
    ok(page.evaluate('(s)=>'+api+'.restore(s)',save),'restore alternate branch');ok(snap()==branch,'exact branch restore')
   if t==3:
    status(romanian,'refit');fleet('damaged');strike(fk4,6);fleet('damaged')
   if t==4:
    status(romanian,'available');strike(romanian,1);fleet('eliminated')
    ok('blackSeaFleet' not in snap()['state']['supportMarkers'],'removed fleet')
    ok(not any(a.get('action',{}).get('type')=='declare-fleet-attack' for a in view()['commands']),'no strikes after elimination')
    saved=page.evaluate(api+'.save()');old=snap();ok(page.evaluate('(s)=>'+api+'.restore(s)',saved),'restore eliminated');ok(snap()==old,'exact eliminated restore')
    break
  if kind=='combat':
   if snap()['combat']['status']=='air-sea-open':combat('finish-air-sea')
   combat('commit-battles',battles=[]);combat('finish-combat')
  elif kind=='buildup':choose({'type':'finish-buildup'})
  elif kind=='housekeeping':choose({'type':'finish-housekeeping'})
  else:choose({'type':'finish-phase'})
 else:raise AssertionError('turn 4 not reached')
 ok(not errors,str(errors));print('PASS v578 live air fleet refit browser:',checks,'assertions',flush=True)
 browser.close()
