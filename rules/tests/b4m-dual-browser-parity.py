#!/usr/bin/env python3
"""Dual local Chromium comparison: frozen v316 and active v317.

These are TWO locally bundled engine versions sharing the current UI; neither
is an independent upstream Oberlabs build. Browser scripts are executed in
separate contexts and matched UI actions are compared at explicit boundaries.
"""
import hashlib
import json
import os
import pathlib
import re
import sys
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = pathlib.Path(os.getenv('B4M_PARITY_OUTPUT', ROOT/'rules/audit/differential/local-v316-v317.json'))
BRIDGE = r'''
window.__parity = {
  inspect(){return {state:JSON.parse(JSON.stringify(s)),restoreEligible:s.units.filter(u=>u.strength==='reduced'&&u.position).filter(u=>E.replacementOptions(c,s).some(o=>o.type==='restore'&&o.id===u.id)).map(u=>u.id),ui:{status:document.getElementById('statusPill').textContent,phaseLabel:document.getElementById('phase').textContent,optionNames:Array.from(document.querySelectorAll('#options button')).map(x=>x.textContent),undoDepth:history.length}};},
  starts(){return c.raw.hexes.filter(h=>h.germanStart).map(h=>({x:h.x,y:h.y,p:point(h.x,h.y)}));},
  movementFixture(){
    const t=E.makeState(c,271828,'automated');
    t.turn=2;t.side='german';t.phase='movement';t.log=[];
    let found=null;
    for(const u of t.units.filter(u=>u.army==='german'&&u.position)){
      const moves=E.legalMoves(c,t,u,'normal');
      if(moves.length){found={id:u.id,from:{...u.position},to:{x:moves[0].x,y:moves[0].y},fromPoint:point(u.position.x,u.position.y),toPoint:point(moves[0].x,moves[0].y)};break;}
    }
    if(!found)throw Error('No legal map-click movement fixture');
    s=t;selection=null;history=[];used.clear();combats.clear();combatChoice=null;render();
    return found;
  },
  combatFixture(){
    const t=E.makeState(c,161803,'manual');
    t.turn=2;t.side='german';t.phase='combat';t.log=[];
    for(const u of t.units){u.position=null;u.strength='dead';}
    const g=t.units.find(u=>u.army==='german'),d=t.units.find(u=>u.army==='soviet');
    let found=null;
    for(const h of c.raw.hexes){
      if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
      for(const n of E.neighbours(c,h.x,h.y)){
        const ah=E.hexAt(c,n.x,n.y);
        if(!ah||ah.terrain!=='open'||(ah.city&&ah.city!=='none'))continue;
        g.position={x:n.x,y:n.y};g.strength='full';g.combatFull=10;g.combatReduced=5;
        d.position={x:h.x,y:h.y};d.strength='full';d.combatFull=4;d.combatReduced=2;
        const attacks=E.attackCandidates(c,t);
        if(attacks.some(a=>a.defender===d.id&&a.attackers.includes(g.id))){found={defender:d.id,attacker:g.id,defenderPoint:point(h.x,h.y)};break;}
      }
      if(found)break;
    }
    if(!found)throw Error('No legal defender-click combat fixture');
    s=t;selection=null;history=[];used.clear();combats.clear();combatChoice=null;render();
    return found;
  },
  shockFixture(){
    const t=E.makeState(c,141421,'automated');
    t.turn=4;t.side='soviet';t.phase='reinforcement';t.log=[];
    const shock=t.units.find(u=>u.army==='soviet'&&u.type==='shock');
    if(!shock)throw Error('No shock unit');
    shock.position=null;shock.strength='dead';
    const entries=E.shockReinforcementOptions(c,t);
    if(!entries.length)throw Error('No shock reinforcement hex available');
    s=t;selection=null;history=[];used.clear();combats.clear();combatChoice=null;render();
    return {id:shock.id,entries:entries.length,first:entries[0]};
  },
  fullHalfTurnFixture(){
    const t=E.makeState(c,424242,'automated');
    t.turn=2;t.side='german';t.phase='replacement';t.replacementUsed=0;t.log=[];
    s=t;selection=null;history=[];used.clear();combats.clear();combatChoice=null;render();
    return {turn:t.turn,side:t.side,phase:t.phase,seed:t.seed};
  },
  activeHalfTurnFixture(){
    const t=E.makeState(c,707071,'automated');
    t.turn=2;t.side='german';t.phase='replacement';t.replacementUsed=0;t.log=[];
    t.declaredBattles=[];
    for(const u of t.units){u.position=null;u.strength='dead';}
    const germans=t.units.filter(u=>u.army==='german');
    const soviet=t.units.find(u=>u.army==='soviet');
    const attacker=germans[0],mover=germans[1];
    if(!attacker||!mover||!soviet)throw Error('Missing active-half-turn units');
    let found=null;
    for(const h of c.raw.hexes){
      if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
      for(const adj of E.neighbours(c,h.x,h.y)){
        const ah=E.hexAt(c,adj.x,adj.y);
        if(!ah||ah.terrain!=='open'||(ah.city&&ah.city!=='none'))continue;
        attacker.position={x:adj.x,y:adj.y};attacker.strength='full';attacker.combatFull=10;attacker.combatReduced=5;
        soviet.position={x:h.x,y:h.y};soviet.strength='full';soviet.combatFull=4;soviet.combatReduced=2;
        for(const mh of c.raw.hexes){
          if(mh.terrain!=='open'||(mh.city&&mh.city!=='none'))continue;
          if(Math.abs(mh.x-h.x)+Math.abs(mh.y-h.y)<7)continue;
          mover.position={x:mh.x,y:mh.y};mover.strength='full';
          const opts=E.legalMoves(c,t,mover,'normal');
          const attack=E.attackCandidates(c,t).find(a=>a.defender===soviet.id&&a.attackers.includes(attacker.id));
          if(attack&&opts.length){
            found={attacker:attacker.id,defender:soviet.id,mover:mover.id,
              defenderPoint:point(h.x,h.y),moveFromPoint:point(mh.x,mh.y),
              moveToPoint:point(opts[0].x,opts[0].y),moveTo:{x:opts[0].x,y:opts[0].y}};
            break;
          }
        }
        if(found)break;
      }
      if(found)break;
    }
    if(!found)throw Error('No combined active-half-turn fixture');
    s=t;selection=null;history=[];used.clear();combats.clear();combatChoice=null;render();
    return found;
  },
  entryFixture(){
    const t=E.makeState(c,314159,'automated');
    t.turn=2;t.side='soviet';t.phase='replacement';t.replacementUsed=0;t.log=[];
    const a=E.replacementOptions(c,t).find(o=>o.type==='enter'&&t.units.find(u=>u.id===o.id)?.type!=='shock');
    if(!a)throw Error('No entry available');
    if(!E.applyReplacement(c,t,a))throw Error('Entry failed');
    t.replacementUsed=1;
    s=t;selection=null;history=[];used.clear();combats.clear();combatChoice=null;render();
    return {id:a.id,x:a.x,y:a.y,budget:E.replacementBudget(c,t)};
  }
};
'''

