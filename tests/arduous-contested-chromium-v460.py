#!/usr/bin/env python3
"""Replay the 184-action source-valid contested Arduous campaign by clicking
real player controls in Chromium. The precomputed headless oracle is read-only;
every authoritative state transition must come from a visible UI interaction.
Stages are connected only by ordinary browser saves. No direct state writes.
"""
from __future__ import annotations
import argparse, importlib, json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
fixture=importlib.import_module('arduous-browser-v419')
parser=argparse.ArgumentParser()
parser.add_argument('--progress',type=Path,default=ROOT/'rules/audit/.arduous-contested-chromium-v460-progress.json')
parser.add_argument('--max-actions',type=int,default=30)
parser.add_argument('--max-seconds',type=float,default=160)
args=parser.parse_args()
golden=json.loads((ROOT/'rules/audit/arduous-contested-browser-oracle-v460.json').read_text())
T=golden['actions']
progress=json.loads(args.progress.read_text()) if args.progress.exists() else {'index':0,'checks':0,'checkpoints':[],'uiExtraRolls':0,'maxVisibleIndex':0}

def kind(a):return (a.get('action') or a).get('type')
def same(a,b):return a==b

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1536,'height':1024},accept_downloads=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture.html_for('arduous'),wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 api='HistoricalBrowserPreview'
 snapshot=lambda:page.evaluate(api+'.snapshot()')
 view=lambda:page.evaluate(api+'.view()')
 save=lambda:page.evaluate(api+'.save()')
 if progress['index']:
  assert page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',progress['save']),page.locator('#message').inner_text()
  assert save()['campaign']['finalStateHash']==T[progress['index']-1]['afterStateHash'],'Stage restore differs from prior Chromium journal'
 else:
  assert save()['campaign']['finalStateHash']==golden['openingStateHash'],'Chromium default opening differs from independent headless opening'

 def check(c,msg):
  assert c, msg
  progress['checks']+=1

 def click_choice(action,candidates):
  matches=[i for i,a in enumerate(candidates) if same(a,action)]
  check(len(matches)==1, f'Unique authoritative UI action absent: {action}; {len(matches)} matches in {len(candidates)}')
  index=matches[0];progress['maxVisibleIndex']=max(progress['maxVisibleIndex'],index)
  button=page.locator(f'#actions button[data-action-index="{index}"]')
  if not button.count():
   # Filter using the visible player-facing Orders search, never the state API.
   terms=[action.get('unitId'),action.get('request',{}).get('unitId'),action.get('slotId'),
          action.get('hex'),action.get('action',{}).get('defenderHex')]
   for term in filter(None,terms):
    page.locator('#filter').fill(str(term))
    if button.count():break
   check(button.count()!=0, f'Player cannot reach action {index} through Orders filter: {action}')
  button.click(timeout=45000)
  if page.locator('#filter').input_value():page.locator('#filter').fill('')

 def commit_battles(action):
  battles=action['action']['battles']
  proposals=view()['proposals']
  check(len(battles)<=1, 'Golden policy has at most one battle per combat phase')
  for battle in battles:
   check(battle in proposals, f'Browser does not present source-validated proposed battle: {battle}')
   index=proposals.index(battle)
   boxes=page.locator('#battle-proposals input[type="checkbox"]')
   if index>=100 or not boxes.nth(index).count():
    page.locator('#filter').fill(battle['defenderHex'])
    filtered=[p for p in proposals if battle['defenderHex'].lower() in p['defenderHex'].lower()
              or any(battle['defenderHex'].lower() in id.lower() for id in p['attackers'])]
    check(battle in filtered and filtered.index(battle)<100,'Proposed battle inaccessible with visible defender filter')
    boxes.nth(filtered.index(battle)).check(timeout=30000)
   else:boxes.nth(index).check(timeout=30000)
  if page.locator('#filter').input_value():page.locator('#filter').fill('')
  page.locator('#commit-battles').click(timeout=45000)

 def resolve_battle(action):
  die=action['action']['die']
  check(page.locator('#roll-panel').is_visible(),'Source combat must expose a human dice panel')
  if die is None:
   check(page.locator('#automatic-ne').is_visible(),'Automatic NE uses no die')
   page.locator('#automatic-ne').click(timeout=45000)
  else:
   check(page.locator('#submit-die').is_visible(),'Non-automatic combat exposes d6')
   page.locator('#die').select_option(str(die))
   page.locator('#submit-die').click(timeout=45000)
  progress['uiExtraRolls']+=1
  post=view()
  check(post['kind']=='post-roll-choice','Die must lock and require outcome selection')
  check(post['die']==die,'Browser committed the same independent source die')
  click_choice(action,post['options']+post.get('fleetCommitments',[]))

 start=time.monotonic();local=0
 while progress['index']<len(T) and local<args.max_actions and time.monotonic()-start<args.max_seconds:
  i=progress['index'];g=T[i];s=snapshot()
  check(s['phaseId']==g['phaseId'] and s['cursor']['turn']==g['turn'] and s['actionCount']==g['actionCount'],
        f'Before action {i}: Browser {s["phaseId"]}/{s["cursor"]["turn"]}/{s["actionCount"]} != source {g["phaseId"]}/{g["turn"]}/{g["actionCount"]}')
  a=g['action'];k=kind(a)
  if k=='commit-battles':commit_battles(a)
  elif k=='resolve-battle':resolve_battle(a)
  else:
   v=view()
   check(v['kind']=='action-choice',f'Expected ordinary controls at action {i}, got {v["kind"]}')
   click_choice(a,v['commands'])
  check(not errors, f'Chromium page error at step {i}: {errors}')
  check(not page.locator('#message').inner_text(), f'Player UI rejected action {i} {k}: {page.locator("#message").inner_text()}')
  after=snapshot();saver=save()
  check(after['actionCount']==g['afterActionCount'], f'Action count at {i} differs: {after["actionCount"]} vs {g["afterActionCount"]}')
  check(after['phaseId']==g['afterPhaseId'],f'Phase at {i} differs: {after["phaseId"]} vs {g["afterPhaseId"]}')
  check(saver['campaign']['finalStateHash']==g['afterStateHash'],
        f'State divergence step {i} {k}: {saver["campaign"]["finalStateHash"]} vs {g["afterStateHash"]}')
  progress['index']+=1;local+=1
  progress['save']=saver
  # Persist only a normal browser-authored save. A failed subsequent stage is
  # restartable from exact trusted browser journal, not a synthesized state.
  progress['last']={'step':i,'turn':g['turn'],'phase':g['phaseId'],'action':k,'hash':g['afterStateHash']}
  args.progress.write_text(json.dumps(progress,separators=(',',':'))+'\n')
  if local%5==0:print('CHROMIUM',progress['index'],'/',len(T),'turn',after['cursor']['turn'],'phase',after['phaseId'],'sec',round(time.monotonic()-start,1),flush=True)
 if progress['index']==len(T):
  final=snapshot()
  check(final['cursor']['complete'] and final['terminal']['outcome']==golden['outcome'],'Seven-turn terminal outcome matches source')
  check(save()['campaign']['finalStateHash']==golden['finalStateHash'],'Terminal journal hash matches source')
  report={k:v for k,v in progress.items() if k!='save'}
  report['source']='All game transitions clicked through visible controls in Chromium; oracle generated by independent current shared-engine legal-action controller'
  report['complete']=True;report['terminal']=final['terminal'];report['checks']=progress['checks']
  (ROOT/'rules/audit/arduous-contested-chromium-v460.json').write_text(json.dumps(report,indent=2)+'\n')
  print('PASS COMPLETE seven-turn Arduous contested Chromium',progress['index'],'actions',progress['checks'],'assertions',flush=True)
 else:print('PASS STAGE',progress['index'],'/',len(T),'actions',progress['checks'],'assertions','seconds',round(time.monotonic()-start,1),flush=True)
 browser.close()
