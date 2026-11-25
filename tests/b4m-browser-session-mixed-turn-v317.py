#!/usr/bin/env python3
"""Local two-browser comparison of a continuous B4M human turn with mixed actions.
Uses real UI controls, controlled legal initial fixture, and the bundled legacy
UI as reference. This is not upstream Oberlabs validation.
"""
import importlib.util, os, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
source=ROOT/'rules/tests/b4m-dual-browser-parity.py'
spec=importlib.util.spec_from_file_location('b4m_existing_fixtures',source)
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
html=(ROOT/'legacy/index.html').read_text()
scripts=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
shell=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
bridge=module.BRIDGE+'''\nwindow.__mixed={state:()=>JSON.parse(JSON.stringify(s)), meta:()=>({used:[...used].sort(),history:ownedSession?ownedSession.history.length:history.length,pendingDie:s.pendingBattle?.die??null})};\n'''
def build(page,pilot):
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(shell,wait_until='load')
 if pilot:page.add_script_tag(content='window.B4M_SHARED_SESSION_OWNERSHIP_PILOT=true;')
 for relative in scripts:
  text=(ROOT/'legacy'/relative).resolve().read_text()
  if relative=='ui.js':
   assert text.rstrip().endswith('})();')
   text=text.rstrip()[:-5]+bridge+'})();\n'
  page.add_script_tag(content=text)
 page.select_option('#mode','hotseat')
 return errors
def hit(page,p):
 page.evaluate('''p=>{const e=document.getElementById('board'),r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+p.x*r.width/e.width,clientY:r.top+p.y*r.height/e.height}));}''',p)
def main():
 checks=0
 with sync_playwright() as p:
  exe=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else p.chromium.executable_path)
  browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
  a,b=[browser.new_page(viewport={'width':1600,'height':1100}) for _ in range(2)]
  errs=[build(a,False),build(b,True)]
  def compare(name):
   nonlocal checks
   sa,sb=[pg.evaluate('window.__mixed.state()') for pg in (a,b)]
   assert sa==sb,(name,sa.get('phase'),sb.get('phase'),sa.get('seed'),sb.get('seed'))
   checks+=1
   return sa
  fixtures=[pg.evaluate('window.__parity.activeHalfTurnFixture()') for pg in (a,b)]
  assert fixtures[0]==fixtures[1];f=fixtures[0]
  compare('fixture')
  for phase in ('special','combat'):
   for pg in (a,b):pg.locator('#phase').click()
   assert compare('phase-'+phase)['phase']==phase
  for pg in (a,b):
   hit(pg,f['defenderPoint']);pg.locator('#options button').filter(has_text=f['attacker']).first.click()
  assert len(compare('declared')['declaredBattles'])==1
  for pg in (a,b):pg.locator('#phase').click()
  pending=compare('committed');die=pending['pendingBattle']['die']
  for pg in (a,b):pg.get_by_role('button',name='Resolve with selected choices').click()
  resolved=compare('resolved');assert resolved['phase']=='movement'
  for pg in (a,b):hit(pg,f['moveFromPoint']);hit(pg,f['moveToPoint'])
  moved=compare('moved');assert next(x for x in moved['units'] if x['id']==f['mover'])['position']==f['moveTo']
  for pg in (a,b):pg.locator('#phase').click()
  assert compare('end-half')['side']=='soviet'
  for pg in (a,b):pg.locator('#undo').click()
  assert compare('undo-end')['phase']=='movement'
  for pg in (a,b):pg.locator('#undo').click()
  assert compare('undo-move')['phase']=='movement'
  for pg in (a,b):pg.locator('#undo').click()
  undone=compare('undo-combat');assert undone['pendingBattle']['die']==die
  for pg in (a,b):pg.get_by_role('button',name='Resolve with selected choices').click()
  assert compare('replay-combat')==resolved
  assert not any(errs),errs
  browser.close()
 print(f'PASS mixed turn local browser parity: {checks} checkpoints')
if __name__=='__main__':main()