def canonical(obj):return json.dumps(obj,sort_keys=True,separators=(',',':'))
def digest(obj):return hashlib.sha256(canonical(obj).encode()).hexdigest()
def load(page,variant):
    html=(ROOT/'legacy/index.html').read_text()
    paths=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
    html=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
    page.set_content(html,wait_until='load')
    for rel in paths:
        path=(ROOT/'legacy'/rel).resolve()
        assert path.is_relative_to(ROOT)
        if rel=='engine.js' and variant=='frozen':path=ROOT/'legacy/engine-v316-frozen.js'
        source=path.read_text()
        if rel=='ui.js':
            assert source.rstrip().endswith('})();')
            source=source.rstrip()[:-5]+BRIDGE+'})();\n'
        page.add_script_tag(content=source)
    page.select_option('#mode','hotseat')

def click_hex(page,p):
    page.evaluate('''p=>{let e=document.getElementById('board'),r=e.getBoundingClientRect();
      e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+p.x*r.width/e.width,clientY:r.top+p.y*r.height/e.height}));}''',p)

def pair_state(pages,step,report,expect='equal'):
    a,b=[p.evaluate('window.__parity.inspect()') for p in pages]
    state_equal=canonical(a['state'])==canonical(b['state'])
    ui_equal=canonical(a['ui'])==canonical(b['ui'])
    rec={'step':step,'state_equal':state_equal,'ui_equal':ui_equal,'frozen_state_sha256':digest(a['state']),'current_state_sha256':digest(b['state']),'frozen_phase':a['state']['phase'],'current_phase':b['state']['phase'],'frozen_ui':a['ui'],'current_ui':b['ui']}
    report.append(rec)
    assert (state_equal and ui_equal) if expect=='equal' else (not state_equal or not ui_equal), f'{step}: expectation {expect} not met'
    return a,b

