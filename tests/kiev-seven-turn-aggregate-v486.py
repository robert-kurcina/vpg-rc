#!/usr/bin/env python3
"""Verify the four real Chromium human-gateway campaign segments form one full game.

Each stage was run in an independent Chromium process, restored exclusively from
an authoritative game save; no synthetic campaign state is inserted.
"""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
AUDIT=ROOT/'rules/audit'
checks=0

def ok(v,description):
 global checks
 assert v,description
 checks+=1

def sha(data):return hashlib.sha256(data).hexdigest()

turns=[]
all_phases=[]
summaries=[]
prior=None
for i in range(1,5):
 progress=json.loads((AUDIT/f'kiev-seven-turn-v486-stage{i}-evidence.json').read_text())
 saved=(AUDIT/f'kiev-seven-turn-v486-stage{i}-save.json').read_bytes()
 envelope=json.loads(saved)
 ok(progress['stage']==i,'stage indexed')
 ok(progress['range']==[2*i-1,min(2*i,7)],'source turn range')
 ok(progress['outputHash']==sha(saved),'stage output saved bytes pinned')
 ok(envelope['format']=='historical-human-decision-session','actual authoritative human campaign save format')
 ok(envelope['campaign']['format']=='wargame-historical-campaign-continuation','source-driven campaign journal inside human save')
 ok(not progress['errors'],'no browser JS exception')
 ok(progress['checks']>=30,'independent browser acceptance checks')
 ok(len(progress['turns'])==progress['range'][1]-progress['range'][0]+1,'all turns in segment')
 if prior is not None:
  prior_saved=(AUDIT/f'kiev-seven-turn-v486-stage{i-1}-save.json').read_bytes()
  ok(progress['inputHash']==sha(prior_saved),'exact previous saved game restored')
  ok(progress['beforeActionCount']==prior['afterActionCount'],'journal action continuity')
 else:
  ok(progress['inputHash'] is None and progress['beforeActionCount']==0,'started with fresh source setup')
 for step in progress['turns']:
  ok(step['turn']==len(turns)+1,'no skipped or duplicated turn')
  ok(any(a['phase']=='housekeeping' for a in step['actions']),'turn finishes housekeeping')
  turns.append(step)
  all_phases.extend(step['actions'])
 ok(progress['afterActionCount']==progress['beforeActionCount']+sum(len(step['actions']) for step in progress['turns']),
    'journal equals replayed action count')
 if i<4:ok(not progress['complete'],'not prematurely terminal')
 else:ok(progress['complete'],'final stage terminal')
 summaries.append({'stage':i,'range':progress['range'],'checks':progress['checks'],
                   'actions':progress['afterActionCount']-progress['beforeActionCount'],
                   'saveSHA256':progress['outputHash']})
 prior=progress
ok(len(turns)==7,'exactly seven completed turns')
ok(len(all_phases)==81,'actual shared human campaign commits 81 actions')
ok(sum(a['type']=='place-reinforcement' for a in all_phases)==4,'four source-scheduled reinforcements')
ok(sum(a['type']=='declare-ground-move' for a in all_phases)==1,'one actual ground move declaration')
ok(sum(a['type']=='resolve-ground-move' for a in all_phases)==1,'one actual ground move resolution')
ok(sum(a['phase']=='housekeeping' for a in all_phases)==7,'seven housekeeping transactions')
ok(sum(a['nested']=='commit-battles' for a in all_phases)==14,'14 no-battle declarations')
terminal=prior['terminal']
ok(terminal['outcome']=='soviet-victory','official Soviet terminal victory')
ok(terminal['reason']=='axis-controls-at-most-threshold','official winning condition')
ok(terminal['axisControlledCount']==2 and terminal['totalCities']==16,'exact terminal controlled city count')
ok(len(terminal['cityControl'])==16,'all original victory cities adjudicated')
combat=json.loads((AUDIT/'kiev-human-contested-v486.json').read_text())
ok(combat['crtOutcome']=='EX' and combat['die']==3,'separate human-browser exchange uses common CRT')
ok(combat['battle']['defenderHex']=='0205','source-legal original Kiev battle target')
ok(combat['actionCount']==4 and not combat['errors'],'separate battle consequence and save/restore pass')
screenshot=ROOT/'rules/audit/visual/kiev-seven-turn-terminal-browser-v486.png'
ok(screenshot.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'),'terminal screen is actual captured browser PNG')
audit={'checkpoint':252,'version':'v486','verifiedScope':'7-turn human-gateway pass-through with ground movement and source reinforcements; separate actual contested battle',
       'limitations':['Illustrative, source-legal opening allocation is not a certified historical starting setup',
                      'Seven-turn trace chooses no battles and no replacement actions; contested battle test is independent',
                      'Browser agent tests verify mechanics, not strategic AI or competitive gameplay',
                      'Kiev-Odessa remains unplayable'],
       'assertions':checks,'browserChecks':sum(x['checks'] for x in summaries)+combat['checks'],
       'actions':81,'reinforcements':4,'movementsResolved':1,'housekeepingPhases':7,
       'terminal':terminal,'stages':summaries,'combatBrowser':{'result':combat['crtOutcome'],'die':combat['die'],'actionCount':combat['actionCount']},
       'screenshot':'rules/audit/visual/kiev-seven-turn-terminal-browser-v486.png'}
(AUDIT/'kiev-browser-seven-turn-v486.json').write_text(json.dumps(audit,indent=2)+'\n')
print('PASS Kiev v486 seven-turn browser sequence',checks,'audit assertions;',audit['browserChecks'],'browser checks; 81 journaled actions')
