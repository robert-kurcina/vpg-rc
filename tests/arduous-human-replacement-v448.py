#!/usr/bin/env python3
"""Checkpoint 214: actual Arduous Chromium UI, source-supported Turn-3
Soviet replacement from a real opening battle, with save/Undo/replay.
No direct engine actions, modified state, or simulated game screenshot.
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path
from importlib import import_module
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
fixture=import_module('arduous-browser-v419')
ATTACKERS={'arduous-front-r02c02','arduous-front-r02c03','arduous-front-r02c08'}
AUDIT=ROOT/'rules/audit/arduous-human-replacement-v448.json'
VISUAL=ROOT/'rules/audit/visual/arduous-turn3-soviet-replacement-v448.png'

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=browser.new_page(viewport={'width':1536,'height':1024})
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
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
        check(not errors,'No Chromium page errors')
        check(not page.locator('#message').inner_text(),'No browser UI action error')
    def click(index):
        b=page.locator(f'#actions button[data-action-index="{index}"]')
        if not b.count():
            v=view();opts=v.get('commands',v.get('options',[]))
            a=opts[index]
            term=a.get('slotId') or a.get('unitId') or a.get('action',{}).get('defenderHex') or a.get('request',{}).get('unitId')
            if term:page.locator('#filter').fill(str(term))
        check(b.count()>0,'Legal action has visible UI button')
        b.click(timeout=25000)
        if page.locator('#filter').input_value(): page.locator('#filter').fill('')
        clean()
    def kinds(v): return [(a.get('action') or a).get('type') for a in v.get('commands',[])]
    check(snap()['phaseId']=='german-combat','Opening begins in Axis combat')
    click(0)  # commit no naval action (published UI)
    q=view()
    matches=[i for i,p in enumerate(q['proposals']) if p['defenderHex']=='0305' and set(p['attackers'])==ATTACKERS]
    check(len(matches)==1,'Opening battle is a unique source-legal proposal')
    page.locator('#battle-proposals input[type="checkbox"]').nth(matches[0]).check()
    page.locator('#commit-battles').click();clean()
    click(0) # select the committed battle
    actions=view()['commands']
    air=[i for i,a in enumerate(actions) if a.get('action',{}).get('type')=='commit-ground-air' and a['action']['faceId']]
    check(bool(air),'Source-supported Axis air counter offered')
    click(air[0]); check(page.locator('#submit-die').is_visible(),'Ordinary d6 control visible')
    page.locator('#die').select_option('4');page.locator('#submit-die').click();clean()
    q=view();check(q['kind']=='post-roll-choice' and q['crtOutcome']=='EX','Published shared CRT returned EX')
    match=[i for i,a in enumerate(q['options']) if a['action']['choices'].get('retreatPaths') and a['action']['choices'].get('advanceUnitId')]
    check(bool(match),'EX result has source-legal retreat and advance option')
    click(match[0]);check(snap()['actionCount']>=5,'Battle consequence actually committed')
    initial_actions=snap()['actionCount']
    phases=[]
    for step in range(90):
        s=snap();v=view();t=s['cursor']['turn'];phase=s['phaseId'];phase_kind=s['phaseKind']
        if not phases or phases[-1]!=[t,phase]:phases.append([t,phase])
        cs=kinds(v)
        if t==3 and phase=='soviet-buildup':break
        if phase_kind=='combat':
            if v['kind']=='post-roll-choice':click(0)
            elif v.get('prompts'):raise AssertionError('Unexpected roll prompt in pass-only later battles')
            elif v.get('proposals') and s.get('combat',{}).get('status')=='awaiting-declarations':
                page.locator('#commit-battles').click();clean()
            else:click(0)
        elif phase_kind in ('movement','special-movement','buildup'):
            if 'finish-buildup' in cs:click(cs.index('finish-buildup'))
            elif 'finish-phase' in cs:click(cs.index('finish-phase'))
            else:raise AssertionError(f'No finish control at turn {t} {phase}: {cs[:5]}')
        elif phase_kind=='housekeeping':click(cs.index('finish-housekeeping'))
        else:raise AssertionError('Unknown phase '+phase)
    else:raise AssertionError('Source-supported Turn 3 buildup was never reached')
    before=snap();v=view();available=[(i,a) for i,a in enumerate(v['commands']) if a['type']=='apply-replacement']
    check(bool(available),'Player UI offers a real replacement action on Turn 3')
    i,action=available[0]
    face=action['unitId'];unit=before['state']['units'][face]
    check(action['hex'] is None,'Unit is an on-map restoration, not a fabricated reentry')
    check(unit['owner']=='soviet' and unit['strengthStatus']=='printed-reduced','Restoration candidate is a reduced Soviet source counter')
    check(before['buildup']['spent']==0,'Turn-3 replacement budget unspent')
    check(page.locator('#actions button[data-action-index="'+str(i)+'"]').count() or bool(face),'Visible replacement can be reached by filter')
    before_save=save()
    VISUAL.parent.mkdir(parents=True,exist_ok=True)
    page.locator('#filter').fill(face)
    check(page.locator('#actions button[data-action-index="'+str(i)+'"]').count()>0,'Action remains accessible through user-facing filter')
    page.screenshot(path=str(VISUAL),full_page=True)
    page.locator('#filter').fill('')
    click(i)
    after=snap();u=after['state']['units'][face]
    check(u['strengthStatus']=='printed-full','Restored source face is full strength')
    check(u['hex']==unit['hex'] and u['owner']=='soviet','Replacement keeps unit position and side')
    check(u['printedCombatStrength']>unit['printedCombatStrength'],'Source-backed printed strength increased')
    check(after['buildup']['spent']==before['buildup']['spent']+1,'Exactly one replacement step consumed')
    check(face in after['buildup']['rebuiltUnitIds'] or after['lastEvent'].get('unitId')==face,'Restoration logged in campaign action event')
    check(after['actionCount']==before['actionCount']+1,'One journaled action committed')
    after_save=save()
    check(page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',after_save),'Player-facing restore succeeds')
    check(snap()==after and save()==after_save,'Save/restore preserves replacement and budget')
    page.locator('#undo').click();clean()
    check(snap()==before,'Undo restores identical pre-replacement campaign state')
    check(save()==before_save,'Undo reconstructs exact pre-replacement saved journal')
    click(i)
    check(snap()==after and save()==after_save,'Replaying identical UI action reproduces exact result')
    # The same already-restored face must not appear in the next legal-action
    # catalog, and the complete Turn-3 replacement allowance cannot carry over.
    offered=view()['commands']
    check(not any(a.get('type')=='apply-replacement' and a.get('unitId')==face for a in offered),
          'Full-strength source face cannot be restored a second time')
    end=next(j for j,a in enumerate(offered) if a.get('type')=='finish-buildup')
    click(end)
    ended=snap()
    check(ended['phaseId']=='soviet-special-movement','Completing buildup advances to the official next phase')
    check(ended['lastEvent']['forfeitedReplacementSteps']==0,'Only available Turn-3 Soviet replacement step was used')
    check(not errors,'No errors during full browser replacement acceptance')
    report={
      'checkpoint':214,'version':'v448','scenario':'arduous',
      'method':'Actual Chromium human controls, unmodified bundled engine, approved source map SVG; memory-loaded local files',
      'ruleSource':'references/rules/arduous-rules.pdf §12.0–12.4',
      'sourcePdfSHA256':hashlib.sha256((ROOT/'references/rules/arduous-rules.pdf').read_bytes()).hexdigest(),
      'preparation':{'openingBattleDefenderHex':'0305','attackers':sorted(ATTACKERS),'die':4,'crtOutcome':'EX',
        'openingActionsAfterBattle':initial_actions,'phaseTrace':phases},
      'replacement':{'turn':3,'phase':'soviet-buildup','faceId':face,'hex':unit['hex'],
        'strengthBefore':unit['printedCombatStrength'],'strengthAfter':u['printedCombatStrength'],
        'budgetSpentBefore':before['buildup']['spent'],'budgetSpentAfter':after['buildup']['spent'],
        'sourceStatusBefore':unit['strengthStatus'],'sourceStatusAfter':u['strengthStatus'],
        'journalActionBefore':before['actionCount'],'journalActionAfter':after['actionCount'],
        'fullStrengthFaceNoLongerOffered':True,'unspentStepsForfeited':ended['lastEvent']['forfeitedReplacementSteps']},
      'checks':checks,'browserErrors':errors,'saveRestore':'identical', 'undo':'identical', 'replay':'identical',
      'visual':'rules/audit/visual/arduous-turn3-soviet-replacement-v448.png',
      'limitations':['One chosen source-valid contested opening and one Turn-3 on-map Soviet restoration',
        'Does not prove all later-turn replacements or off-map rebuilds through browser',
        'Does not resolve Arduous printed opening marker disagreements or certify Kiev']}
    AUDIT.write_text(json.dumps(report,indent=2)+'\n')
    browser.close()
    print('PASS Arduous human browser Turn-3 Soviet replacement',json.dumps({'assertions':checks,'face':face,'before':unit['printedCombatStrength'],'after':u['printedCombatStrength'],'actions':after['actionCount']}),flush=True)
