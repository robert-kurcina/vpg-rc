#!/usr/bin/env python3
"""Arduous: actual Chromium legal German casualty and turn-4 west rebuild.
Uses printed-source candidate opening and the shared historical engine, with
no injected deaths, captured-city ownership or manufactured campaign actions.
"""
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
from importlib import import_module
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tests'))
fixture=import_module('arduous-browser-v419')
TARGET='arduous-front-r02c07'
SOVIET_ATTACKERS={'arduous-front-r04c02','arduous-front-r05c01','arduous-front-r05c02'}
AUDIT=ROOT/'rules/audit/arduous-german-human-rebuild-v452.json'
VISUAL=ROOT/'rules/audit/visual/arduous-turn4-german-rebuild-v452.png'
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1536,'height':1024})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture.html_for('arduous'),wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
 view=lambda:page.evaluate('HistoricalBrowserPreview.view()')
 save=lambda:page.evaluate('HistoricalBrowserPreview.save()')
 checks=0; phases=[]
 def check(value,message):
  global checks
  assert value,message
  checks+=1
 def clean():
  check(not errors,'Chromium reported no unhandled JS exceptions')
  check(not page.locator('#message').inner_text(),page.locator('#message').inner_text() or 'Browser error visible')
 def click(i):
  b=page.locator(f'#actions button[data-action-index="{i}"]')
  if not b.count():
   candidates=view().get('commands',view().get('options',[]));a=candidates[i]
   key=a.get('unitId') or a.get('slotId') or (a.get('action') or {}).get('defenderHex')
   if key:page.locator('#filter').fill(str(key))
  check(bool(b.count()),f'Visible player-action button {i}')
  b.click(timeout=30000)
  if page.locator('#filter').input_value():page.locator('#filter').fill('')
  clean()
 def battle(target,participants):
  q=view();matches=[i for i,p in enumerate(q.get('proposals',[])) if p['defenderHex']==target and set(p['attackers'])==set(participants)]
  check(len(matches)==1,f'Exactly one legal source attack on {target}: {participants}')
  page.locator('#battle-proposals input[type="checkbox"]').nth(matches[0]).check()
  page.locator('#commit-battles').click();clean()
  q=view();idx=next(i for i,a in enumerate(q['commands']) if a.get('action',{}).get('type')=='select-battle' and a['action']['defenderHex']==target)
  click(idx)
 def roll(d):
  check(page.locator('#submit-die').is_visible(),'Real combat die input visible')
  page.locator('#die').select_option(str(d));page.locator('#submit-die').click();clean()
  return view()
 check(snap()['phaseId']=='german-combat','German combat starts Turn 1')
 check(snap()['state']['units'][TARGET]['strengthStatus']=='printed-full','Source German counter starts full strength')
 click(0)  # Finish optional initial Air/Sea support
 battle('0305',['arduous-front-r02c02','arduous-front-r02c03',TARGET])
 check(any(a.get('action',{}).get('type')=='commit-ground-air' for a in view()['commands']),'German battle must lock air choice')
 click(next(i for i,a in enumerate(view()['commands']) if a.get('action',{}).get('type')=='commit-ground-air' and a['action'].get('faceId')=='arduous-front-r03c01'))
 q=roll(4)
 check(q.get('kind')=='post-roll-choice' and q['crtOutcome']=='EX',f'German supported attack reaches EX: {q.get("crtOutcome")}')
 match=[i for i,a in enumerate(q['options']) if TARGET in a['action']['choices'].get('attackerLossIds',[])]
 check(bool(match),'Player can assign source EX to selected German infantry')
 click(match[0]);check(snap()['state']['units'][TARGET]['strengthStatus']=='printed-reduced','German reduced legally by own attack')
 # Advance normal phases without uncommitted fighting, preserving legal actions.
 for step in range(110):
  s=snap();v=view();turn=s['cursor']['turn'];phase=s['phaseId'];kind=s['phaseKind']
  if not phases or phases[-1]!=(turn,phase):phases.append((turn,phase))
  if turn==1 and phase=='soviet-combat' and (s.get('combat') or {}).get('status')=='awaiting-declarations':break
  acts=v.get('commands',[]);types=[(a.get('action') or a)['type'] for a in acts]
  if kind=='combat':
   if v.get('proposals') and (s.get('combat') or {}).get('status')=='awaiting-declarations':page.locator('#commit-battles').click();clean()
   else:click(0)
  elif kind in ('movement','special-movement','buildup'):
   typ='finish-buildup' if 'finish-buildup' in types else 'finish-phase'
   check(typ in types,'Legal phase completion '+phase);click(types.index(typ))
  elif kind=='housekeeping':click(types.index('finish-housekeeping'))
  else:raise AssertionError('Unsupported phase progression '+phase)
 else:raise AssertionError('No first Soviet combat phase reached')
 battle('0306',SOVIET_ATTACKERS)
 q=roll(2)
 check(q.get('kind')=='post-roll-choice' and q.get('crtOutcome')=='EX',f'Soviet counterattack expected EX, got {q.get("crtOutcome")}')
 check(isinstance(q.get('choiceTruncated'),bool),'Combat catalog exposes honest truncation status')
 opts=[(i,a) for i,a in enumerate(q['options']) if a['action']['choices'].get('defenderLossId')==TARGET]
 check(bool(opts),'Soviet can assign EX defender loss to previously reduced German unit')
 # The authoritative result must actually eliminate TARGET; choose among
 # options for the same mandatory loss, not a fabricated casualty.
 click(opts[0][0])
 check(TARGET not in snap()['state']['units'],'German unit eliminated by a real, second combat')
 history_after_combat=snap()['actionCount']
 for step in range(150):
  s=snap();v=view();turn=s['cursor']['turn'];phase=s['phaseId'];kind=s['phaseKind']
  if not phases or phases[-1]!=(turn,phase):phases.append((turn,phase))
  if turn==4 and phase=='german-buildup':break
  acts=v.get('commands',[]);types=[(a.get('action') or a)['type'] for a in acts]
  if kind=='combat':
   if v['kind']=='post-roll-choice':click(0)
   elif v.get('prompts'):raise AssertionError('Unexpected ground-combat die')
   elif v.get('proposals') and (s.get('combat') or {}).get('status')=='awaiting-declarations':page.locator('#commit-battles').click();clean()
   else:click(0)
  elif kind in ('movement','special-movement','buildup'):
   typ='finish-buildup' if 'finish-buildup' in types else 'finish-phase'
   check(typ in types,'Legal pass '+phase);click(types.index(typ))
  elif kind=='housekeeping':click(types.index('finish-housekeeping'))
  else:raise AssertionError('Unsupported phase '+phase)
 else:raise AssertionError('Turn 4 German Build-Up not reached')
 before=snap();before_save=save();check(TARGET not in before['state']['units'],'Unit still eliminated on German Turn 4')
 check(before['buildup']['spent']==0,'German replacement allowance unspent')
 offered=view()['commands'];rebuild=[(i,a) for i,a in enumerate(offered) if a.get('type')=='apply-replacement' and a.get('unitId')==TARGET and a.get('hex')]
 check(bool(rebuild),'Actual German off-map replacement offered by browser')
 edges=json.loads((ROOT/'maps/buildup-configs/arduous.json').read_text())['entryEdge']['german']
 legal=[(i,a) for i,a in rebuild if a['hex'] in edges]
 check(bool(legal),'Legal west-border placement offered')
 index,chosen=legal[0]
 VISUAL.parent.mkdir(parents=True,exist_ok=True)
 page.locator('#filter').fill(TARGET)
 page.screenshot(path=str(VISUAL),full_page=True)
 page.locator('#filter').fill('')
 click(index)
 after=snap();after_save=save();unit=after['state']['units'][TARGET]
 check(after['lastEvent']['kind']=='replacement-rebuilt','Source off-map rebuilding event recorded')
 check(unit['strengthStatus']=='printed-reduced','Returned source counter is reduced')
 check(unit['activeFaceId']=='arduous-back-r02c02','German photographed reverse face matched')
 check(unit['hex']==chosen['hex'],'Entered at player-selected west-border hex')
 check(after['buildup']['spent']==1,'German consumed exactly one replacement step')
 check(after['actionCount']==before['actionCount']+1,'One new action added to journal')
 check(page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',after_save),'Browser save restores rebuilt unit')
 check(snap()==after and save()==after_save,'Restore is byte-identical')
 page.locator('#undo').click();clean()
 check(snap()==before and save()==before_save,'Undo restores eliminated German and replacement budget')
 click(index);check(snap()==after and save()==after_save,'Deterministic UI replay')
 check(not any(a.get('type')=='apply-replacement' and a.get('unitId')==TARGET for a in view()['commands']),'Same counter not offered again')
 AUDIT.write_text(json.dumps({'checkpoint':218,'version':'v452','scenario':'arduous',
  'source':'references/rules/arduous-rules.pdf §§10,12',
  'pdfSHA256':hashlib.sha256((ROOT/'references/rules/arduous-rules.pdf').read_bytes()).hexdigest(),
  'sourceCounter':TARGET,'germanLoss':['Turn 1 German supported EX, 0305, die 4','Turn 1 Soviet EX, 0306, die 2'],
  'browserActionsAfterLoss':history_after_combat,'rebuildTurn':4,'rebuildHex':chosen['hex'],
  'replacementEvent':after['lastEvent'],'checks':checks,'pageErrors':errors,'phaseTrace':phases,
  'saveRestore':'identical','undo':'identical','replay':'identical',
  'visual':'rules/audit/visual/arduous-turn4-german-rebuild-v452.png',
  'limitations':['One candidate source-valid opening, specific deterministic combat dice and player actions.',
   'German captured-city rebuilding via genuine city capture and browser controls remains unverified.',
   'The bounded EX choice catalog is not exhaustive.']},indent=2)+'\n')
 browser.close()
 print('PASS v452 genuine Chromium German combat elimination to off-map rebuild: checks',checks,'entry',chosen['hex'],'actions',after['actionCount'],flush=True)
