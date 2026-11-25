#!/usr/bin/env python3
"""Real Chromium UI parity: default Oberlabs movement vs opt-in shared session.

This compares two builds of the bundled local UI; it is not an upstream test.
"""
import os, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
html=(ROOT/'legacy/index.html').read_text()
scripts=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
shell=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
BRIDGE='''
window.__movementParity={
 snapshot:()=>JSON.parse(JSON.stringify(s)),
 meta:()=>({history:history.length,used:[...used],phase:s.phase,selection:selection?.id||null,opts:options().map(o=>({x:o.x,y:o.y}))}),
 fixture:()=>{const t=E.makeState(c,271828,'automated');t.turn=2;t.side='german';t.phase='movement';t.log=[];
 let found=null;
 for(const u of t.units.filter(u=>u.army==='german'&&u.position)){
  const moves=E.legalMoves(c,t,u,'normal');
  if(moves.length){found={id:u.id,from:point(u.position.x,u.position.y),to:point(moves[0].x,moves[0].y)};break;}
 }
 if(!found)throw Error('Missing legal movement fixture');
 s=t;selection=null;history=[];used.clear();combats.clear();combatChoice=null;render();return found;
}};
'''
def build(page,shared):
    errors=[]
    page.on('pageerror',lambda err:errors.append(str(err)))
    page.set_content(shell,wait_until='load')
    if shared:page.add_script_tag(content='window.B4M_SHARED_SESSION_MOVEMENT=true;')
    for relative in scripts:
        content=(ROOT/'legacy'/relative).resolve().read_text()
        if relative=='ui.js':
            assert content.rstrip().endswith('})();')
            content=content.rstrip()[:-5]+BRIDGE+'})();\n'
        page.add_script_tag(content=content)
    return errors

def run():
  with sync_playwright() as p:
    exe=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else p.chromium.executable_path)
    browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
    a,b=[browser.new_page(viewport={'width':1800,'height':1300}) for _ in range(2)]
    errs_a,errs_b=build(a,False),build(b,True)
    assert not errs_a and not errs_b,(errs_a,errs_b)
    for page in (a,b): page.select_option('#mode','hotseat')
    f=a.evaluate('window.__movementParity.fixture()')
    assert b.evaluate('window.__movementParity.fixture()')==f
    assert a.evaluate('window.__movementParity.snapshot()')==b.evaluate('window.__movementParity.snapshot()')
    checks=1
    before=a.evaluate('window.__movementParity.snapshot()')
    for page in (a,b):
      page.evaluate('''p=>{const rect=document.getElementById('board').getBoundingClientRect();
        const canvas=document.getElementById('board');
        for(const q of [p.from,p.to]){
          canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:rect.left+q.x*rect.width/canvas.width,clientY:rect.top+q.y*rect.height/canvas.height}));
        }
      }''',f)
    after=a.evaluate('window.__movementParity.snapshot()')
    assert after!=before,'Fixture did not move a unit'
    assert a.evaluate('window.__movementParity.snapshot()')==b.evaluate('window.__movementParity.snapshot()'),'Movement state divergence'
    assert a.evaluate('window.__movementParity.meta()')==b.evaluate('window.__movementParity.meta()'),'Movement UI metadata divergence'
    checks+=1
    assert f['id'] in a.evaluate('window.__movementParity.meta()')['used'],'Moved unit was not marked used'
    # Re-selecting the already-used counter cannot yield legal movement choices.
    for page in (a,b):
      page.evaluate('''p=>{const e=document.getElementById('board'),r=e.getBoundingClientRect();
        e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+p.x*r.width/e.width,clientY:r.top+p.y*r.height/e.height}));}''',f['to'])
    assert a.evaluate('window.__movementParity.snapshot()')==b.evaluate('window.__movementParity.snapshot()')==after
    checks+=1
    for page in (a,b):page.locator('#undo').click(timeout=2500)
    assert a.evaluate('window.__movementParity.snapshot()')==b.evaluate('window.__movementParity.snapshot()'),'Undo state divergence'
    assert a.evaluate('window.__movementParity.meta()')==b.evaluate('window.__movementParity.meta()'),'Undo metadata divergence'
    assert a.evaluate('window.__movementParity.snapshot()')==before,'Undo did not restore starting game state'
    checks+=1
    # Replay via the actual map click handlers after Undo.
    for page in (a,b):
      page.evaluate('''p=>{const e=document.getElementById('board'),r=e.getBoundingClientRect();
        for(const q of [p.from,p.to])e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+q.x*r.width/e.width,clientY:r.top+q.y*r.height/e.height}));}''',f)
    assert a.evaluate('window.__movementParity.snapshot()')==b.evaluate('window.__movementParity.snapshot()')==after
    checks+=1
    assert not errs_a and not errs_b,(errs_a,errs_b)
    browser.close()
  print(f'PASS browser shared-session movement pilot: {checks} parity checkpoints (fixture, move, used-unit rejection, Undo, replay)')
if __name__=='__main__':run()
