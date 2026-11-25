#!/usr/bin/env python3
"""Chromium: real shared-engine Kiev map/counters, human controls and save/undo.

Local HTTP navigation is blocked in this test environment. This harness inlines
identical packaged engine scripts, CSS, JSON and exported PNG map art; it does
NOT substitute an alternate renderer or gameplay implementation. The normal
shipped page continues to load exports/kiev.svg by relative URL.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, re, base64

ROOT=Path(__file__).resolve().parents[1]
PAGE=ROOT/'games/kiev/setup-preview/index.html'
SCREENSHOT=ROOT/'rules/audit/visual/kiev-contested-terminal-browser-v487.png'
CONF=json.loads((PAGE.parent/'config.json').read_text())
assets={'config.json':dict(CONF)}
for k,v in CONF.items():
 if k in {'map','counterConfig','setup','profile','phaseConfig','combatPolicy','buildupPolicy','housekeepingPolicy','inventoryPolicy','fixedPolicy'}:
  assets[v]=json.loads((PAGE.parent/v).resolve().read_text())
assets[CONF['mapExport']]=(PAGE.parent/CONF['mapExport']).resolve().read_text()
# Browser screenshot uses exact existing shared-engine PNG export because SVG with
# nested data URIs cannot be loaded reliably as an about:blank data URI.
assets['config.json']['mapExport']='data:image/png;base64,'+base64.b64encode((ROOT/'exports/kiev.png').read_bytes()).decode()
html=PAGE.read_text()
html=re.sub(r'<link\s+rel="stylesheet"\s+href="([^"]+)">',
 lambda m:'<style>'+(PAGE.parent/m.group(1)).resolve().read_text()+'</style>',html)
html=re.sub(r'<script\s+src="([^"]+)"></script>',
 lambda m:'<script>\n'+(PAGE.parent/m.group(1)).resolve().read_text().replace('</script','<\\/script')+'\n</script>',html)
bootstrap='<script>window.__offlineAssets='+json.dumps(assets,ensure_ascii=True).replace('</script','<\\/script')+';'+\
'''window.fetch=async function(path){if(!Object.prototype.hasOwnProperty.call(window.__offlineAssets,path))return {ok:false,status:404};return {ok:true,status:200,json:async()=>window.__offlineAssets[path],text:async()=>window.__offlineAssets[path]};};</script>'''
html=html.replace('<body data-historical-config="config.json">','<body data-historical-config="config.json">'+bootstrap)
# Bounded full-campaign human-browser acceptance, in four independent Chromium
# runs joined by the *actual saved game envelope* and verified journal state.
import argparse
from time import perf_counter
from collections import Counter
import hashlib
parser=argparse.ArgumentParser()
parser.add_argument('--stage',type=int,required=True,choices=range(1,5))
args=parser.parse_args()
stage=args.stage
start_turn=(stage-1)*2+1
end_turn=min(start_turn+1,7)
ART=ROOT/'rules/audit'
ART.mkdir(exist_ok=True,parents=True)
IN=ART/f'kiev-contested-v487-stage{stage-1}-save.json'
OUT=ART/f'kiev-contested-v487-stage{stage}-save.json'
PROGRESS=ART/f'kiev-contested-v487-stage{stage}-evidence.json'
checks=0
activity=[]
combat_results=[]
replacement_results=[]
def ok(v,msg):
 global checks
 assert v,msg
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1280,'height':920})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 started=perf_counter()
 page.set_content(html,wait_until='load',timeout=60000)
 page.wait_for_function('window.HistoricalBrowserPreview&&window.HistoricalBrowserPreview.snapshot().phaseId==="german-combat"',timeout=60000)
 api='window.HistoricalBrowserPreview'
 get=lambda:page.evaluate(api+'.snapshot()')
 if stage>1:
  saved=json.loads(IN.read_text())
  ok(page.evaluate('(p)=>window.HistoricalBrowserPreview.restore(p)',saved),'stage boundary save restores in independent Chromium')
  ok(get()['cursor']['turn']==start_turn,'stage restores correct turn')
 else:
  ok(get()['cursor']['turn']==1,'initial German combat Turn 1')
  ok(len(get()['state']['units'])==30,'30 original source-legal example counters')
 initial=get()
 for turn in range(start_turn,end_turn+1):
  before=get()
  ok(before['cursor']['turn']==turn,'expected turn '+str(turn))
  turn_actions=[]
  moved_once=False
  # The same legal human command API used for the rest of the campaign.
  def human(cmd, label):
   before=get()
   ok(page.evaluate('(a)=>window.HistoricalBrowserPreview.choose(a)',cmd),label)
   turn_actions.append({'phase':before['phaseId'],'kind':before['phaseKind'],
     'type':cmd.get('type'), 'nested':(cmd.get('action') or {}).get('type')})
  def battle(defender, attackers, air_id, die, loss_id, expected):
   view=page.evaluate(api+'.view()')
   plan=next((x for x in view.get('proposals',[])
              if x.get('defenderHex')==defender and x.get('attackers')==attackers),None)
   ok(plan is not None, 'legal declared attack '+defender)
   human({'type':'combat','action':{'type':'commit-battles','battles':[plan]}},
         'commit legal contested attack '+defender)
   command=next((x for x in page.evaluate(api+'.view()').get('commands',[])
                 if (x.get('action') or {}).get('type')=='select-battle'),None)
   ok(command is not None,'legal select-battle')
   human(command,'select combat '+defender)
   if air_id:
    command=next((x for x in page.evaluate(api+'.view()').get('commands',[])
                  if (x.get('action') or {}).get('type')=='commit-ground-air'
                  and (x.get('action') or {}).get('faceId')==air_id),None)
    ok(command is not None,'available authentic FK air support')
    human(command,'commit German air support')
   view=page.evaluate(api+'.view()')
   ok(page.evaluate('(x)=>window.HistoricalBrowserPreview.roll(x)',die),
      'human-gateway post-commit roll '+str(die))
   turn_actions.append({'phase':get()['phaseId'],'kind':'combat','type':'roll', 'die':die})
   view=page.evaluate(api+'.view()')
   ok(view.get('crtOutcome')==expected,'source CRT result '+expected)
   opts=view.get('options',[])
   ok(bool(opts),'human-gateway post-roll options')
   def reduces(x):
    choices=(x.get('action') or {}).get('choices') or {}
    if expected=='EX': return 'kiev-front-r01c01' in choices.get('attackerLossIds',[])
    if expected=='AL': return choices.get('lossUnitId')==loss_id
    return True
   selected=next((x for x in opts if reduces(x)),None)
   ok(selected is not None,'desired original source unit loss is legal')
   human(selected,'resolve source CRT consequence')
   state=get()
   if expected=='EX':
    ok(state['state']['units']['kiev-front-r01c01']['strengthStatus']=='printed-reduced',
       'German exchange reduction persists')
    ok(state['state']['units']['kiev-front-r03c04']['hex']=='0405',
       'retreat path resolved on actual Kiev graph')
    ok(state['state']['airUse']['1'].get('kiev-front-r03c01')=='ground',
       'original German air marker committed and spent')
   if expected=='AL':
    ok(loss_id not in state['state']['units'], 'Soviet original corps eliminated')
    ok(loss_id in state['state']['buildupDeployedIds'],
       'eliminated corps remains replacement-eligible in original unit ledger')
   combat_results.append({'turn':turn,'actor':('german' if defender=='0205' else 'soviet'),
     'defenderHex':defender,'outcome':expected,'die':die,'airId':air_id,
     'choices':selected})
  contested_done=set()
  for i in range(28):
   current=get()
   if turn==1 and current['phaseId']=='german-combat' and 'german' not in contested_done:
    battle('0205',['kiev-front-r01c01','kiev-front-r01c03'],
           'kiev-front-r03c01',3,'kiev-front-r01c01','EX')
    contested_done.add('german')
    print('actual German combat completed',flush=True)
    continue
   if turn==1 and current['phaseId']=='soviet-combat' and 'soviet' not in contested_done:
    battle('0204',['kiev-front-r04c02','kiev-front-r04c03'],
           None,6,'kiev-front-r04c03','AL')
    contested_done.add('soviet')
    print('actual Soviet counterattack completed',flush=True)
    continue
   if current['phaseKind']=='buildup' and ((turn==2 and current['actor']=='soviet') or
                                        (turn==4 and current['actor']=='german')):
    targets=(['kiev-front-r03c04','kiev-front-r04c03'] if turn==2 else ['kiev-front-r01c01'])
    done={x['unitId'] for x in replacement_results if x['turn']==turn}
    pending=[x for x in targets if x not in done]
    if pending:
     cmds=page.evaluate(api+'.view()').get('commands',[])
     target=pending[0]
     command=next((x for x in cmds if x.get('type')=='apply-replacement'
                    and x.get('unitId')==target),None)
     ok(command is not None,'historical replacement offered for '+target)
     human(command,'apply real replacement '+target)
     status=get()['state']['units'][target]['strengthStatus']
     ok(status==('revealed-one-step' if target=='kiev-front-r04c03' else 'printed-full'),
        'replacement preserves original face and legal strength status')
     replacement_results.append({'turn':turn,'unitId':target,'hex':command.get('hex')})
     print('replacement',turn,target,flush=True)
     continue
   item=page.evaluate('''(movedOnce) => {
    const api=window.HistoricalBrowserPreview,s=api.snapshot(),v=api.view(),cmds=v.commands||[];
    const find=(fn)=>cmds.find(fn);
    const allowReinforcement=[3,5,6].includes(s.cursor.turn);
    const allowMove=s.cursor.turn===3 && s.phaseId==='german-movement'&&!movedOnce;
    const move=allowMove?find(c=>c.type==='declare-ground-move'):null;
    const action=find(c=>c.type==='resolve-ground-move')||move||
      (allowReinforcement&&s.phaseKind==='buildup'?find(c=>c.type==='place-reinforcement'):null)||
      find(c=>c.action?.type==='commit-battles'&&c.action.battles.length===0)||
      find(c=>c.action?.type==='finish-combat')||
      find(c=>c.type==='finish-phase')||
      find(c=>c.type==='finish-buildup')||
      find(c=>c.type==='finish-housekeeping');
    return {phase:s.phaseId,kind:s.phaseKind,turn:s.cursor.turn,complete:s.cursor.complete,
      action:action||null,commands:action?null:cmds.slice(0,10).map(c=>({type:c.type,detail:c.action?.type}))};
   }''',moved_once)
   if item['turn']!=turn or item['complete']:
    break
   ok(item['action'] is not None,'legal human phase action '+str(item))
   result=page.evaluate('(a)=>window.HistoricalBrowserPreview.choose(a)',item['action'])
   ok(result,'human gateway accepts action '+str(item['phase']))
   turn_actions.append({'phase':item['phase'],'kind':item['kind'],'type':item['action'].get('type'),'nested':(item['action'].get('action') or {}).get('type')})
   if item['action'].get('type')=='declare-ground-move': moved_once=True
  after=get()
  ok(after['cursor']['turn']==turn+1 or after['cursor']['complete'],'Turn '+str(turn)+' completed')
  ok(len(turn_actions)>=5,'multiple verified human decisions')
  if turn==3:
   ok(any(x['type']=='declare-ground-move' for x in turn_actions),'source-legal German ground move declared')
   ok(any(x['type']=='resolve-ground-move' for x in turn_actions),'German ground move resolved and persisted')
  if turn in (3,5,6):
   ok(any(x['type']=='place-reinforcement' for x in turn_actions),'source-scheduled reinforcement entered on turn '+str(turn))
  activity.append({'turn':turn,'actions':turn_actions,'endTurn':after['cursor']['turn'],'complete':after['cursor']['complete'],'actionCount':after['actionCount']})
  print('stage',stage,'Turn',turn,'actions',len(turn_actions),'elapsed',round(perf_counter()-started,1),'next',after['cursor']['turn'],'complete',after['cursor']['complete'],flush=True)
 after=get()
 ok(not errors,'no browser JS errors '+str(errors))
 if stage==4:
  ok(after['cursor']['complete'],'terminal after Turn 7')
  ok(activity[-1]['turn']==7,'final stage includes Turn 7')
  ok(any(x['phase']=='housekeeping' for x in activity[-1]['actions']),'final housekeeping occurred')
  ok(after['terminal']['outcome']=='soviet-victory','official terminal adjudication: Soviet victory')
  ok(after['terminal']['totalCities']==16,'terminal city ledger covers all 16 victory cities')
  screenshot=ROOT/'rules/audit/visual/kiev-contested-terminal-browser-v487.png'
  screenshot.parent.mkdir(parents=True,exist_ok=True)
  page.screenshot(path=str(screenshot),full_page=False)
 else:
  ok(not after['cursor']['complete'],'campaign continues between stages')
  ok(after['cursor']['turn']==end_turn+1,'correct next stage turn')
 payload=page.evaluate(api+'.save()')
 ok(page.evaluate('(p)=>window.HistoricalBrowserPreview.restore(p)',payload),'round-trip journal restore')
 ok(get()==after,'round-trip preserves exact snapshot')
 OUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
 PROGRESS.write_text(json.dumps({'stage':stage,'range':[start_turn,end_turn],'checks':checks,
  'inputHash':hashlib.sha256(IN.read_bytes()).hexdigest() if stage>1 else None,
  'outputHash':hashlib.sha256(OUT.read_bytes()).hexdigest(),
  'beforeActionCount':initial['actionCount'],'afterActionCount':after['actionCount'],
  'complete':after['cursor']['complete'],'terminal':after.get('terminal'),
  'turns':activity,'combats':combat_results,'replacements':replacement_results,'errors':errors},indent=2,default=str)+'\n')
 browser.close()
 print('PASS contested staged Kiev browser',stage,checks,'checks','actionCount',after['actionCount'],flush=True)
