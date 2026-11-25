#!/usr/bin/env python3
"""Checkpoint 216: actual Chromium source-candidate Arduous play.
Two real opening attacks: eliminate Soviet 6th Mechanized and reduce an
infantry army; reach Soviet Turn 3 via normal player-facing phase controls.
Verify the prohibited destroyed 6th cannot be rebuilt, but the unrelated
on-map Soviet army can still be restored. No manufactured casualties/state.
"""
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
from importlib import import_module
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
fixture=import_module('arduous-browser-v419')
AUDIT=ROOT/'rules/audit/arduous-human-sixth-v450.json'
VISUAL=ROOT/'rules/audit/visual/arduous-sixth-eliminated-replacement-v450.png'
SIXTH='arduous-front-r04c01'; INF='arduous-front-r03c06'
ATTACKS=[('0209',{'arduous-front-r01c03','arduous-front-r01c05'},3,'arduous-front-r03c01'),
         ('0305',{'arduous-front-r02c02','arduous-front-r02c03','arduous-front-r02c08'},4,'arduous-front-r03c02')]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1536,'height':1024})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture.html_for('arduous'),wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
 view=lambda:page.evaluate('HistoricalBrowserPreview.view()')
 save=lambda:page.evaluate('HistoricalBrowserPreview.save()')
 checks=0
 def check(v,msg):
  global checks
  assert v,msg
  checks+=1
 def clean():
  check(not errors,'No browser script errors')
  check(not page.locator('#message').inner_text(),'No UI errors')
 def click(i):
  b=page.locator(f'#actions button[data-action-index="{i}"]')
  if not b.count():
   opts=view().get('commands',view().get('options',[]))
   a=opts[i];term=a.get('slotId') or a.get('unitId') or a.get('action',{}).get('defenderHex')
   if term:page.locator('#filter').fill(str(term))
  check(b.count()>0,'Action offered in player controls')
  b.click(timeout=25000)
  if page.locator('#filter').input_value():page.locator('#filter').fill('')
  clean()
 check(snap()['phaseId']=='german-combat','German opening combat')
 check(SIXTH in snap()['state']['units'],'Sixth starts on map')
 click(0) # source air/sea phase completion
 q=view();indices=[]
 for target,units,die,air in ATTACKS:
  matches=[i for i,a in enumerate(q['proposals']) if a['defenderHex']==target and set(a['attackers'])==units]
  check(len(matches)==1,f'Legal source battle found for {target}')
  indices+=matches
 for i in indices:page.locator('#battle-proposals input[type="checkbox"]').nth(i).check()
 page.locator('#commit-battles').click();clean()
 check(snap()['combat']['status']=='committed','Two legal battles committed before dice')
 results=[]
 for target,units,die,air in ATTACKS:
  q=view();choice=next(i for i,a in enumerate(q['commands']) if a.get('action',{}).get('type')=='select-battle' and a['action']['defenderHex']==target)
  click(choice)
  q=view();commits=[i for i,a in enumerate(q['commands']) if a.get('action',{}).get('type')=='commit-ground-air' and a['action'].get('faceId')==air]
  check(len(commits)==1,f'Photographed air marker available for {target}')
  click(commits[0]);check(page.locator('#submit-die').is_visible(),'Actual die control enabled')
  page.locator('#die').select_option(str(die));page.locator('#submit-die').click();clean()
  q=view();check(q['kind']=='post-roll-choice','Player-facing post-roll consequences')
  outcome=q['crtOutcome'];check(outcome in ('DE','EX','DRL'),'Expected source CRT result')
  opts=q['options'];check(bool(opts),'Legal consequences offered')
  match=[i for i,a in enumerate(opts) if a['action']['choices'].get('retreatPaths') and a['action']['choices'].get('advanceUnitId')]
  click(match[0] if match else 0)
  results.append({'hex':target,'die':die,'outcome':outcome})
 check(SIXTH not in snap()['state']['units'],'Source 6th eliminated through real combat')
 check(INF in snap()['state']['units'] and snap()['state']['units'][INF]['strengthStatus']=='printed-reduced','Other Soviet Infantry Army reduced by source combat')
 phases=[]
 for step in range(110):
  s=snap();v=view();turn=s['cursor']['turn'];phase=s['phaseId'];kind=s['phaseKind']
  if not phases or phases[-1]!=[turn,phase]:phases.append([turn,phase])
  if turn==3 and phase=='soviet-buildup':break
  commands=v.get('commands',[]);types=[(a.get('action') or a)['type'] for a in commands]
  if kind=='combat':
   if v['kind']=='post-roll-choice':click(0)
   elif v.get('prompts'):raise AssertionError('Unexpected compulsory ground-combat die')
   elif v.get('proposals') and s.get('combat',{}).get('status')=='awaiting-declarations':
    page.locator('#commit-battles').click();clean()
   else:click(0)
  elif kind in ('movement','special-movement','buildup'):
   action='finish-buildup' if 'finish-buildup' in types else 'finish-phase'
   check(action in types,f'Phase can end: {phase}')
   click(types.index(action))
  elif kind=='housekeeping':click(types.index('finish-housekeeping'))
  else:raise AssertionError(f'Unknown phase {phase} {kind}')
 else:raise AssertionError('Turn 3 Soviet Build-Up not reached')
 before=snap();check(before['buildup']['spent']==0,'Soviet first replacement step unspent')
 check(SIXTH not in before['state']['units'],'Eliminated 6th remains off-map on Turn 3')
 choices=view()['commands']
 available=[(i,a) for i,a in enumerate(choices) if a.get('type')=='apply-replacement']
 check(bool(available),'Human browser exposes replacement actions')
 check(not any(a['unitId']==SIXTH for i,a in available),'Prohibited 6th absent from all player-visible rebuilding choices')
 rebuilt=[(i,a) for i,a in available if a['hex'] is not None]
 restored=[(i,a) for i,a in available if a['unitId']==INF and a['hex'] is None]
 check(bool(restored),'Source-damaged other unit can be restored')
 VISUAL.parent.mkdir(parents=True,exist_ok=True)
 page.locator('#filter').fill(INF)
 page.screenshot(path=str(VISUAL),full_page=True)
 page.locator('#filter').fill('')
 first=save()
 click(restored[0][0]);after=snap();final=save()
 check(after['state']['units'][INF]['strengthStatus']=='printed-full','Unrelated on-map replacement still works')
 check(after['buildup']['spent']==1,'Exactly one replacement spent')
 check(SIXTH not in after['state']['units'],'Excluded 6th not admitted incidentally')
 check(page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',final),'Browser restore accepted')
 check(snap()==after,'Browser save/restore identical')
 page.locator('#undo').click();clean()
 check(snap()==before and save()==first,'Undo rolls back replacement and budget')
 click(restored[0][0]);check(snap()==after and save()==final,'Deterministic player-action replay')
 report={'checkpoint':216,'version':'v450','scenario':'arduous',
  'ruleSource':'references/rules/arduous-rules.pdf §12.0, printed p.6',
  'rulePdfSHA256':hashlib.sha256((ROOT/'references/rules/arduous-rules.pdf').read_bytes()).hexdigest(),
  'method':'Real Chromium browser controls, source-valid setup and battle actions, original shared JS and SVG; no injected elimination',
  'sourceBannedCounter':SIXTH,'bannedRevealedIdentity':'6',
  'openingBattles':results,'turnTrace':phases,
  'prohibitedOffMapRebuildOffered':False,
  'otherOffMapRebuildActions':len(rebuilt),
  'sourceOnMapReplacement':INF,
  'sourceOnMapStrengthAfter':after['state']['units'][INF]['printedCombatStrength'],
  'actionCount':after['actionCount'],'checks':checks,'pageErrors':errors,
  'saveRestore':'identical','undo':'identical','replay':'identical',
  'visual':'rules/audit/visual/arduous-sixth-eliminated-replacement-v450.png',
  'limitations':['The special 6th exclusion is demonstrated from real elimination through the browser.',
    'The rebuild of a permitted OFF-MAP counter is proven by the shared transaction engine with synthetic elimination, not yet by a browser casualty path.',
    'The Arduous unique printed initial-counter assignment remains candidate; full contested seven-turn browser acceptance is still incomplete.']}
 AUDIT.write_text(json.dumps(report,indent=2)+'\n')
 browser.close()
 print('PASS v450 Arduous actual Chromium Sixth Mechanized exclusion',json.dumps({'checks':checks,'opening':results,'offMapReplacementChoices':len(rebuilt),'sourceReplacement':INF,'actionCount':after['actionCount']}),flush=True)
