#!/usr/bin/env python3
"""v576: One uninterrupted real Chromium campaign with naval evacuation and return; combines source-mixed Soviet
mechanized units, selected original German infantry, original EX combat, three
source-approved cross-seam Romanian cavalry moves, Chisinau control transfer,
all scheduled reinforcements and terminal journal replay. No synthetic actions."""
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
 # Source-constrained Turn 1 via the actual deployment controls, not synthetic game state.
 page.evaluate(api+'.enterSetup()')
 ok(page.locator('#setup-infantry-reserve').is_visible(),'player source-face selector visible')
 page.locator('#setup-infantry-reserve').select_option('kiev-front-r02c06')
 page.locator('#setup-mix').click()
 mixed=page.evaluate(api+'.setupView()')
 ok(mixed['concealedMixed'],'10 original Mechanized identities mixed through visible control')
 ok(mixed['infantryFaceSelection']['reserveFaceId']=='kiev-front-r02c06','49 Mountain assigned to Turn 3 reserve')
 ok(len(set(mixed['identityAssignments'].values()))==10,'ten unique original concealed Soviet identities retained')
 ok(page.locator('#counter-overlay .official-counter').count()==36,'customized original counter art renders')
 page.locator('#setup-ready').click()
 ok(page.locator('#setup-panel').is_hidden(),'player started actual source-customized campaign')
 ok('kiev-front-r01c07' in snap()['state']['units'],'original 29 joins starting roster')
 ok('kiev-front-r02c06' not in snap()['state']['units'],'49 Mtn held off-map until Turn 3')
 ok(page.locator('#counter-overlay [data-unit-id]').count()==36,'36 original source counters projected')
 ok(page.locator('#map-art').get_attribute('src').startswith('data:image/png'),'Actual engine map export projected')
 choose({'type':'combat','action':{'type':'finish-air-sea'}})
 battle=next((x for x in view()['proposals'] if x['defenderHex']=='0205' and x['attackers']==['kiev-front-r01c01','kiev-front-r01c03']),None)
 ok(battle,'Authoritative original Kiev battle exposed to real browser')
 choose({'type':'combat','action':{'type':'commit-battles','battles':[battle]}})
 choose({'type':'combat','action':{'type':'select-battle','defenderHex':'0205'}})
 choose({'type':'combat','action':{'type':'commit-ground-air','faceId':'kiev-front-r03c01'}})
 ok(page.evaluate('()=>window.HistoricalBrowserPreview.roll(3)'),'Actual committed d6')
 ok(view()['crtOutcome']=='EX','B4M CRT EX')
 saved=page.evaluate(api+'.save()')
 ok(page.evaluate('(s)=>'+api+'.restore(s)',saved),'Pending post-roll Save/Restore')
 ok(view()['crtOutcome']=='EX','EX unchanged on Restore')
 choose(view()['options'][0])
 ok(snap()['state']['units']['kiev-front-r01c01']['strengthStatus']=='printed-reduced','Actual Panzer reduced after EX')
 print('Browser v576: Turn 1 Exchange committed',flush=True)
 turns=[];arrivals=[];domClicked=False
 movePlan={1:('german-special-movement',['1010','1011']),
           2:('german-movement',['1011','1112']),
           3:('german-movement',['1112','1211'])}
 cavalry='kiev-odessa/romanian-cavalry-corps'
 movements=[];cityCaptureVerified=False
 navalUnit="kiev-odessa/soviet-coastal-army"; evacuated=False; returned=False; navalTurns=[]
 for i in range(150):
  s=snap()
  if s['cursor']['complete']:break
  turn=s['cursor']['turn'];kind=s['phaseKind'];phase=s['phaseId'];actor=s['actor']
  if kind=='combat':
   status=s['combat']['status']
   if status=='air-sea-open':a={'type':'combat','action':{'type':'finish-air-sea'}}
   elif status=='awaiting-declarations':a={'type':'combat','action':{'type':'commit-battles','battles':[]}}
   elif status in ('battles-resolved','no-battles-declared','complete'):a={'type':'combat','action':{'type':'finish-combat'}}
   else:raise AssertionError('Unexpected combat state '+str((turn,phase,status)))
  elif phase=='soviet-naval-operations':
   navalTurns.append(turn)
   if turn==1:
    evac={'type':'declare-naval-ground-transport','unitId':navalUnit,'destination':{'kind':'off-map'}}
    ok(evac in view()['commands'],'Original coastal army evacuation offered')
    choose(evac)
    ok(page.evaluate('()=>HistoricalBrowserPreview.roll(1)'),'Naval damage check committed')
    ok(navalUnit not in snap()['state']['units'],'Evacuated unit removed')
    ok(snap()['state']['evacuatedNavalUnits'][navalUnit]['unit']['strengthStatus']=='printed-reduced','Survivor reduced')
    evacuated=True
   a={'type':'finish-phase'}
  elif kind=='buildup':
   if turn==2 and actor=='soviet':
    entry=next(x for x in view()['commands'] if x['type']=='place-evacuated-reinforcement' and x['unitId']==navalUnit and x['hex'] not in ('1601','1701'))
    choose(entry)
    ok(snap()['state']['units'][navalUnit]['strengthStatus']=='printed-reduced','Returned survivor remains reduced')
    ok(navalUnit not in snap()['state']['evacuatedNavalUnits'],'Reserve consumed')
    ok(page.locator('#counter-overlay [data-unit-id="'+navalUnit+'"]').count()==1,'One survivor counter')
    returned=True
   due=[(slot,hex,unit) for slot,hex,unit in plan.get(turn,[]) if ((slot.startswith('t2-') or slot.startswith('t3-'))==(actor=='german'))]
   for slot,hex,unit in due:
    action={'type':'place-reinforcement','slotId':slot,'hex':hex}
    if slot=='t3-german-infantry':
     button=page.locator('#actions button').filter(has_text='Place '+slot+' at '+hex).first
     ok(button.count()==1,'Actual human Turn 3 placement button shown')
     button.click(timeout=15000)
     ok(snap()['state']['units'][unit]['hex']==hex,'Original Turn 3 source counter placed via DOM click')
     domClicked=True
    else:choose(action)
    ok(snap()['state']['units'][unit]['hex']==hex,'Real counter entered '+slot)
    ok(page.locator('#counter-overlay [data-unit-id="'+unit+'"]').count()==1,'Source counter art rendered '+slot)
    arrivals.append((turn,slot,hex,unit))
    if slot in ('t3-italian-motorized','t6-soviet-army'):
     saved=page.evaluate(api+'.save()');old=snap()
     ok(page.evaluate('(s)=>'+api+'.restore(s)',saved),'Browser Save/Restore '+slot)
     ok(snap()==old,'Exact restored Turn '+str(turn)+' state')
     ok(page.evaluate(api+'.undo()'),'Browser Undo '+slot)
     ok(unit not in snap()['state']['units'],'Undo removes '+slot)
     choose(action)
   a={'type':'finish-buildup'}
  elif kind=='housekeeping':
   turns.append(turn);print('Browser v576: completed Turn',turn,', arrivals',len(arrivals),flush=True)
   a={'type':'finish-housekeeping'}
  else:
   if turn in movePlan and phase==movePlan[turn][0] and len(movements)==turn-1:
    path=movePlan[turn][1]
    ok(snap()['state']['units'][cavalry]['hex']==path[0],'Cavalry begins Turn '+str(turn)+' move at '+path[0])
    ok(snap()['state']['cityControl']['Chisinau']=='soviet','Chisinau remains Soviet before Turn '+str(turn)+' movement')
    cmd={'type':'declare-ground-move','request':{'unitId':cavalry,'path':path}}
    commands=view().get('commands',[])
    ok(any(a==cmd for a in commands),'Authority offers exact original cavalry route on Turn '+str(turn))
    if turn==1:
     before=snap()
     illegal={'type':'declare-ground-move','request':{'unitId':cavalry,'path':[path[0],'9999']}}
     ok(page.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',illegal) is False,'Forged off-map route rejected')
     ok(snap()==before,'Rejected movement does not mutate original campaign')
    if turn==3:
     # A real visible player Orders button, not a direct engine-only shortcut.
     label=' through '+' → '.join(path)
     page.locator('#filter').fill(' → '.join(path))
     matching=page.locator('#actions button').filter(has_text=label)
     ok(matching.count()==1,'Turn 3 Chisinau declaration appears once in the visible Orders')
     matching.click(timeout=15000)
     page.locator('#filter').fill('')
     ok(snap()['state']['units'][cavalry]['hex']==path[0],'Declaration does not teleport original cavalry')
     page.locator('#actions button').filter(has_text='resolve ground move').click(timeout=15000)
     ok(snap()['state']['units'][cavalry]['hex']==path[1],'Visible browser Orders resolve Chisinau capture')
    else:
     choose(cmd)
     ok(snap()['state']['units'][cavalry]['hex']==path[0],'Declaration is not premature movement')
     choose({'type':'resolve-ground-move'})
    after=snap()
    ok(after['state']['units'][cavalry]['hex']==path[1],'Source cavalry moved exactly '+ ' → '.join(path))
    expected='german' if turn==3 else 'soviet'
    ok(after['state']['cityControl']['Chisinau']==expected,'City changes control only on actual capture')
    notice=page.locator('#message').inner_text()
    if turn==3:
     ok('Chisinau: soviet → german' in notice,'Player receives committed Chisinau control-change notice')
     page.locator('[data-unit-id="'+cavalry+'"]').scroll_into_view_if_needed(timeout=10000)
     page.screenshot(path=str(ROOT/'rules/audit/visual/odessa-mixed-seam-chisinau-capture-v576.png'),full_page=False)
     savedCapture=page.evaluate(api+'.save()')
     ok(page.evaluate(api+'.undo()'),'Capture is Undo-able in the continuous browser campaign')
     ok(snap()['state']['cityControl']['Chisinau']=='soviet','Undo restores Soviet city control')
     ok(snap()['state']['units'][cavalry]['hex']==path[0],'Undo restores source cavalry to pre-capture hex')
     choose({'type':'resolve-ground-move'})
     ok(snap()==after,'Replaying capture after Undo yields identical committed game state')
     ok(page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',savedCapture),'Full post-capture Save/Restore replays')
     ok(snap()==after,'City/cavalry restored from authenticated journal')
     cityCaptureVerified=True
     print('Browser v576: Turn 3 Chisinau captured through visible Orders',flush=True)
    else:
     ok('City control changed' not in notice,'No false city capture notice')
    movements.append((turn,list(path)))
   a={'type':'finish-phase'}
  choose(a)
 else:raise AssertionError('Browser exceeded 150 phase actions')
 end=snap()
 ok(end['cursor']['complete'],'Actual seven-turn browser campaign completes')
 ok(turns==list(range(1,8)),'Every Turn 1-7 housekeeping reached')
 ok(evacuated and returned,'Naval lifecycle completed in continuous campaign')
 ok(navalTurns and navalTurns[0]==1,'Naval phase reached')
 ok(len(arrivals)==6,'Six scheduled later reinforcements admitted')
 ok(domClicked and cityCaptureVerified,'Real reinforcement and capture Orders both succeeded')
 ok(movements==[(1,['1010','1011']),(2,['1011','1112']),(3,['1112','1211'])],
    'Three source-bound cross-seam and expansion movements occurred in one continuous campaign')
 ok(end['state']['cityControl']['Chisinau']=='german','Captured city remains Axis-held through Turn 7')
 ok(end['state']['units'][cavalry]['hex']=='1211','Original Romanian cavalry remains at captured city')
 ok(len(end['state']['units'])==42,'36 original + six historical reinforcements')
 ok(end['state']['units']['kiev-front-r02c06']['sourceFaceId']=='kiev-front-r02c06','Turn 3 authentic 49 Mtn physical counter remains active')
 ok(end['state']['units']['kiev-front-r01c07']['sourceFaceId']=='kiev-front-r01c07','starting 29 authentic physical counter remains active')
 ok(len(set(x['sourceFaceId'] for x in end['state']['units'].values()))==42,'no duplicated source-ground physical identities')
 ok(bool(end['terminal']),'Real source terminal evaluation')
 saved=page.evaluate(api+'.save()')
 ok(page.evaluate('(s)=>'+api+'.restore(s)',saved),'Full browser journal replay')
 ok(snap()==end,'Full session snapshot identical after Restore')
 ok(page.evaluate(api+'.undo()'),'Undo terminal housekeeping')
 ok(not snap()['cursor']['complete'],'Undo returns to Turn 7')
 ok(not errors,'No browser JS errors '+str(errors))
 page.evaluate('(s)=>'+api+'.restore(s)',saved)
 visual=ROOT/'rules/audit/visual/odessa-mixed-selected-seven-turn-browser-v576.png'
 page.screenshot(path=str(visual),full_page=False)
 savepath=ROOT/'rules/audit/saves/odessa-mixed-selected-seven-turn-browser-v576.json'
 savepath.parent.mkdir(exist_ok=True,parents=True)
 savepath.write_text(json.dumps(saved,indent=2)+'\n')
 print('PASS v576 actual Chromium mixed+face-selected 7-turn campaign',checks,'assertions; screenshot',visual,flush=True)
 browser.close()
