#!/usr/bin/env python3
"""Two-local-browser parity: active replacement entry + Panzer special move + combat + normal move + Undo.

Controlled setup fixture uses actual production B4M legalMoves/replacementOptions.
This does not constitute independent upstream Oberlabs verification.
"""
import importlib.util, os, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('mixed',ROOT/'tests/b4m-browser-session-mixed-turn-v317.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
EXT='''
window.__activeMixed={
 fixture(){
   const base=window.__parity.activeHalfTurnFixture();
   const tank=s.units.find(u=>u.army==='german'&&u.type==='tank'&&u.id!==base.attacker&&u.id!==base.mover);
   if(!tank)throw Error('No spare panzer for special movement');
   let found=null;
   for(const h of c.raw.hexes){
     if(h.terrain!=='open'||(h.city&&h.city!=='none')||E.occupant(s,h.x,h.y))continue;
     tank.position={x:h.x,y:h.y};tank.strength='reduced';
     const restore=E.replacementOptions(c,s).find(o=>o.type==='restore'&&o.id===tank.id);
     const moves=E.legalMoves(c,s,tank,'panzer');
     if(restore&&moves.length){found={tankId:tank.id,from:point(h.x,h.y),to:point(moves[0].x,moves[0].y),toHex:{x:moves[0].x,y:moves[0].y}};break;}
   }
   if(!found)throw Error('No legal restore + Panzer special-movement fixture');
   selection=null;history=[];ownedSession=null;used.clear();combats.clear();combatChoice=null;render();
   return {...base,...found};
 },
 specialDestination(id){const u=s.units.find(v=>v.id===id),choices=E.legalMoves(c,s,u,'panzer');if(!choices.length)throw Error('Replacement blocked every Panzer move');return {point:point(choices[0].x,choices[0].y),hex:{x:choices[0].x,y:choices[0].y}};},
 state:()=>JSON.parse(JSON.stringify(s)),
 meta:()=>({used:[...used].sort(),session:ownedSession?ownedSession.history.length:null})
};
'''
html=(ROOT/'legacy/index.html').read_text()
scripts=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
shell=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
def build(page,pilot):
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(shell,wait_until='load')
 if pilot:page.add_script_tag(content='window.B4M_SHARED_SESSION_OWNERSHIP_PILOT=true;')
 for rel in scripts:
  script=(ROOT/'legacy'/rel).resolve().read_text()
  if rel=='ui.js':
   assert script.rstrip().endswith('})();')
   script=script.rstrip()[:-5]+m.module.BRIDGE+EXT+'})();\n'
  page.add_script_tag(content=script)
 page.select_option('#mode','hotseat')
 return errors

def main():
 with sync_playwright() as p:
  exe=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else p.chromium.executable_path)
  browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
  a,b=[browser.new_page(viewport={'width':1600,'height':1100}) for _ in range(2)]
  errors=[build(a,False),build(b,True)];checks=0
  def compare(label):
   nonlocal checks
   x,y=[pg.evaluate('window.__activeMixed.state()') for pg in (a,b)]
   assert x==y,f'{label}: states differ';checks+=1;return x
  fixtures=[pg.evaluate('window.__activeMixed.fixture()') for pg in (a,b)]
  assert fixtures[0]==fixtures[1];f=fixtures[0]
  compare('start')
  # Select an actual *visible* replacement entry. The source UI currently
  # truncates options to 70 entries, so a restore option may be hidden.
  entries=[pg.locator('#options button').filter(has_text=re.compile('^Enter ')) for pg in (a,b)]
  assert all(btn.count()>0 for btn in entries)
  entry_texts=[btn.first.inner_text() for btn in entries]
  assert entry_texts[0]==entry_texts[1]
  entrant=entry_texts[0].split()[1]
  for btn in entries:btn.first.click()
  state=compare('replacement entry')
  assert state['replacementUsed']==1
  assert next(u for u in state['units'] if u['id']==entrant)['position'] is not None
  destinations=[pg.evaluate('window.__activeMixed.specialDestination('+repr(f['tankId'])+')') for pg in (a,b)]
  assert destinations[0]==destinations[1];dest=destinations[0]
  for pg in (a,b):pg.locator('#phase').click()
  assert compare('special phase')['phase']=='special'
  for pg in (a,b):m.hit(pg,f['from']);m.hit(pg,dest['point'])
  state=compare('special move')
  assert next(u for u in state['units'] if u['id']==f['tankId'])['position']==dest['hex']
  for pg in (a,b):pg.locator('#phase').click()
  assert compare('combat phase')['phase']=='combat'
  for pg in (a,b):
   m.hit(pg,f['defenderPoint']);pg.locator('#options button').filter(has_text=f['attacker']).first.click()
  assert len(compare('declare')['declaredBattles'])==1
  for pg in (a,b):pg.locator('#phase').click()
  committed=compare('die');die=committed['pendingBattle']['die']
  for pg in (a,b):pg.get_by_role('button',name='Resolve with selected choices').click()
  resolved=compare('resolve');assert resolved['phase']=='movement'
  for pg in (a,b):m.hit(pg,f['moveFromPoint']);m.hit(pg,f['moveToPoint'])
  assert next(u for u in compare('ordinary move')['units'] if u['id']==f['mover'])['position']==f['moveTo']
  for pg in (a,b):pg.locator('#phase').click()
  assert compare('turn transition')['side']=='soviet'
  for pg in (a,b):pg.locator('#undo').click()
  compare('undo transition')
  for pg in (a,b):pg.locator('#undo').click()
  compare('undo ordinary move')
  for pg in (a,b):pg.locator('#undo').click()
  undone=compare('undo combat');assert undone['pendingBattle']['die']==die
  for pg in (a,b):pg.get_by_role('button',name='Resolve with selected choices').click()
  assert compare('replay combat')==resolved
  # Reverse actions in the same persistent history, including the active special
  # move and replacement that preceded combat. Game-state parity is checked;
  # the documented legacy-vs-shared used-unit reset remains a separate issue.
  for label in ('undo replayed combat','undo die commitment','undo declaration',
                'undo combat phase','undo special move','undo replacement phase','undo replacement entry'):
   for pg in (a,b):pg.locator('#undo').click()
   compare(label)
  assert not any(errors),errors
  browser.close()
 print(f'PASS active replacement entry + special + combat + movement local browser parity: {checks} checkpoints')
if __name__=='__main__':main()
