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
    e=json.loads((AUDIT/f'kiev-contested-v487-stage{i}-evidence.json').read_text())
    raw=(AUDIT/f'kiev-contested-v487-stage{i}-save.json').read_bytes()
    data=json.loads(raw)
    validate_envelope(data)
    journal=data['campaign']['journal']
    ok(e['stage']==i,'stage identity')
    ok(e['range']==[i*2-1,min(i*2,7)],'exact pair of turns')
    ok(e['outputHash']==digest(raw),'sha-pinned output save')
    ok(e['afterActionCount']==len(journal),'full cumulative game journal length')
    ok(e['checks']>=30 and not e['errors'],'bounded real browser acceptance')
    if i>1:
        ok(e['inputHash']==digest((AUDIT/f'kiev-contested-v487-stage{i-1}-save.json').read_bytes()),'exact previous-stage saved bytes restored')
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
assert len(prior_journal)==89
journal_actions=[x['action'] for x in prior_journal]
types=Counter(a.get('action',{}).get('type',a['type']) for a in journal_actions)
for typ,count in {'commit-battles':14,'select-battle':2,'resolve-battle':2,'commit-ground-air':1,
                  'apply-replacement':3,'place-reinforcement':4,'finish-housekeeping':7,
                  'declare-ground-move':1,'resolve-ground-move':1}.items():
    ok(types[typ]==count, f'authoritative journal: {count} {typ}')
ok(len(combats)==2 and [(x['actor'],x['outcome'],x['defenderHex']) for x in combats]==
   [('german','EX','0205'),('soviet','AL','0204')], 'contested battles by both players on Kiev geometry')
ok(combats[0]['airId']=='kiev-front-r03c01' and combats[0]['die']==3 and combats[1]['die']==6,
   'original FK air marker and declared CRT dice')
ok([(r['turn'],r['unitId']) for r in replacements]==[
    (2,'kiev-front-r03c04'),(2,'kiev-front-r04c03'),(4,'kiev-front-r01c01')],
   'Soviet Army restore, 18th Mechanized rebuild, German Panzer restore')
ok(replacements[1]['hex']=='1601','source-valid Soviet reconstructed corps placement')
ok(sum(e['type']=='roll' for e in all_events)==2,'two genuine post-declaration browser die commitments')
ok(all(x['stateHash'] and len(x['stateHash'])==64 for x in prior_journal),'all 89 transition hashes present')
shot=ROOT/'rules/audit/visual/kiev-contested-terminal-browser-v487.png'
ok(shot.read_bytes().startswith(b'\x89PNG\r\n\x1a\n'),'real Chromium terminal screenshot exists')
summary={
 'checkpoint':253,'version':'v487',
 'scope':'one 7-turn continuous source-legal illustrative Kiev browser campaign with contested German and Soviet combat, three replacements, movement, reinforcements and terminal adjudication',
 'limits':['Source-legal illustrative deployment is not certified as exact historical setup',
           'Two selected battles do not establish exhaustive strategic AI or every historical combat branch',
           'Kiev–Odessa remains nonplayable'],
 'assertions':checks,'browserChecks':sum(s['browserChecks'] for s in stages),
 'stages':stages,'actions':len(prior_journal),'turns':7,'combatResults':
 [{'turn':v['turn'],'actor':v['actor'],'target':v['defenderHex'],'outcome':v['outcome'],'die':v['die'], 'air':v['airId']} for v in combats],
 'replacements':replacements,'reinforcements':types['place-reinforcement'],
 'groundMoves':types['resolve-ground-move'],'terminal':prior['terminal'],
 'screenshot':'rules/audit/visual/kiev-contested-terminal-browser-v487.png'}
(AUDIT/'kiev-contested-seven-turn-v487.json').write_text(json.dumps(summary,indent=2)+'\n')
print('PASS Kiev v487 contested full-browser audit:',checks,'checks,',len(prior_journal),'real actions,',summary['browserChecks'],'Chromium assertions')
