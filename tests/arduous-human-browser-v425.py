#!/usr/bin/env python3
"""Arduous contested all-human-control Chromium acceptance.

Only click/select/checkbox/roll interactions on the real browser are permitted to
commit game actions. The scripted selection is deliberately nonstrategic.
The original official map, source JS, and source JSON are loaded in the browser.
"""
import argparse, json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parent))
from importlib import import_module
browser_fixture=import_module('arduous-browser-v419')
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--resume',type=Path)
parser.add_argument('--progress',type=Path,default=ROOT/'rules/audit/.arduous-human-browser-progress-v425.json')
parser.add_argument('--max-seconds',type=float,default=140)
parser.add_argument('--max-actions',type=int,default=35)
args=parser.parse_args()
prior=json.loads(args.resume.read_text()) if args.resume else None
with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':1536,'height':1024},accept_downloads=True)
  errors=[]
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.set_content(browser_fixture.html_for('arduous'),wait_until='domcontentloaded',timeout=60000)
  page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
  api='HistoricalBrowserPreview'
  snapshot=lambda:page.evaluate(api+'.snapshot()')
  if prior:
    assert page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',prior['save']),page.locator('#message').inner_text()
    assert snapshot()==prior['snapshot']
    counts=prior['counts'];history=prior['history']
  else:
    page.locator('[data-game-tab="settings"]').click()
    page.locator('#configure-setup').click()
    assert page.locator('#setup-panel').is_visible()
    page.locator('#setup-mix').click()
    assert page.evaluate(api+'.setupView().concealedMixed')
    assert len(page.evaluate(api+'.setupView().units'))==30
    page.locator('#setup-ready').click()
    assert not page.locator('#message').inner_text()
    counts={'movement':0,'combatDeclarations':0,'postCombat':0,'die':0,'automaticNE':0,'reinforcements':0,'replacements':0,'airChoices':0,'other':0,'uiDecisions':0}
    history=[]
  start=time.monotonic();local=0
  def click_action(index):
    b=page.locator('#actions button[data-action-index="'+str(index)+'"]')
    if not b.count():
      # The real action filter is the supported UI for lists longer than 100.
      view=page.evaluate(api+'.view()')
      choices=view['options']+view.get('fleetCommitments',[]) if view['kind']=='post-roll-choice' else view['commands']
      a=choices[index]
      terms=[a.get('unitId'),a.get('request',{}).get('unitId'),a.get('slotId'),a.get('action',{}).get('defenderHex')]
      for term in filter(None,terms):
        page.locator('#filter').fill(str(term))
        if b.count():break
      assert b.count(),f'Action {index} unavailable through filter: {a}'
    b.click(timeout=15000)
    if page.locator('#filter').input_value():page.locator('#filter').fill('')
  while not snapshot()['cursor']['complete'] and local<args.max_actions and time.monotonic()-start<args.max_seconds:
    before=snapshot();v=page.evaluate(api+'.view()');phase=before['phaseId'];actor=before['actor'];turn=before['cursor']['turn']
    kinds=[(a.get('action') or a).get('type') for a in v.get('commands',[])]
    earlier=[a for a in history if a['phase']==phase]
    prevKinds=[a['kind'] for a in earlier]
    category='other'
    if v['kind']=='post-roll-choice':
      assert page.locator('#actions button').count(),f'No post-combat choices {phase}'
      click_action(0);category='postCombat'
    elif v['kind']=='action-choice':
      prompts=[x for x in v.get('prompts',[]) if x.get('kind')=='die-and-choice']
      if prompts:
        assert page.locator('#roll-panel').is_visible()
        if prompts[0].get('automaticNoDie'):
          assert page.locator('#automatic-ne').is_visible()
          page.locator('#automatic-ne').click();category='automaticNE'
        else:
          assert page.locator('#submit-die').is_visible()
          die=[4,1,5,2,6,3][counts['die']%6]
          page.locator('#die').select_option(str(die));page.locator('#submit-die').click();category='die'
      elif before['phaseKind']=='combat' and before.get('combat',{}).get('status')=='awaiting-declarations' and v.get('proposals') and 'combatDeclarations' not in prevKinds:
        boxes=page.locator('#battle-proposals input[type="checkbox"]')
        assert boxes.count()
        boxes.first.check();page.locator('#commit-battles').click();category='combatDeclarations'
      elif before['phaseKind'] in ('movement','special-movement') and 'declare-ground-move' in kinds and 'movement' not in prevKinds:
        click_action(kinds.index('declare-ground-move'));category='movement'
      elif before['phaseKind']=='buildup' and 'place-reinforcement' in kinds and prevKinds.count('reinforcements')<4:
        click_action(kinds.index('place-reinforcement'));category='reinforcements'
      elif before['phaseKind']=='buildup' and 'apply-replacement' in kinds and 'replacements' not in prevKinds:
        click_action(kinds.index('apply-replacement'));category='replacements'
      else:
        assert kinds,f'No controls at {phase} {v}'
        kind=kinds[0]
        click_action(0)
        if kind=='commit-ground-air':category='airChoices'
        elif kind=='resolve-ground-move':category='movementResolved'
        else:category='other'
    else: raise AssertionError(f'Unexpected view {v["kind"]} {phase}')
    after=snapshot();error=page.locator('#message').inner_text()
    assert not errors,errors
    assert after['actionCount']>=before['actionCount'],f'Action count reversed: {phase}'
    assert after!=before or category in ('die','automaticNE'),f'No state progress {phase} {category} {error}'
    if error:raise AssertionError(f'UI control failed: {phase} {category}: {error}')
    if category in counts:counts[category]+=1
    counts['uiDecisions']+=1
    history.append({'phase':phase,'actor':actor,'turn':turn,'kind':category,'actionsAfter':after['actionCount']})
    # Resume safely even when a later catalog search exceeds the worker limit.
    saved_step=page.evaluate(api+'.save()')
    args.progress.write_text(json.dumps({'checkpoint':191,'version':'v425','save':saved_step,'snapshot':after,
        'counts':counts,'history':history,'errors':errors,'complete':after['cursor']['complete']},separators=(',',':'))+'\n')
    local+=1
    if local%8==0 or after['phaseId']!=phase:
      print('UI',counts['uiDecisions'],'turn',after['cursor']['turn'],'phase',after['phaseId'],'actions',after['actionCount'],'sec',round(time.monotonic()-start,1),flush=True)
  snap=snapshot();save=page.evaluate(api+'.save()')
  assert save['format']=='historical-custom-campaign'
  # Verify an identical browser save roundtrip and untouched current state.
  assert page.evaluate('(s)=>HistoricalBrowserPreview.restore(s)',save)
  assert snapshot()==snap
  assert page.evaluate(api+'.save()')==save
  result={'checkpoint':191,'version':'v425','source':'original Arduous browser scripts and exported SVG, loaded from in-memory local project fixture',
          'save':save,'snapshot':snap,'history':history,'counts':counts,'errors':errors,'complete':snap['cursor']['complete']}
  args.progress.parent.mkdir(parents=True,exist_ok=True)
  args.progress.write_text(json.dumps(result,separators=(',',':'))+'\n')
  print('STAGE PASS',counts['uiDecisions'],'UI decisions, actions',snap['actionCount'],'turn',snap['cursor']['turn'], 'complete',snap['cursor']['complete'],flush=True)
  if snap['cursor']['complete']:
    assert snap['cursor']['turn']==7 and snap['terminal']
    audited={k:v for k,v in result.items() if k not in ('save','snapshot','history')}
    audited.update({'turn':snap['cursor']['turn'],'terminal':snap['terminal'],'actionCount':snap['actionCount'],
                    'limitations':['Scripted legal choices through the real human controls; not an AI strength test',
                                   'Candidate scenario opening; printed source marker disagreements unresolved',
                                   'Source JS and map SVG loaded in-memory; hosted navigation and physical iPad Safari not tested']})
    (ROOT/'rules/audit/arduous-human-browser-v425.json').write_text(json.dumps(audited,indent=2)+'\n')
    print('FULL HUMAN BROWSER PASS',json.dumps({'actions':audited['actionCount'],'counts':counts,'terminal':audited['terminal']}),flush=True)
  browser.close()
