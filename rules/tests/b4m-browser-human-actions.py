#!/usr/bin/env python3
"""Browser characterization of actual setup map clicks, phases and replacement actions.

Uses shipped UI and event handlers; no fabricated positions for the manual-setup case.
A constrained test-only state fixture is used solely for replacement phase coverage.
Not independent upstream Oberlabs evidence.
"""
import os
import pathlib
import re
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parents[2]
BRIDGE = r'''
window.__B4MHumanActions = {
 inspect(){return {state:JSON.parse(JSON.stringify(s)),selection:selection?{...selection}:null,undoDepth:history.length};},
 starts(){return c.raw.hexes.filter(h=>h.germanStart).map(h=>({x:h.x,y:h.y,p:point(h.x,h.y)}));},
 coords(x,y){return point(x,y);},
 installReplacement(){
  const base=E.makeState(c,314159,'automated');
  base.turn=2;base.side='soviet';base.phase='replacement';base.log=[];
  base.replacementUsed=0;
  const unit=base.units.find(u=>u.army==='soviet'&&u.type!=='shock'&&u.position);
  if(!unit)throw Error('No Soviet unit available');
  unit.strength='reduced';
  s=base;selection=null;history=[];used.clear();combats.clear();combatChoice=null;render();
  const available=E.replacementOptions(c,s).find(r=>r.type==='restore'&&r.id===unit.id);
  if(!available)throw Error('No legal restore option in test position');
  return {unit:unit.id,budget:E.replacementBudget(c,s)};
 }
};
'''

def run():
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,executable_path=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').is_file() else p.chromium.executable_path),args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1600,'height':1000})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        html=(ROOT/'legacy/index.html').read_text()
        paths=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
        html=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
        page.set_content(html,wait_until='load')
        for rel in paths:
            path=(ROOT/'legacy'/rel).resolve()
            assert path.is_relative_to(ROOT)
            source=path.read_text()
            if path==ROOT/'legacy/ui.js':
                assert source.rstrip().endswith('})();')
                source=source.rstrip()[:-5]+BRIDGE+'})();\n'
            page.add_script_tag(content=source)
        page.select_option('#mode','hotseat')
        assert 'setup' in page.locator('#statusPill').inner_text()
        starts=page.evaluate('window.__B4MHumanActions.starts()')
        assert len(starts)==22
        first=page.locator('#options button').first
        first.click()
        chosen=page.evaluate('window.__B4MHumanActions.inspect().selection.id')
        assert chosen
        # Click through the same browser board canvas event handler used by a human.
        # Dispatching with correct client coordinates avoids relying on the test host's viewport.
        def board_click(point):
            page.evaluate('''p=>{const el=document.getElementById('board'),r=el.getBoundingClientRect();
              el.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+p.x*r.width/el.width,clientY:r.top+p.y*r.height/el.height}));}''',point)
        board_click(starts[0]['p'])
        placed=page.evaluate('window.__B4MHumanActions.inspect()')
        assert any(u['id']==chosen and u.get('position')=={'x':starts[0]['x'],'y':starts[0]['y']} for u in placed['state']['units'])
        assert placed['undoDepth']>=1
        page.locator('#undo').click()
        reverted=page.evaluate('window.__B4MHumanActions.inspect()')
        assert all(u['id']!=chosen or u.get('position')!={'x':starts[0]['x'],'y':starts[0]['y']} for u in reverted['state']['units'])
        # Complete setup using the controls and board clicks, not an injected setup state.
        for j,h in enumerate(starts):
            buttons=page.locator('#options button')
            label=buttons.nth(j).inner_text()
            unit_id=label.split(' · ')[0].replace('● ','')
            buttons.nth(j).click()
            board_click(h['p'])
        ready=page.evaluate('window.__B4MHumanActions.inspect()')
        assert sum(1 for u in ready['state']['units'] if u['army']=='german' and u.get('position'))==22
        page.locator('#phase').click()
        stage=page.evaluate('window.__B4MHumanActions.inspect()')
        assert stage['state']['setupDone'] and stage['state']['phase']=='combat'
        page.locator('#undo').click()
        assert page.evaluate('window.__B4MHumanActions.inspect().state.phase')=='setup'
        # Replacement stage is seeded using an otherwise valid engine state; button is real.
        repl=page.evaluate('window.__B4MHumanActions.installReplacement()')
        before=page.evaluate('window.__B4MHumanActions.inspect()')
        page.get_by_role('button',name=f"Restore {repl['unit']}",exact=True).click()
        after=page.evaluate('window.__B4MHumanActions.inspect()')
        unit=next(u for u in after['state']['units'] if u['id']==repl['unit'])
        assert unit['strength']=='full'
        assert after['state']['replacementUsed']==1
        page.locator('#undo').click()
        undone=page.evaluate('window.__B4MHumanActions.inspect()')
        assert undone['state']==before['state']
        assert not errors,errors
        browser.close()
        print('PASS Chromium: setup counter selection -> map click -> Undo; 22-counter manual placement -> confirm -> Undo; replacement button -> Undo')

if __name__=='__main__':run()
