#!/usr/bin/env python3
"""Compare actual B4M browser declaration, die commitment, resolution, Undo.
The test-only fixture sets up a legal adjacent engagement; the UI buttons are real.
This compares bundled legacy against opt-in shared sessions, not upstream Oberlabs.
"""
import os, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
html=(ROOT/'legacy/index.html').read_text()
scripts=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
shell=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
BRIDGE=r'''
window.__combatParity={
 state:()=>JSON.parse(JSON.stringify(s)),
 meta:()=>({history:ownedSession?ownedSession.history.length:history.length,phase:s.phase,die:s.pendingBattle?.die||null,queue:s.combatQueue?.length||0}),
 fixture:()=>{
  const t=E.makeState(c,4599,'automated'); t.turn=2;t.side='german';t.phase='combat';t.log=[];
  for(const u of t.units){u.position=null;u.strength='dead';}
  const gs=t.units.filter(u=>u.army==='german').slice(0,2);
  const ds=t.units.filter(u=>u.army==='soviet').slice(0,2);
  const locations=[];
  for(const h of c.raw.hexes){
   if(h.terrain!=='open'||h.city&&h.city!=='none')continue;
   if(locations.some(p=>E.dist(p.h.x,p.h.y,h.x,h.y)<4))continue;
   let candidate=null;
   for(const n of E.neighbours(c,h.x,h.y)){
    const q=E.hexAt(c,n.x,n.y);
    if(!q||q.terrain!=='open'||q.city&&q.city!=='none')continue;
    const i=locations.length,g=gs[i],d=ds[i];
    g.position={x:n.x,y:n.y};d.position={x:h.x,y:h.y};
    Object.assign(g,{strength:'full',combatFull:8,combatReduced:4});
    Object.assign(d,{strength:'full',combatFull:2,combatReduced:1});
    if(E.attackCandidates(c,t).some(a=>a.defender===d.id&&a.attackers.length===1&&a.attackers[0]===g.id)){
     candidate={h,defender:d.id,attacker:g.id,location:point(h.x,h.y)};break;
    }
    g.position=null;d.position=null;
   }
   if(candidate)locations.push(candidate);
   if(locations.length===2)break;
  }
  if(locations.length!==2)throw Error('no two independent combat fixtures');
  const found=locations.map(({defender,attacker,location})=>({defender,attacker,location}));
  s=t;history=[];ownedSession=null;selection=null;combatChoice=null;used.clear();combats.clear();render();return found;
 }
};
'''
def build(page,owned):
 errs=[];page.on('pageerror',lambda error:errs.append(str(error)))
 page.set_content(shell,wait_until='load')
 if owned:page.add_script_tag(content='window.B4M_SHARED_SESSION_OWNERSHIP_PILOT=true;')
 for rel in scripts:
  path=(ROOT/'legacy'/rel).resolve();source=path.read_text()
  if rel=='ui.js':
   assert source.rstrip().endswith('})();')
   source=source.rstrip()[:-5]+BRIDGE+'})();\n'
  page.add_script_tag(content=source)
 page.select_option('#mode','hotseat')
 return errs
def snap(page):return page.evaluate('window.__combatParity.state()')
def meta(page):return page.evaluate('window.__combatParity.meta()')
def click_hex(page,center):
 page.evaluate('''p=>{const e=document.getElementById('board'),r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+p.x*r.width/e.width,clientY:r.top+p.y*r.height/e.height}));}''',center)
def main():
 checks=0
 with sync_playwright() as p:
  exe=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else p.chromium.executable_path)
  browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
  a,b=[browser.new_page(viewport={'width':1600,'height':1100}) for _ in range(2)]
  errs=[build(a,False),build(b,True)]
  info=a.evaluate('window.__combatParity.fixture()');assert b.evaluate('window.__combatParity.fixture()')==info
  initial=snap(a);assert initial==snap(b);checks+=1
  for row in info:
   for page in (a,b):
    click_hex(page,row['location'])
    options=page.locator('#options button').filter(has_text=row['attacker'])
    assert options.count(),f"no combat choice for {row}"
    options.first.click()
   assert snap(a)==snap(b) and len(snap(a)['declaredBattles'])==info.index(row)+1;checks+=1
  declared=snap(a)
  for page in (a,b):page.locator('#phase').click()
  first=snap(a);assert first==snap(b) and first['combatIndex']==0 and first['pendingBattle']['die'] in range(1,7);checks+=1
  for page in (a,b):page.get_by_role('button',name='Resolve with selected choices').click()
  second=snap(a);assert second==snap(b) and second['combatIndex']==1 and second['pendingBattle']['die'] in range(1,7);checks+=1
  for page in (a,b):page.get_by_role('button',name='Resolve with selected choices').click()
  final=snap(a);assert final==snap(b) and final['phase']=='movement';checks+=1
  for page in (a,b):page.locator('#undo').click()
  assert snap(a)==snap(b)==second;checks+=1
  for page in (a,b):page.get_by_role('button',name='Resolve with selected choices').click()
  assert snap(a)==snap(b)==final;checks+=1
  for page in (a,b):page.locator('#undo').click();page.locator('#undo').click()
  assert snap(a)==snap(b)==first;checks+=1
  for page in (a,b):page.get_by_role('button',name='Resolve with selected choices').click()
  assert snap(a)==snap(b)==second;checks+=1
  for page in (a,b):page.locator('#undo').click();page.locator('#undo').click()
  assert snap(a)==snap(b)==declared;checks+=1
  for page in (a,b):page.locator('#undo').click();page.locator('#undo').click()
  assert snap(a)==snap(b)==initial;checks+=1
  assert not errs[0] and not errs[1],errs
  browser.close()
 print(f'PASS shared-session TWO-BATTLE browser parity: {checks} checkpoints')
if __name__=='__main__':main()
