#!/usr/bin/env python3
"""Real Chromium/UI regression against legacy B4M, with a test-only scenario fixture injector.

Requires Python Playwright and a locally available Chromium. The shipped UI is unchanged;
the route intercept injects the test bridge into the IIFE before it executes.
This is NOT a comparison against the independent Oberlabs website.
"""
import os
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
BRIDGE = r'''
window.__B4MBrowserTest = {
 inspect(){return {state:JSON.parse(JSON.stringify(s)),choices:combatChoice?JSON.parse(JSON.stringify(combatChoice)):null,undoDepth:history.length};},
 install(target,queued=false){
   const base=E.makeState(c,813701,'manual');
   base.side='german';base.turn=2;base.phase='combat-resolution';base.log=[];
   for(const u of base.units){u.position=null;u.strength='dead';}
   const g=base.units.filter(u=>u.army==='german')[0];
   const d=base.units.filter(u=>u.army==='soviet')[0];
   let found=null;
   for(const h of c.raw.hexes){
     if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
     for(const n of E.neighbours(c,h.x,h.y)){
       const ahex=E.hexAt(c,n.x,n.y);
       if(!ahex||ahex.terrain!=='open'||(ahex.city&&ahex.city!=='none'))continue;
       g.position={x:n.x,y:n.y};d.position={x:h.x,y:h.y};
       d.combatFull=4;d.combatReduced=2;d.strength='full';
       for(let attack=2;attack<=36;attack++){
         g.combatFull=attack;g.combatReduced=Math.max(1,Math.floor(attack/2));g.strength='full';
         const a={attackers:[g.id],defender:d.id};
         for(let die=1;die<=6;die++){
           const p=E.battlePreview(c,base,a,die);
           if(p?.outcome===target){found={a,die,p};break;}
         }
         if(found)break;
       }
       if(found)break;
     }
     if(found)break;
   }
   if(!found)throw Error('No fixture for '+target);
   base.combatQueue=[found.a];base.combatIndex=0;
   if(queued){
     const g2=base.units.filter(u=>u.army==='german')[1];
     const d2=base.units.filter(u=>u.army==='soviet')[1];
     let second=null;
     for(const h of c.raw.hexes){
       if(h.terrain!=='open'||(h.city&&h.city!=='none'))continue;
       if(Math.abs(h.x-d.position.x)+Math.abs(h.y-d.position.y)<9)continue;
       for(const n of E.neighbours(c,h.x,h.y)){
         const ah=E.hexAt(c,n.x,n.y);
         if(!ah||ah.terrain!=='open'||(ah.city&&ah.city!=='none'))continue;
         g2.position={x:n.x,y:n.y};d2.position={x:h.x,y:h.y};
         Object.assign(g2,{combatFull:8,combatReduced:4,strength:'full'});
         Object.assign(d2,{combatFull:4,combatReduced:2,strength:'full'});
         const a={attackers:[g2.id],defender:d2.id};
         if(E.battlePreview(c,base,a,3)){second=a;break;}
       }
       if(second)break;
     }
     if(!second)throw Error('Could not build second queued combat');
     base.combatQueue.push(second);
   }
   // Emulate the UI's die-commit state and preserve its PRNG position.
   base.pendingBattle={action:found.a,die:found.die};
   s=base;history=[];selection=null;combatChoice=null;used.clear();combats.clear();
   render();
   return {outcome:found.p.outcome,die:found.die,attacker:found.a.attackers[0],defender:found.a.defender};
 }
};
'''

