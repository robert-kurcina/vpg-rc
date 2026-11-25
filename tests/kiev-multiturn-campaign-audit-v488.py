#!/usr/bin/env python3
"""Audit four independent real Chromium Kiev human-stage saves as one contested game.

No synthetic changes to saved snapshots are permitted; original generated saves
are verified as a full prefix chain with their own authoritative integrity.
"""
from pathlib import Path
from collections import Counter
import hashlib, json

ROOT=Path(__file__).resolve().parents[1]
AUDIT=ROOT/'rules/audit'
checks=0

def ok(pred, message):
    global checks
    assert pred, message
    checks+=1

def digest(data):return hashlib.sha256(data).hexdigest()

def validate_envelope(envelope):
    ok(envelope['format']=='historical-human-decision-session','actual human decision gateway save')
    c=envelope['campaign']
    ok(c['format']=='wargame-historical-campaign-continuation','original shared campaign save')
    content={k:v for k,v in envelope.items() if k!='integrity'}
    expected=digest(json.dumps(content,separators=(',',':'),ensure_ascii=False).encode('utf-8'))
    ok(envelope['integrity']=={'algorithm':'SHA-256','digest':expected},
       'cryptographically verified human save integrity')
    ok(c['integrity']['algorithm']=='SHA-256' and len(c['integrity']['digest'])==64,
       'authoritative campaign hash envelope included; validated by real Chromium restore')
    ok(envelope['pendingRoll'] is None,'no pending uncommitted combat die')

all_turns=[]
all_events=[]
combats=[]
replacements=[]
stages=[]
prior=None
prior_journal=None
for i in range(1,5):
    e=json.loads((AUDIT/f'kiev-multiturn-v488-stage{i}-evidence.json').read_text())
    raw=(AUDIT/f'kiev-multiturn-v488-stage{i}-save.json').read_bytes()
    data=json.loads(raw)
    validate_envelope(data)
    journal=data['campaign']['journal']
    ok(e['stage']==i,'stage identity')
    ok(e['range']==[i*2-1,min(i*2,7)],'exact pair of turns')
    ok(e['outputHash']==digest(raw),'sha-pinned output save')
    ok(e['afterActionCount']==len(journal),'full cumulative game journal length')
    ok(e['checks']>=30 and not e['errors'],'bounded real browser acceptance')
    if i>1:
        ok(e['inputHash']==digest((AUDIT/f'kiev-multiturn-v488-stage{i-1}-save.json').read_bytes()),'exact previous-stage saved bytes restored')
        ok(e['beforeActionCount']==prior['afterActionCount'],'stage transaction continuity')
        ok(journal[:len(prior_journal)]==prior_journal,'unmodified prior journal chain')
    else:
        ok(e['beforeActionCount']==0 and e['inputHash'] is None,'fresh original scenario')
    for event in e['turns']:
        ok(event['turn']==len(all_turns)+1,'turn ordering contiguous')
        ok(any(x['phase']=='housekeeping' for x in event['actions']),'actual housekeeping completed')
        all_turns.append(event)
        all_events+=event['actions']
    combats+=e['combats']
    replacements+=e['replacements']
    ok(e['afterActionCount']-e['beforeActionCount']==sum(len(x['actions']) for x in e['turns'])-
       sum(x['type']=='roll' for x in e['turns'] for x in x['actions']),
       'human rolls committed before but not as additional campaign journal entries')
    stages.append({'stage':i,'browserChecks':e['checks'],'actionCount':e['afterActionCount'],
                   'saveSha256':e['outputHash']})
    prior=e;prior_journal=journal

ok(len(all_turns)==7,'seven complete campaign turns')
ok(prior['complete'] and prior['terminal']['outcome']=='soviet-victory','official terminal victor')
ok(prior['terminal']['axisControlledCount']==2 and prior['terminal']['totalCities']==16,'source city adjudication')
assert len(prior_journal)==92
journal_actions=[x['action'] for x in prior_journal]
types=Counter(a.get('action',{}).get('type',a['type']) for a in journal_actions)
for typ,count in {'commit-battles':14,'select-battle':3,'resolve-battle':3,'commit-ground-air':2,
                  'apply-replacement':3,'place-reinforcement':4,'finish-housekeeping':7,
                  'declare-ground-move':1,'resolve-ground-move':1}.items():
    ok(types[typ]==count, f'authoritative journal: {count} {typ}')
ok(len(combats)==3 and [(x['turn'],x['actor'],x['outcome'],x['defenderHex']) for x in combats]==
   [(1,'german','EX','0205'),(1,'soviet','AL','0204'),(3,'german','DR','0304')],
   'three source-legal German/Soviet battles over multiple turns')
ok(combats[0]['airId']=='kiev-front-r03c01' and combats[0]['die']==3 and combats[1]['die']==6,
   'original FK air marker and declared CRT dice')
ok([(r['turn'],r['unitId']) for r in replacements]==[
    (2,'kiev-front-r03c04'),(2,'kiev-front-r04c03'),(4,'kiev-front-r01c01')],
   'Soviet Army restore, 18th Mechanized rebuild, German Panzer restore')
ok(replacements[1]['hex']=='1601','source-valid Soviet reconstructed corps placement')
ok(sum(e['type']=='roll' for e in all_events)==3,'three genuine post-declaration browser die commitments')
ok(combats[2]['die']==1 and combats[2]['airId'] is None,'Turn 3 DR declared with explicit decline of German air')
turn3=[j['action'] for j in prior_journal if j['action'].get('action',{}).get('type')=='resolve-battle' and j['action']['action']['die']==1]
ok(len(turn3)==1,'single persistent Turn-3 DR journal event')
choices=turn3[0]['action']['choices']
ok(choices['retreatPaths']=={'kiev-front-r04c02':['0404','0405']},'Turn-3 Soviet two-hex retreat preserved in terminal journal')
ok(choices['advanceUnitId']=='kiev-front-r01c02','Turn-3 German optional advance preserved in terminal journal')
ok(all(x['stateHash'] and len(x['stateHash'])==64 for x in prior_journal),'all 92 transition hashes present')
shot=ROOT/'rules/audit/visual/kiev-multiturn-terminal-browser-v488.png'
ok(shot.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'),'real Chromium terminal screenshot exists')
summary={
 'checkpoint':254,'version':'v488',
 'scope':'one 7-turn continuous source-legal illustrative Kiev browser campaign with three German/Soviet combats in Turns 1 and 3, including DR retreat and advance, three replacements, movement, reinforcements and terminal adjudication',
 'limits':['Source-legal illustrative deployment is not certified as exact historical setup',
           'Three selected battles across two turns do not establish exhaustive strategic AI or every historical combat branch',
           'Kiev–Odessa remains nonplayable'],
 'assertions':checks,'browserChecks':sum(s['browserChecks'] for s in stages),
 'stages':stages,'actions':len(prior_journal),'turns':7,'combatResults':
 [{'turn':v['turn'],'actor':v['actor'],'target':v['defenderHex'],'outcome':v['outcome'],'die':v['die'], 'air':v['airId']} for v in combats],
 'replacements':replacements,'reinforcements':types['place-reinforcement'],
 'groundMoves':types['resolve-ground-move'],'terminal':prior['terminal'],
 'screenshot':'rules/audit/visual/kiev-multiturn-terminal-browser-v488.png'}
(AUDIT/'kiev-multiturn-seven-turn-v488.json').write_text(json.dumps(summary,indent=2)+'\n')
print('PASS Kiev v488 multi-turn full-browser audit:',checks,'checks,',len(prior_journal),'real actions,',summary['browserChecks'],'Chromium assertions')