def run():
    with sync_playwright() as pw:
        bin=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').is_file() else pw.chromium.executable_path)
        browser=pw.chromium.launch(headless=True,executable_path=bin,args=['--no-sandbox'])
        contexts=[browser.new_context(viewport={'width':1600,'height':1000},device_scale_factor=1) for _ in range(2)]
        pages=[ctx.new_page() for ctx in contexts]
        errors=[[],[]]
        for i,p in enumerate(pages):
            p.on('pageerror',lambda e,i=i:errors[i].append(str(e)))
            load(p,['frozen','current'][i])
        report=[]
        # Accept alert dialogs so invalid phase transitions cannot stall the test.
        dialogs=[[],[]]
        for i,p in enumerate(pages):
            def accept_alert(d,i=i):
                dialogs[i].append(d.message)
                d.accept()
            p.on('dialog',accept_alert)
        initial=[p.evaluate('window.__parity.inspect()') for p in pages]
        pair_state(pages,'initial-hotseat-setup',report)
        # Premature confirmation of opening setup must be refused atomically.
        for p in pages:p.locator('#phase').click()
        rejected_setup=pair_state(pages,'reject-incomplete-setup',report)
        assert all(o['state']==initial[i]['state'] for i,o in enumerate(rejected_setup)), 'setup rejection altered game state'
        assert dialogs[0] and dialogs[0]==dialogs[1] and '22' in dialogs[0][-1],dialogs
        for p in pages:
            assert p.evaluate('window.__parity.inspect().state.phase')=='setup'
            assert p.evaluate('window.__parity.inspect().ui.undoDepth')==0

        starts=pages[0].evaluate('window.__parity.starts()')
        assert len(starts)==22
        # First placement, followed by a genuine UI undo, on both instances.
        for p in pages:
            p.locator('#options button').first.click()
            click_hex(p,starts[0]['p'])
        pair_state(pages,'manual-setup-one-counter',report)
        for p in pages:p.locator('#undo').click()
        pair_state(pages,'manual-setup-undo',report)
        # Complete the human setup with actual counter selection and board handlers.
        for hidx,h in enumerate(starts):
            for p in pages:
                p.locator('#options button').nth(hidx).click()
                click_hex(p,h['p'])
        pair_state(pages,'manual-setup-all-22',report)
        for p in pages:p.locator('#phase').click()
        pair_state(pages,'confirm-setup',report)
        for p in pages:p.locator('#undo').click()
        pair_state(pages,'undo-setup-confirmation',report)
        # Paired legal movement: select the unit on the actual canvas, click a
        # listed legal destination, Undo the move. Fixture creation only seeds
        # the starting state; action itself goes through original UI handlers.
        moves=[p.evaluate('window.__parity.movementFixture()') for p in pages]
        assert moves[0]==moves[1], f'movement fixture mismatch: {moves}'
        movement_start=pair_state(pages,'movement-start',report)
        # Wrong-side and empty-hex map clicks cannot move another faction's unit.
        for p in pages:
            click_hex(p,moves[0]['toPoint'])
        no_move=pair_state(pages,'movement-empty-destination-without-selection',report)
        assert all(o['state']==movement_start[i]['state'] for i,o in enumerate(no_move)), 'empty map click mutated movement state'
        for p in pages:click_hex(p,moves[0]['fromPoint'])
        selected=[p.evaluate('window.__parity.inspect()') for p in pages]
        assert selected[0]['state']==selected[1]['state']
        # A repeated click on the source hex may select it, but must not move it.
        for p in pages:click_hex(p,moves[0]['fromPoint'])
        repeat_source=pair_state(pages,'movement-repeated-source-click',report)
        assert all(o['state']==movement_start[i]['state'] for i,o in enumerate(repeat_source)), 'repeated source click moved unit'
        for p in pages:click_hex(p,moves[0]['toPoint'])
        moved_a,moved_b=pair_state(pages,'map-click-move',report)
        for obj in [moved_a,moved_b]:
            unit=next(u for u in obj['state']['units'] if u['id']==moves[0]['id'])
            assert unit['position']==moves[0]['to'],unit
        for p in pages:p.locator('#undo').click()
        pair_state(pages,'map-click-move-undo',report)
        # Defender-first attack declaration, then queue commit and die roll.
        battles=[p.evaluate('window.__parity.combatFixture()') for p in pages]
        assert battles[0]==battles[1]
        combat_start=pair_state(pages,'combat-declaration-start',report)
        # A defender click is a selection only; it cannot commit a battle alone.
        for p in pages:click_hex(p,battles[0]['defenderPoint'])
        selected_defender=pair_state(pages,'combat-defender-selected-only',report)
        assert all(o['state']==combat_start[i]['state'] for i,o in enumerate(selected_defender)), 'selecting defender committed battle'
        for p in pages:
            assert p.locator('#options button').filter(has_text=battles[0]['attacker']).count()>=1
            p.locator('#options button').filter(has_text=battles[0]['attacker']).first.click()
        declared_a,declared_b=pair_state(pages,'defender-click-declare',report)
        for obj in [declared_a,declared_b]:
            assert len(obj['state'].get('declaredBattles',[]))==1
            assert obj['state']['declaredBattles'][0]['defender']==battles[0]['defender']
        for p in pages:p.locator('#phase').click()
        combat_a,combat_b=pair_state(pages,'commit-combat-die',report)
        for obj in [combat_a,combat_b]:
            assert obj['state']['phase']=='combat-resolution'
            assert 1<=obj['state']['pendingBattle']['die']<=6
        for p in pages:p.locator('#undo').click()
        pair_state(pages,'commit-combat-undo',report)
        # Shock Army UI placement, followed by Undo.
        shocks=[p.evaluate('window.__parity.shockFixture()') for p in pages]
        assert shocks[0]==shocks[1]
        shock_start=pair_state(pages,'shock-reinforcement-start',report)
        # Explicit UI phase guard: do not skip required Shock placement.
        for p in pages:p.locator('#phase').click()
        shock_rejected=pair_state(pages,'reject-skipping-required-shock',report)
        assert all(o['state']==shock_start[i]['state'] for i,o in enumerate(shock_rejected)), 'Shock phase rejection mutated game state'
        assert dialogs[0]==dialogs[1] and 'Shock' in dialogs[0][-1],dialogs
        for p in pages:
            assert p.evaluate('window.__parity.inspect().state.phase')=='reinforcement'
            assert p.locator('#options button').filter(has_text='Place 1st Shock').count()==shocks[0]['entries']
            p.locator('#options button').filter(has_text='Place 1st Shock').first.click()
        shock_a,shock_b=pair_state(pages,'shock-place-button',report)
        for obj in [shock_a,shock_b]:
            unit=next(u for u in obj['state']['units'] if u['id']==shocks[0]['id'])
            assert unit['position']==shocks[0]['first']
            assert unit['strength']=='full'
        for p in pages:p.locator('#undo').click()
        pair_state(pages,'shock-place-undo',report)
        # Complete a human-controlled German half-turn through the actual UI
        # phase button, including optional phases which may legally be skipped.
        halves=[p.evaluate('window.__parity.fullHalfTurnFixture()') for p in pages]
        assert halves[0]==halves[1]
        pair_state(pages,'half-turn-replacement-start',report)
        for expected,step in [('special','half-turn-to-special'),('combat','half-turn-to-combat'),('movement','half-turn-to-movement')]:
            for p in pages:p.locator('#phase').click()
            aa,bb=pair_state(pages,step,report)
            assert aa['state']['phase']==bb['state']['phase']==expected,step
        for p in pages:p.locator('#phase').click()
        aa,bb=pair_state(pages,'half-turn-end-to-soviet',report)
        assert aa['state']['side']==bb['state']['side']=='soviet'
        assert aa['state']['phase']==bb['state']['phase']=='replacement'
        for p in pages:p.locator('#undo').click()
        aa,bb=pair_state(pages,'half-turn-undo-end',report)
        assert aa['state']['side']==bb['state']['side']=='german'
        assert aa['state']['phase']==bb['state']['phase']=='movement'
        # Invalid map actions were checked separately above. This is the
        # no-combat/no-move phase path, not a comprehensive active half-turn.
        # Contiguous active human half-turn: actual phase clicks, defender-first
        # declaration, result-dependent combat confirmation, and map movement.
        # A controlled legal position is injected before the FIRST action only.
        active=[p.evaluate('window.__parity.activeHalfTurnFixture()') for p in pages]
        assert active[0]==active[1],active
        pair_state(pages,'active-half-start-replacement',report)
        for expected,step in [('special','active-half-to-special'),('combat','active-half-to-combat')]:
            for p in pages:p.locator('#phase').click()
            a,b=pair_state(pages,step,report)
            assert a['state']['phase']==b['state']['phase']==expected
        for p in pages:
            click_hex(p,active[0]['defenderPoint'])
            assert p.locator('#options button').filter(has_text=active[0]['attacker']).count()>0
            p.locator('#options button').filter(has_text=active[0]['attacker']).first.click()
        a,b=pair_state(pages,'active-half-attack-declared',report)
        assert len(a['state'].get('declaredBattles',[]))==1
        for p in pages:p.locator('#phase').click()
        a,b=pair_state(pages,'active-half-die-committed',report)
        assert a['state']['phase']==b['state']['phase']=='combat-resolution'
        fixed_die=a['state']['pendingBattle']['die']
        for p in pages:p.locator('#options button').filter(has_text='Resolve with selected choices').click()
        a,b=pair_state(pages,'active-half-combat-resolved',report)
        assert a['state']['phase']==b['state']['phase']=='movement'
        assert a['state']['log']==b['state']['log']
        first_combat_sha=digest(a['state'])
        for p in pages:
            click_hex(p,active[0]['moveFromPoint'])
            click_hex(p,active[0]['moveToPoint'])
        a,b=pair_state(pages,'active-half-movement-done',report)
        for obj in [a,b]:
            unit=next(u for u in obj['state']['units'] if u['id']==active[0]['mover'])
            assert unit['position']==active[0]['moveTo'],unit
        for p in pages:p.locator('#phase').click()
        a,b=pair_state(pages,'active-half-ended',report)
        assert a['state']['side']==b['state']['side']=='soviet'
        assert a['state']['phase']==b['state']['phase']=='replacement'
        for p in pages:p.locator('#undo').click()
        a,b=pair_state(pages,'active-half-undo-end',report)
        assert a['state']['phase']==b['state']['phase']=='movement'
        for p in pages:p.locator('#undo').click()
        a,b=pair_state(pages,'active-half-undo-movement',report)
        for obj in [a,b]:
            unit=next(u for u in obj['state']['units'] if u['id']==active[0]['mover'])
            assert unit['position']!=active[0]['moveTo'],unit
        for p in pages:p.locator('#undo').click()
        a,b=pair_state(pages,'active-half-undo-combat',report)
        assert a['state']['phase']==b['state']['phase']=='combat-resolution'
        assert a['state']['pendingBattle']['die']==b['state']['pendingBattle']['die']==fixed_die
        for p in pages:p.locator('#options button').filter(has_text='Resolve with selected choices').click()
        a,b=pair_state(pages,'active-half-combat-replayed',report)
        assert a['state']['phase']==b['state']['phase']=='movement'
        assert digest(a['state'])==digest(b['state'])==first_combat_sha, 'combat replay drifted after Undo'
        # Controlled fixture: call each variant's own entry API; then inspect the
        # actual generated UI choices, which differ by deliberate user ruling.
        fixtures=[p.evaluate('window.__parity.entryFixture()') for p in pages]
        assert fixtures[0]==fixtures[1], f'entry fixture mismatch: {fixtures}'
        frozen,current=pair_state(pages,'entered-unit-in-same-replacement-phase',report,'different')
        unit=fixtures[0]['id']
        old=[n for n in frozen['ui']['optionNames'] if n==f'Restore {unit}']
        new=[n for n in current['ui']['optionNames'] if n==f'Restore {unit}']
        assert unit in frozen['restoreEligible'] and unit not in current['restoreEligible'], f'expected engine-API delta: {frozen["restoreEligible"]} vs {current["restoreEligible"]}'
        # The first 70 options are rendered; this legitimate option may be hidden
        # by the UI cap, so API parity and visible UI parity are separate metrics.
        visible=(bool(old),bool(new))
        assert canonical(frozen['state'])==canonical(current['state']), 'entry fixture game states diverged unexpectedly'
        assert not errors[0] and not errors[1],errors
        result={'schema':3,'reference':{'label':'local-frozen-v316','source':'legacy/engine-v316-frozen.js','sha256':hashlib.sha256((ROOT/'legacy/engine-v316-frozen.js').read_bytes()).hexdigest()},'candidate':{'label':'local-current-v317','source':'legacy/engine.js','sha256':hashlib.sha256((ROOT/'legacy/engine.js').read_bytes()).hexdigest()},'scope':'internal two-browser comparison; identical current UI on both engines; NOT upstream Oberlabs parity','test_cases':report,'intentional_differences':[{'step':'entered-unit-in-same-replacement-phase','unit':unit,'frozen_restore_api_eligible':True,'current_restore_api_eligible':False,'frozen_restore_button_visible':visible[0],'current_restore_button_visible':visible[1],'ruling':'No same-turn return and restore, approved by user on 2026-11-18'}],'invalid_action_alerts':dialogs,'all_assertions_passed':True}
        OUT.parent.mkdir(parents=True,exist_ok=True)
        OUT.write_text(json.dumps(result,indent=2)+'\n')
        for ctx in contexts:ctx.close()
        browser.close()
        print('PASS local dual-browser parity: '+str(len(report))+' checkpoints; movement, combat declaration, Shock reinforcement, expected replacement delta; '+str(OUT))

if __name__=='__main__':run()
