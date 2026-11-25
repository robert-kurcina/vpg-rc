#!/usr/bin/env python3
"""Real Chromium player controls: capture Brest, eliminate a German unit,
then rebuild it in the captured German city on Turn 4. No direct state edits.
This is one source-validated candidate setup, not all possible openings.
"""
from __future__ import annotations
import hashlib, json, sys
from pathlib import Path
from importlib import import_module
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'tests'))
fixture=import_module('arduous-browser-v419')
TARGET='arduous-front-r02c07'
CITY='0211';CITY_NAME='Brest-Litovsk'
SOVIET_ATTACKERS={'arduous-front-r04c02','arduous-front-r05c01','arduous-front-r05c02'}
OPENING=[
 ('0210',{'arduous-front-r01c05','arduous-front-r01c07'},'arduous-front-r03c02',6,'DRL'),
 ('0211',{'arduous-front-r01c08'},'arduous-front-r03c01',6,'DE'),
 ('0305',{'arduous-front-r02c02','arduous-front-r02c03',TARGET},None,2,'EX'),
]
AUDIT=ROOT/'rules/audit/arduous-german-captured-city-v458.json'
VISUAL=ROOT/'rules/audit/visual/arduous-turn4-german-city-rebuild-v458.png'
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':1536,'height':1024})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(fixture.html_for('arduous'),wait_until='domcontentloaded',timeout=60000)
 page.wait_for_function('!!window.HistoricalBrowserPreview',timeout=45000)
 snap=lambda:page.evaluate('HistoricalBrowserPreview.snapshot()')
 view=lambda:page.evaluate('HistoricalBrowserPreview.view()')
 save=lambda:page.evaluate('HistoricalBrowserPreview.save()')
 checks=0;phases=[]
 def check(value,message):
  global checks
  assert value,message
  checks+=1
 def clean():
  check(not errors,'No Chromium page errors')
  check(not page.locator('#message').inner_text(),page.locator('#message').inner_text() or 'No browser action error')
 def click(i):
  b=page.locator(f'#actions button[data-action-index="{i}"]')
  if not b.count():
   q=view();choices=q.get('options') if q.get('kind')=='post-roll-choice' else q.get('commands')
   a=choices[i]
   for term in [a.get('unitId'),a.get('slotId'),a.get('hex'),(a.get('action') or {}).get('defenderHex')]:
    if term is None:continue
    page.locator('#filter').fill(str(term))
    if b.count():break
  check(bool(b.count()),f'Visible button for action {i}')
  b.click(timeout=30000)
  if page.locator('#filter').input_value():page.locator('#filter').fill('')
  clean()
 def choose_battle(target):
  q=view();hits=[i for i,a in enumerate(q.get('commands',[])) if a.get('action',{}).get('type')=='select-battle' and a['action'].get('defenderHex')==target]
  check(len(hits)==1,f'Exactly one pending battle {target}')
  click(hits[0])
 def roll(die,expected):
  check(page.locator('#submit-die').is_visible(),'Post-commit die input visible')
  page.locator('#die').select_option(str(die));page.locator('#submit-die').click();clean()
  q=view();check(q.get('kind')=='post-roll-choice' and q.get('crtOutcome')==expected,f'Expected {expected}, got {q.get("crtOutcome")}')
  return q
 def close_phase():
  s=snap()
  # The first source-validated action in the shared catalogue is the phase
  # completion control. Click that *visible browser control*; do not trigger
  # a second expensive full movement catalogue calculation via .view().
  if s['phaseKind']=='combat' and (s.get('combat') or {}).get('status')=='awaiting-declarations':
   check(page.locator('#commit-battles').count()>0,'Visible combat completion control')
   page.locator('#commit-battles').click();clean()
  elif s['phaseKind'] in ('combat','movement','special-movement','buildup','housekeeping'):
   first=page.locator('#actions button[data-action-index="0"]')
   check(first.count()>0,'Visible source-validated first action in '+s['phaseId'])
   click(0)
  else:raise AssertionError('Unknown phase: '+s['phaseId'])
 def until(turn,phase,max_steps=160):
  for n in range(max_steps):
   s=snap();key=(s['cursor']['turn'],s['phaseId']);
   if not phases or phases[-1]!=key:phases.append(key)
   if key==(turn,phase):return
   close_phase()
  raise AssertionError('Could not reach '+str((turn,phase)))
 stage=json.loads((ROOT/'rules/audit/.arduous-city-stage2-v458.json').read_text())
 check(page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',stage['save']),'Restore authentic Soviet casualty save')
 check(snap()==stage['snapshot'],'Soviet casualty snapshot restored exactly')
 checks+=stage['checks']
 phases[:]=stage['phases']
 print('STAGE 3 restored',checks,snap()['phaseId'],snap()['actionCount'],flush=True)
 print('STAGE 3 advancing to German Turn 4',flush=True)
 until(4,'german-buildup')
 before=snap();before_save=save()
 check(before['state']['cityControl'][CITY_NAME]=='german','Captured city remains German-controlled on Turn 4')
 check(TARGET not in before['state']['units'],'Destroyed source counter still absent before replacement')
 options=view()['commands']
 rebuild=[(i,a) for i,a in enumerate(options) if a.get('type')=='apply-replacement' and a.get('unitId')==TARGET and a.get('hex')==CITY]
 print('German Turn 4 replacement options',len(options),'Brest city choices',len(rebuild),flush=True)
 check(len(rebuild)==1,'Actual browser offers previously eliminated German corps at captured west-communicating Brest')
 VISUAL.parent.mkdir(parents=True,exist_ok=True)
 page.locator('#filter').fill(TARGET);page.screenshot(path=str(VISUAL),full_page=True);page.locator('#filter').fill('')
 click(rebuild[0][0])
 after=snap();after_save=save()
 check(after['lastEvent']['kind']=='replacement-rebuilt','City replacement is an actual source action')
 check(after['lastEvent']['hex']==CITY,'German replacement enters captured city')
 check(after['state']['units'][TARGET]['strengthStatus']=='printed-reduced','Rebuilt unit uses reduced side')
 check(after['state']['units'][TARGET]['activeFaceId']=='arduous-back-r02c02','Source face identity preserved')
 check(after['buildup']['spent']==1,'German Turn 4 replacement allowance spent')
 check(after['state']['cityControl'][CITY_NAME]=='german','City remains German-controlled after rebuild')
 check(after['actionCount']==before['actionCount']+1,'Rebuild contributes exactly one action')
 check(page.evaluate('(x)=>HistoricalBrowserPreview.restore(x)',after_save),'Browser accepts rebuilt save')
 check(snap()==after and save()==after_save,'Save/restore identity after city rebuild')
 page.locator('#undo').click();clean()
 check(snap()==before and save()==before_save,'Undo restores eliminated unit and replacement allowance')
 click(rebuild[0][0]);check(snap()==after and save()==after_save,'Deterministic replay of city rebuild')
 assert not errors,errors
 AUDIT.write_text(json.dumps({'checkpoint':224,'version':'v458','scenario':'arduous','source':'references/rules/arduous-rules.pdf §§5 and 12','rulePdfSha256':hashlib.sha256((ROOT/'references/rules/arduous-rules.pdf').read_bytes()).hexdigest(), 'sourceCounter':TARGET,'capturedCity':CITY_NAME,'cityHex':CITY,'germanOpening':[{'defenderHex':t,'air':air,'die':d,'crtOutcome':o} for t,_,air,d,o in OPENING],'sovietElimination':'Turn 1 EX die 2 against 0306','rebuildTurn':4,'rebuild':after['lastEvent'],'checks':checks,'pageErrors':errors,'phaseTrace':phases,'saveRestore':'identical','undo':'identical','replay':'identical','visual':str(VISUAL.relative_to(ROOT)),'limitations':['One candidate source-valid opening and declared combat sequence; not all deployments or city captures.','Player-issued die outcomes; no AI strategy tested.','Does not complete seven-turn contested campaign or full post-roll consequence enumeration.']},indent=2)+'\n')
 browser.close()
 print('PASS v458 Chromium captured-city German elimination-to-rebuild',checks,'assertions','actions',after['actionCount'],flush=True)
