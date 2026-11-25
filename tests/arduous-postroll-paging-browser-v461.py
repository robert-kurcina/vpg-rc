#!/usr/bin/env python3
"""Actual Chromium regression: paged source-validated post-roll EX choices."""
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

 import time
 first_keys={json.dumps(x,sort_keys=True) for x in post['options']}
 ok(p.locator('#post-roll-next').is_visible() and p.locator('#post-roll-next').is_enabled(),'More consequences UI control visible and enabled')
 before_page_save=save();before_page_snapshot=snap()
 started=time.monotonic()
 p.locator('#post-roll-next').click(timeout=120000)
 p.wait_for_function('HistoricalBrowserPreview.view()?.choicePage === 1',timeout=120000)
 page_seconds=round(time.monotonic()-started,2)
 later=view()
 ok(later['kind']=='post-roll-choice' and later['choicePage']==1,'Next page displayed after immutable die')
 ok(len(later['options'])>0,'Page 2 includes source-validated consequences')
 second_keys={json.dumps(x,sort_keys=True) for x in later['options']}
 ok(not first_keys.intersection(second_keys),'Pages contain no duplicate legal consequences')
 ok(save()==before_page_save and snap()==before_page_snapshot,'Paging does not change campaign, pending die, journal or RNG')
 ok(p.locator('#post-roll-previous').is_enabled(),'Previous page navigation is available')
 ok(p.locator('#actions button').count()==len(later['options']),'All page-two choices have visible buttons')
 # A valid listed choice must remain unforgeable with a different die.
 forged=json.loads(json.dumps(later['options'][0]))
 forged['action']['die']=3
 ok(p.evaluate('(a)=>HistoricalBrowserPreview.choose(a)',forged) is False,'Unvalidated alternative die rejected')
 ok(snap()==before_page_snapshot and save()==before_page_save,'Forged choice leaves die and journal intact')
 p.locator('#post-roll-previous').click()
 ok(view()['choicePage']==0 and {json.dumps(x,sort_keys=True) for x in view()['options']}==first_keys,
    'Previous page reproduces identical choices')
 p.locator('#post-roll-next').click()
 p.wait_for_function('HistoricalBrowserPreview.view()?.choicePage === 1',timeout=120000)
 ok({json.dumps(x,sort_keys=True) for x in view()['options']}==second_keys,'Cached next-page choices stable')
 if later['hasNextPage']:
  p.locator('#post-roll-next').click(timeout=120000)
  p.wait_for_function('HistoricalBrowserPreview.view()?.choicePage === 2',timeout=120000)
  third=view()
  third_keys={json.dumps(x,sort_keys=True) for x in third['options']}
  ok(len(third_keys)>0,'Further legal choices available after first 256 options')
  ok(not third_keys.intersection(first_keys|second_keys),'Page three also has no duplicate choices')
  ok(save()==before_page_save and snap()==before_page_snapshot,'Three pages do not mutate committed die')
  ok(p.locator('#actions button').count()==len(third['options']),'All page-three choices clickable')
  p.locator('#post-roll-pages').scroll_into_view_if_needed()
  p.screenshot(path=str(ROOT/'rules/audit/visual/arduous-postroll-page-three-v461.png'),full_page=False)
 else:
  third={'options':[],'choicePage':1}
  third_keys=set()
 click(0)
 outcome=snap()
 ok(outcome['lastEvent']['outcome']=='EX','Later-page consequence resolves via authoritative transaction')
 ok(outcome['actionCount']==before_page_snapshot['actionCount']+1,'One new campaign action committed')
 after_save=save()
 ok(p.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',after_save),'Post-resolution save restores in browser')
 ok(snap()==outcome and save()==after_save,'Save/restore reproduces later-page consequence')
 p.locator('#undo').click()
 ok(snap()==before_page_snapshot,'Undo reverses later-page result')
 report={'checkpoint':227,'version':'v461','scenario':'arduous','choicePage':third['choicePage'],'pageTwoChoices':len(later['options']),
  'pageThreeChoices':len(third['options']),'uniqueChoicesViewed':len(first_keys|second_keys|third_keys),
  'pageTwoLoadSeconds':page_seconds,'assertions':n,'pageErrors':errors,
  'scope':'Consecutive additional pages of source-validated EX consequences via actual browser controls; no claim of exhaustive source consequences.'}
 (ROOT/'rules/audit/arduous-paged-consequences-v461.json').write_text(json.dumps(report,indent=2)+'\n')
 b.close()
 print('PASS v461 post-roll browser paging:',n,'assertions, subsequent pages',len(later['options']),len(third['options']),'load seconds',page_seconds,flush=True)
