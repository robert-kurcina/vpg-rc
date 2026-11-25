#!/usr/bin/env python3
"""Actual Chromium regression: full Soviet 4-on-2 EX choices remain playable.
Demonstrates that overflowing a bounded consequence catalog does not strand
an immutable committed die or invent an unvalidated combat outcome.
"""
from __future__ import annotations
import sys,json,hashlib
from pathlib import Path
from importlib import import_module
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'tests'))
A=import_module('arduous-browser-v419')
ATTACKERS={'arduous-front-r03c06','arduous-front-r04c02','arduous-front-r05c01','arduous-front-r05c02'}
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 p=b.new_page(viewport={'width':1500,'height':950})
 errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 p.set_content(A.html_for('arduous'),wait_until='domcontentloaded',timeout=60000)
 p.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 snap=lambda:p.evaluate('HistoricalBrowserPreview.snapshot()')
 view=lambda:p.evaluate('HistoricalBrowserPreview.view()')
 save=lambda:p.evaluate('HistoricalBrowserPreview.save()')
 n=0
 def ok(c,m):
  global n
  assert c,m
  n+=1
 def click(i):
  bt=p.locator(f'#actions button[data-action-index="{i}"]')
  ok(bt.count()>0,'Browser offers a visible action button')
  bt.click(timeout=30000)
  ok(not errors,'No page script error')
  ok(not p.locator('#message').inner_text(),'No player-facing error')
 for _ in range(30):
  s=snap();v=view();ph=s['phaseId'];kind=s['phaseKind']
  if ph=='soviet-combat' and (s.get('combat') or {}).get('status')=='awaiting-declarations':break
  if kind=='combat':
   if (s.get('combat') or {}).get('status')=='awaiting-declarations':p.locator('#commit-battles').click()
   else:click(0)
  else:
   tt=[(a.get('action') or a).get('type') for a in v['commands']]
   action=next(x for x in ('finish-buildup','finish-phase','finish-housekeeping') if x in tt)
   click(tt.index(action))
 else:raise AssertionError('Cannot reach Turn 1 Soviet Combat')
 proposals=view()['proposals'];hits=[i for i,x in enumerate(proposals) if x['defenderHex']=='0306' and set(x['attackers'])==ATTACKERS]
 ok(len(hits)==1,'Four source-legal Soviet hexside attackers against two source German defenders')
 p.locator('#battle-proposals input[type="checkbox"]').nth(hits[0]).check()
 p.locator('#commit-battles').click()
 click(0)
 ok(p.locator('#submit-die').is_visible(),'Real die input visible')
 before_roll=save()
 p.locator('#die').select_option('2');p.locator('#submit-die').click()
 ok(not p.locator('#message').inner_text(),'Combinatorial combat does not strand the die')
 post=view()
 ok(post['kind']=='post-roll-choice' and post['crtOutcome']=='EX','Committed die 2 gives an EX result')
 ok(post['choiceTruncated'] is True,'Bounded result count truthfully marked as truncated')
 ok(len(post['options'])==128 and post['choiceLimit']==128,'128 concrete authoritative options exposed')
 ok('not necessarily exhaustive' in p.locator('#decision').inner_text(),'UI warns player of incomplete option catalog')
 ok(post['options'][0]['action']['choices'].get('defenderLossId') in {'arduous-front-r02c07','arduous-front-r02c08'},'Targeted actual source defender')
 before_consequence=save()
 click(0)
 after=snap();after_save=save()
 ok(after['actionCount']>snap().get('historyDepth',-1),'Combat resolution produced an action')
 ok(after['lastEvent']['outcome']=='EX','Authoritative outcome committed')
 ok(p.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',after_save),'Restored through browser')
 ok(snap()==after and save()==after_save,'Identical journal restored')
 p.locator('#undo').click()
 ok(not p.locator('#message').inner_text(),'Undo accepted')
 # Undo of resolved result may return to pre-committed die selection; outcome
 # and source state must never be fabricated from this test.
 ok(snap()['phaseId']=='soviet-combat','Undo stays in actual Soviet combat')
 report={'checkpoint':218,'version':'v452','source':'references/rules/arduous-rules.pdf §10 combat',
  'sourcePdfSHA256':hashlib.sha256((ROOT/'references/rules/arduous-rules.pdf').read_bytes()).hexdigest(),
  'scenario':'arduous','defenderHex':'0306','attackerIds':sorted(ATTACKERS),'die':2,
  'crtOutcome':post['crtOutcome'],'optionsShown':len(post['options']),'truncated':post['choiceTruncated'],
  'firstChoiceLosses':after['lastEvent'].get('losses',[]), 'tests':n,'pageErrors':errors,
  'limitation':'Catalog is intentionally limited to 128 validated candidate consequences; not every source-legal choice is presented.'}
 (ROOT/'rules/audit/arduous-post-roll-overflow-v452.json').write_text(json.dumps(report,indent=2)+'\n')
 b.close()
 print('PASS v452 4-attacker EX overflowing post-roll browse:',n,'assertions,128 validated choices',flush=True)
