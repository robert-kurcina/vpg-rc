#!/usr/bin/env python3
"""Source-backed Arduous regular-d6, air, retreat, advance, and pending-save
acceptance through the actual player-facing Chromium controls.
No AI or direct engine action submission is used to commit a move or battle.
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
from importlib import import_module
sys.path.insert(0, str(Path(__file__).resolve().parent))
fixture=import_module('arduous-browser-v419')
ROOT=Path(__file__).resolve().parents[1]
AUDIT=ROOT/'rules/audit/arduous-human-special-combat-v426.json'
ATTACKERS={'arduous-front-r02c02','arduous-front-r02c03','arduous-front-r02c08'}
DEFENDER='0305'

def verify():
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1536,'height':1024})
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content(fixture.html_for('arduous'),wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
  view=lambda: page.evaluate('HistoricalBrowserPreview.view()')
  snapshot=lambda: page.evaluate('HistoricalBrowserPreview.snapshot()')
  save=lambda: page.evaluate('HistoricalBrowserPreview.save()')
  def clean():
   assert not errors,errors
   assert not page.locator('#message').inner_text(),page.locator('#message').inner_text()
  assert snapshot()['phaseId']=='german-combat'
  assert snapshot()['actionCount']==0
  # Commit no naval attack using the actual action button.
  page.locator('#actions button').first.click();clean()
  q=view();assert q['phaseKind']=='combat' and q['proposals']
  # Pick an independently validated three-counter historical opening battle.
  matches=[i for i,p in enumerate(q['proposals']) if p['defenderHex']==DEFENDER and set(p['attackers'])==ATTACKERS]
  assert len(matches)==1,('Source battle absent from exposed UI',matches)
  assert matches[0]<page.locator('#battle-proposals input[type="checkbox"]').count()
  page.locator('#battle-proposals input[type="checkbox"]').nth(matches[0]).check()
  page.locator('#commit-battles').click();clean()
  assert snapshot()['combat']['status']=='committed'
  page.locator('#actions button').first.click();clean()
  assert snapshot()['combat']['status']=='battle-selected'
  commands=view()['commands']
  # Choose an actually offered German air-support unit; test its precommit.
  air=[(i,a) for i,a in enumerate(commands) if a.get('action',{}).get('type')=='commit-ground-air' and a['action']['faceId']]
  assert air,commands
  air_index,air_action=air[0]
  page.locator(f'#actions button[data-action-index="{air_index}"]').click();clean()
  assert snapshot()['combat']['groundAirChoice']==air_action['action']['faceId']
  prompt=view()['prompts']
  assert len(prompt)==1 and prompt[0]['type']=='resolve-battle' and not prompt[0]['automaticNoDie']
  assert page.locator('#submit-die').is_visible() and not page.locator('#automatic-ne').is_visible()
  pre=snapshot();pre_save=save()
  page.locator('#die').select_option('4')
  page.locator('#submit-die').click();clean()
  pending=view()
  assert pending['kind']=='post-roll-choice' and pending['die']==4
  assert pending['crtOutcome']=='EX',pending['crtOutcome']
  assert len(pending['options'])>1
  assert not page.locator('#roll-panel').is_visible(),'Committed die must not be rolled again'
  assert snapshot()==pre,'A precommitted die must not mutate campaign state until consequence choice'
  pending_save=save()
  assert pending_save['pendingRoll']['die']==4
  assert page.evaluate('(p)=>HistoricalBrowserPreview.restore(p)',pending_save),page.locator('#message').inner_text()
  assert save()==pending_save,'Pending die and candidate options must survive restoration'
  assert view()==pending,'A restored pending die must show the identical consequence list'
  # Choose a legal result with both source-validated retreat and advance.
  choices=pending['options']
  picked=[(i,a) for i,a in enumerate(choices) if a['action']['choices'].get('retreatPaths') and a['action']['choices'].get('advanceUnitId')]
  assert picked,'No source-legal retreat+advance consequence was exposed'
  choice_index,choice=picked[0]
  assert choice_index<page.locator('#actions button').count(),'A visible choice must be selectable'
  page.locator(f'#actions button[data-action-index="{choice_index}"]').click();clean()
  after=snapshot();assert after['actionCount']==pre['actionCount']+1
  assert after['combat']['status']=='battles-resolved'
  assert after['state']!=pre['state'],'The chosen consequence must affect actual game state'
  post_save=save()
  assert page.evaluate('(p)=>HistoricalBrowserPreview.restore(p)',post_save)
  assert snapshot()==after and save()==post_save
  page.locator('#undo').click();clean()
  assert snapshot()==pre,'Undo must restore the pre-combat consequence game state'
  # Undo also removes the pending die by design; user must recommit it.
  assert view()['kind']=='action-choice' and page.locator('#submit-die').is_visible()
  page.locator('#die').select_option('4');page.locator('#submit-die').click();clean()
  assert view()==pending,'Recommitted die must reproduce exactly the same options'
  page.locator(f'#actions button[data-action-index="{choice_index}"]').click();clean()
  assert snapshot()==after and save()==post_save,'Same choices must reproduce identical journal/state'
  report={'checkpoint':192,'version':'v426','scenario':'arduous','scope':'actual Chromium UI, official source map and bundled shared historical engine',
   'battle':{'defenderHex':DEFENDER,'attackers':sorted(ATTACKERS),'airFaceId':air_action['action']['faceId'],
             'die':4,'crtOutcome':pending['crtOutcome'],'legalPostRollOptions':len(choices),
             'retreatPaths':choice['action']['choices']['retreatPaths'],
             'advanceUnitId':choice['action']['choices']['advanceUnitId']},
   'verified':['three-attacker browser checkbox declaration','source-legal German air-support commitment',
    'ordinary d6 commitment before consequences','committed die remains immutable during consequence choice',
    'pending-die save/restore reproduces source-legal choices','visible result applies simultaneous losses/retreat/advance',
    'post-result restore','Undo and deterministic replay reproduce identical game state and save'],
   'committedEngineActions':after['actionCount'],'browserErrors':errors,
   'limitations':['Controlled opening combat branch only; not an exhaustive human replay of the 184-action campaign',
    'Candidate setup; printed source deployment identities not independently certified',
    'In-memory Chromium fixture uses exact bundled JS, source JSON and original SVG; physical Safari unverified']}
  AUDIT.write_text(json.dumps(report,indent=2)+'\n')
  browser.close()
  print('PASS Arduous source-backed browser regular d6/retreat/advance/Undo',json.dumps({'actions':after['actionCount'],'options':len(choices),'crt':pending['crtOutcome']}),flush=True)
if __name__=='__main__':verify()