def run():
    checked=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').is_file() else p.chromium.executable_path),args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':900})
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        # Navigation is blocked in some sandboxed Chromium environments.
        # Load the actual HTML and every local script in authored order on about:blank.
        import re
        html=(ROOT/'legacy/index.html').read_text()
        paths=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
        html=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
        page.set_content(html,wait_until='load')
        for rel in paths:
            path=(ROOT/'legacy'/rel).resolve()
            assert path.is_relative_to(ROOT)
            source=path.read_text()
            if path==(ROOT/'legacy/ui.js'):
                assert source.rstrip().endswith('})();'), 'Bridge injection location changed'
                source=source.rstrip()[:-5]+BRIDGE+'})();\n'
            page.add_script_tag(content=source)
        page.select_option('#mode','hotseat')
        assert page.locator('#statusPill').inner_text().startswith('Turn 1'), 'UI did not initialize'
        for outcome in ['AL','NE','DR','EX','DRL','DE']:
            info=page.evaluate('v=>window.__B4MBrowserTest.install(v)',outcome)
            assert info['outcome']==outcome
            assert f'→ {outcome}' in page.locator('#options .battle-info').inner_text()
            assert page.locator('#phase').is_enabled()
            assert not page.locator('#undo').is_enabled()
            if outcome=='AL':
                assert page.get_by_text('Attacker loss recipient').count()==1
            if outcome=='EX':
                assert page.get_by_text('Exchange loss priority').count()==1
            if outcome in ['DR','DRL','EX']:
                assert page.get_by_text('Defender retreat destination').count()==1 or page.get_by_text('Defender retreat destination').count()==0
            before=page.evaluate('window.__B4MBrowserTest.inspect()')
            page.get_by_role('button',name='Resolve with selected choices').click()
            after=page.evaluate('window.__B4MBrowserTest.inspect()')
            assert after['state']['log'][-1]['outcome']==outcome, (outcome,after['state']['log'][-1])
            assert after['undoDepth']==1
            assert page.locator('#undo').is_enabled()
            page.locator('#undo').click()
            restored=page.evaluate('window.__B4MBrowserTest.inspect()')
            assert restored['state']==before['state'],f'{outcome} undo state differs'
            assert restored['state']['pendingBattle']['die']==info['die']
            assert restored['undoDepth']==0
            assert restored['choices']['advanceId']=='none'
            page.get_by_role('button',name='Resolve with selected choices').click()
            replay=page.evaluate('window.__B4MBrowserTest.inspect()')
            assert replay['state']==after['state'],f'{outcome} replay differs'
            checked.append(outcome)
        # Two successive UI-declared combats, with a genuine PRNG roll for battle 2.
        page.evaluate("window.__B4MBrowserTest.install('NE',true)")
        initial=page.evaluate('window.__B4MBrowserTest.inspect()')
        assert 'Battle 1/2' in page.locator('#options .battle-info').inner_text()
        page.get_by_role('button',name='Resolve with selected choices').click()
        pending2=page.evaluate('window.__B4MBrowserTest.inspect()')
        assert pending2['state']['combatIndex']==1
        assert pending2['undoDepth']==1
        assert len(pending2['state']['log'])==1
        assert 'Battle 2/2' in page.locator('#options .battle-info').inner_text()
        second_die=pending2['state']['pendingBattle']['die']
        second_seed=pending2['state']['seed']
        page.get_by_role('button',name='Resolve with selected choices').click()
        both=page.evaluate('window.__B4MBrowserTest.inspect()')
        assert len(both['state']['log'])==2
        assert both['undoDepth']==2
        page.locator('#undo').click()
        restore2=page.evaluate('window.__B4MBrowserTest.inspect()')
        assert restore2['state']==pending2['state']
        assert restore2['state']['pendingBattle']['die']==second_die
        assert restore2['state']['seed']==second_seed
        assert len(restore2['state']['log'])==1
        page.get_by_role('button',name='Resolve with selected choices').click()
        re_both=page.evaluate('window.__B4MBrowserTest.inspect()')
        assert re_both['state']==both['state']
        page.locator('#undo').click()
        page.locator('#undo').click()
        back1=page.evaluate('window.__B4MBrowserTest.inspect()')
        assert back1['state']==initial['state']
        assert back1['undoDepth']==0
        checked.append('2-combat queue + nested Undo')
        assert not errors,errors
        browser.close()
        print('PASS real Chromium combat resolve / Undo / replay: '+', '.join(checked))

if __name__=='__main__':
    run()
