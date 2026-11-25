#!/usr/bin/env python3
"""Actual Chromium Arduous off-map Soviet Mechanized Corps rebuilding.
Player-facing setup chooses a source-legal concealed unit; legal combat
eliminates it. On Soviet Turn 3 it is rebuilt through visible browser control.
"""
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
from importlib import import_module
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
fixture=import_module('arduous-browser-v419')
TARGET='arduous-front-r04c02' # Revealed Soviet 4th Mechanized Corps, one-step eligible.
BANNED='arduous-front-r04c01' # Soviet 6th Mechanized Corps, source excluded.
AUDIT=ROOT/'rules/audit/arduous-human-offmap-rebuild-v450.json'
VISUAL=ROOT/'rules/audit/visual/arduous-turn3-offmap-rebuild-v450.png'
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
 def check(p,m):
  global checks
  assert p,m
  checks+=1
 def clean():
  check(not errors,'No page errors')
  check(not page.locator('#message').inner_text(),'No user-facing action error')
 def click(i):
  b=page.locator(f'#actions button[data-action-index="{i}"]')
  if not b.count():
   q=view();items=q.get('commands',q.get('options',[]));a=items[i]
   term=a.get('slotId') or a.get('unitId') or a.get('action',{}).get('defenderHex')
   if term:page.locator('#filter').fill(str(term))
  check(b.count()>0,'Visible control exists')
  b.click(timeout=25000)
  if page.locator('#filter').input_value():page.locator('#filter').fill('')
  clean()
 # Only the actual setup UI is used to select an alternate source-valid
 # deployment of concealed Mechanized Corps, including its mandatory mixing.
 page.locator('[data-game-tab="settings"]').click()
 page.locator('#configure-setup').click();clean()
 check(page.evaluate('HistoricalBrowserPreview.setupView().concealedMixed') is False,'Source setup not pre-mixed')
 page.locator('#setup-mix').click();check(page.evaluate('HistoricalBrowserPreview.setupView().concealedMixed'),'Concealed counters mixed through player UI')
 setup=page.evaluate('HistoricalBrowserPreview.setupView()')
 occupying=next(id for id,pos in setup['placements'].items() if pos=='0209')
 check(occupying!=TARGET or setup['placements'][TARGET]=='0209','Identified source location without moving combat pieces')
 if occupying!=TARGET:
  page.locator(f'#counter-overlay [data-unit-id="{occupying}"]').click();clean()
  if TARGET in setup['placements']:
   page.locator(f'#counter-overlay [data-unit-id="{TARGET}"]').click()
  else:
   page.locator(f'#setup-choices [data-pool-id="{TARGET}"]').click()
  clean()
 setup=page.evaluate('HistoricalBrowserPreview.setupView()')
 check(setup['placements'][TARGET]=='0209','Source-legal alternate deployment puts nonexcluded Corps on border hex 0209')
 check(setup['concealedMixed'] is True,'Source concealment mixing remains certified')
 page.locator('#setup-ready').click();clean()
 check(snap()['state']['units'][TARGET]['hex']=='0209','Game starts with source-legal mixed counter choice')
 page.locator('[data-game-tab="play"]').click()
 click(0) # finish original air/sea opening
 q=view();idxs=[i for i,p in enumerate(q['proposals']) if p['defenderHex']=='0209' and set(p['attackers'])=={'arduous-front-r01c03','arduous-front-r01c05'}]
 check(len(idxs)==1,'Verified source-ground combat proposed against target')
 page.locator('#battle-proposals input[type="checkbox"]').nth(idxs[0]).check()
 page.locator('#commit-battles').click();clean()
 click(0) # select battle
 available=view()['commands'];aidx=next(i for i,a in enumerate(available) if a.get('action',{}).get('type')=='commit-ground-air' and a['action']['faceId']=='arduous-front-r03c01')
 click(aidx)
 page.locator('#die').select_option('3');page.locator('#submit-die').click();clean()
 q=view();check(q['kind']=='post-roll-choice' and q['crtOutcome']=='DE','Sourced dice yield defender eliminated')
 click(0)
 check(TARGET not in snap()['state']['units'],'Source Corps eliminated by committed combat, not fabricated')
 phases=[]
 for step in range(110):
  s=snap();v=view();t=s['cursor']['turn'];phase=s['phaseId'];kind=s['phaseKind']
  if not phases or phases[-1]!=[t,phase]:phases.append([t,phase])
  if t==3 and phase=='soviet-buildup':break
  actions=v.get('commands',[]);types=[(a.get('action') or a)['type'] for a in actions]
  if kind=='combat':
   if v['kind']=='post-roll-choice':click(0)
   elif v.get('prompts'):raise AssertionError('Unexpected compulsory die')
   elif v.get('proposals') and s.get('combat',{}).get('status')=='awaiting-declarations':
    page.locator('#commit-battles').click();clean()
   else:click(0)
  elif kind in ('movement','special-movement','buildup'):
   wanted='finish-buildup' if 'finish-buildup' in types else 'finish-phase'
   check(wanted in types,'Legal pass available for '+phase)
   click(types.index(wanted))
  elif kind=='housekeeping':click(types.index('finish-housekeeping'))
  else:raise AssertionError('Unrecognized phase '+phase)
 else:raise AssertionError('Turn 3 Soviet Build-Up not reached')
 before=snap();before_save=save()
 check(TARGET not in before['state']['units'],'Eligible counter still eliminated on Turn 3')
 check(TARGET in before['state']['buildupDeployedIds'],'Eliminated unit preserves admission identity')
 check(before['buildup']['spent']==0,'Turn 3 replacement budget unspent')
 offered=view()['commands'];choices=[(i,a) for i,a in enumerate(offered) if a.get('type')=='apply-replacement' and a['unitId']==TARGET and a['hex'] is not None]
 check(bool(choices),'Real browser offers reentry from off-map')
 check(not any(a.get('type')=='apply-replacement' and a['unitId']==BANNED for a in offered),'Banned 6th not offered as replacement')
 # Prefer legal source edge over controlled cities for reproducible placement.
 edges=set(json.loads((ROOT/'maps/buildup-configs/arduous.json').read_text())['entryEdge']['soviet'])
 entry=next(((i,a) for i,a in choices if a['hex'] in edges),None)
 check(entry is not None,'At least one source East edge legal for rebuilt unit')
 idx,chosen=entry
 VISUAL.parent.mkdir(parents=True,exist_ok=True)
 page.locator('#filter').fill(TARGET)
 page.screenshot(path=str(VISUAL),full_page=True)
 page.locator('#filter').fill('')
 click(idx)
 after=snap();after_save=save();u=after['state']['units'].get(TARGET)
 check(u is not None,'Unit reentered board from eliminated pool')
 check(after['lastEvent']['kind']=='replacement-rebuilt','Journal shows off-map rebuild, not restoration')
 check(after['lastEvent']['unitId']==TARGET,'Correct photographed counter rebuilt')
 check(u['strengthStatus']=='revealed-one-step','Rebuilt tried Mechanized Corps preserves revealed face')
 check(u['activeFaceId']=='arduous-back-r04c07','Source-revealed 4th Mechanized reverse face retained')
 check(u['revealedAttackStrength']==2 and u['revealedDefenseStrength']==1,'Printed reverse values preserved')
 check(u['hex']==chosen['hex'],'Rebuilt at browser-offered source legal entry')
 check(after['buildup']['spent']==1 and after['buildup']['replacedMechanized']==1,'One step, one Mechanized replacement')
 check(TARGET in after['buildup']['rebuiltUnitIds'],'Same-phase rebuild tracked')
 check(after['actionCount']==before['actionCount']+1,'One committed action journaled')
 check(page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',after_save),'Player save restored')
 check(snap()==after and save()==after_save,'Restore reproduces rebuilt state and journal')
 page.locator('#undo').click();clean()
 check(snap()==before and save()==before_save,'Undo restores off-map unit and replacement budget')
 click(idx);check(snap()==after and save()==after_save,'Deterministic browser replay of rebuild')
 check(not any(a.get('type')=='apply-replacement' and a['unitId']==TARGET for a in view()['commands']),
  'Rebuilt one-step unit cannot be rebuilt or restored a second time this phase')
 report={'checkpoint':216,'version':'v450','scenario':'arduous',
  'ruleSource':'references/rules/arduous-rules.pdf §§12.0–12.4',
  'rulePdfSHA256':hashlib.sha256((ROOT/'references/rules/arduous-rules.pdf').read_bytes()).hexdigest(),
  'sourceEligibleCounter':TARGET,'revealedFormation':'4',
  'initialSetup':'Source-legal mixed concealed Corps and UI-selected placement at 0209; no artificial casualty',
  'battle':{'defenderHex':'0209','airSupport':'arduous-front-r03c01','die':3,'crt':'DE'},
  'rebuild':{'turn':3,'side':'soviet','hex':chosen['hex'], 'action':after['lastEvent'],
    'unitFace':u['activeFaceId'],'attack':u['revealedAttackStrength'],'defense':u['revealedDefenseStrength'],
    'stepsSpent':after['buildup']['spent'],'mechanizedRebuilds':after['buildup']['replacedMechanized']},
  'turnTrace':phases,'checks':checks,'pageErrors':errors,
  'saveRestore':'identical','undo':'identical','replay':'identical',
  'visual':'rules/audit/visual/arduous-turn3-offmap-rebuild-v450.png',
  'limitations':['One source-legal player-selected concealed setup and eliminated counter branch, not all off-map candidates.',
    'Unique historical setup identities remain provisional; the player-facing choice is authorized by source setup rules.',
    'Does not establish full seven-turn contested browser acceptance.']}
 AUDIT.write_text(json.dumps(report,indent=2)+'\n')
 browser.close()
 print('PASS v450 Arduous actual Chromium off-map rebuild',json.dumps({'checks':checks,'unit':TARGET,'hex':u['hex'],'actions':after['actionCount']}),flush=True)
