#!/usr/bin/env python3
"""Opt-in session-owned browser movement/phase/Undo vs bundled legacy UI.

Uses the real UI map and phase buttons in two Chromium contexts. Does not
claim independent upstream Oberlabs parity or full combat UI migration.
"""
import os, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
html=(ROOT/'legacy/index.html').read_text()
scripts=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
shell=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
BRIDGE='''
window.__ownershipParity={
 state:()=>JSON.parse(JSON.stringify(s)),
 meta:()=>({phase:s.phase,side:s.side,turn:s.turn,used:[...used].sort(),
  history:window.B4M_SHARED_SESSION_OWNERSHIP_PILOT&&ownedSession?ownedSession.history.length:history.length,
  selection:selection?.id||null}),
 fixture:()=>{const t=E.makeState(c,271828,'automated');t.turn=2;t.side='german';t.phase='movement';t.log=[];
  let found=null;
  for(const u of t.units.filter(u=>u.army==='german'&&u.position)){
   const moves=E.legalMoves(c,t,u,'normal');
   if(moves.length){found={id:u.id,from:point(u.position.x,u.position.y),to:point(moves[0].x,moves[0].y)};break;}
  }
  if(!found)throw Error('Missing legal movement fixture');
  s=t;selection=null;history=[];used.clear();combats.clear();combatChoice=null;ownedSession=null;render();return found;
 }
};
'''
def build(page,owned):
 errors=[]
 page.on('pageerror',lambda err:errors.append(str(err)))
 page.set_content(shell,wait_until='load')
 if owned:page.add_script_tag(content='window.B4M_SHARED_SESSION_OWNERSHIP_PILOT=true;')
 for relative in scripts:
  content=(ROOT/'legacy'/relative).resolve().read_text()
  if relative=='ui.js':
   assert content.rstrip().endswith('})();')
   content=content.rstrip()[:-5]+BRIDGE+'})();\n'
  page.add_script_tag(content=content)
 return errors

def click_map(page,p):
 page.evaluate('''p=>{const e=document.getElementById('board'),r=e.getBoundingClientRect();
  e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+p.x*r.width/e.width,clientY:r.top+p.y*r.height/e.height}));}''',p)

def assert_parity(a,b,label):
 sa,sb=(p.evaluate('window.__ownershipParity.state()') for p in (a,b))
 ma,mb=(p.evaluate('window.__ownershipParity.meta()') for p in (a,b))
 assert sa==sb,(label,'game states differ')
 assert ma==mb,(label,ma,mb)
 return sa

def main():
 with sync_playwright() as p:
  exe=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else p.chromium.executable_path)
  browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
  a,b=[browser.new_page(viewport={'width':1800,'height':1300}) for _ in range(2)]
  ea,eb=build(a,False),build(b,True)
  for page in (a,b):page.select_option('#mode','hotseat')
  f=a.evaluate('window.__ownershipParity.fixture()')
  assert b.evaluate('window.__ownershipParity.fixture()')==f
  before=assert_parity(a,b,'fixture');checks=1
  for page in (a,b):
   click_map(page,f['from']);click_map(page,f['to'])
  after_move=assert_parity(a,b,'movement');checks+=1
  assert before!=after_move
  assert f['id'] in a.evaluate('window.__ownershipParity.meta()')['used']
  for page in (a,b):page.locator('#phase').click()
  after_phase=assert_parity(a,b,'phase transition');checks+=1
  assert a.evaluate('window.__ownershipParity.meta()')['phase']!='movement'
  # Undo of phase transition must restore the used-unit set from the movement phase.
  for page in (a,b):page.locator('#undo').click()
  assert a.evaluate('window.__ownershipParity.state()')==b.evaluate('window.__ownershipParity.state()')==after_move
  assert f['id'] in b.evaluate('window.__ownershipParity.meta()')['used']
  assert f['id'] not in a.evaluate('window.__ownershipParity.meta()')['used']  # documented legacy divergence
  checks+=1
  # A used unit still cannot move a second time after Undo across the phase boundary.
  for page in (a,b):click_map(page,f['to'])
  assert a.evaluate('window.__ownershipParity.state()')==b.evaluate('window.__ownershipParity.state()')==after_move
  checks+=1
  # Undo movement restores the starting state and clears per-phase use.
  for page in (a,b):page.locator('#undo').click()
  assert a.evaluate('window.__ownershipParity.state()')==b.evaluate('window.__ownershipParity.state()')==before;checks+=1
  for page in (a,b):
   click_map(page,f['from']);click_map(page,f['to']);page.locator('#phase').click()
  assert assert_parity(a,b,'replay move+phase')==after_phase;checks+=1
  assert not ea and not eb,(ea,eb)
  browser.close()
 print(f'PASS shared browser session ownership pilot: {checks} checkpoints')
if __name__=='__main__':main()
