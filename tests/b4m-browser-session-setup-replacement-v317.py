#!/usr/bin/env python3
"""Compare opt-in shared session and bundled B4M UI for setup/replacements/Shock.
Controlled fixture states, actual UI buttons and map clicks. Local parity only.
"""
import os,pathlib,re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
html=(ROOT/'legacy/index.html').read_text()
scripts=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
shell=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
BRIDGE='''
window.__srParity={
 state:()=>JSON.parse(JSON.stringify(s)),
 meta:()=>({phase:s.phase,used:s.replacementUsed||0,h:ownedSession?ownedSession.history.length:history.length}),
 setup:()=>{s=E.makeState(c,421,'manual');history=[];ownedSession=null;selection=null;used.clear();combats.clear();render();
  return {ids:s.units.filter(u=>u.army==='german').map(u=>u.id),starts:c.raw.hexes.filter(h=>h.germanStart).map(h=>({x:h.x,y:h.y,p:point(h.x,h.y)}))};},
 replacement:()=>{let t=E.makeState(c,422,'automated');E.autoSetup(c,t,'sweep');t.turn=2;t.side='german';t.phase='replacement';
  const u=t.units.find(u=>u.army==='german'&&u.position&&u.strength==='full');u.strength='reduced';
  s=t;history=[];ownedSession=null;selection=null;used.clear();combats.clear();render();return u.id;},
 shock:()=>{let t=E.makeState(c,423,'automated');E.autoSetup(c,t,'sweep');t.turn=4;t.side='soviet';t.phase='reinforcement';
  const shock=t.units.find(u=>u.army==='soviet'&&u.type==='shock');shock.position=null;shock.strength='dead';
  s=t;history=[];ownedSession=null;selection=null;used.clear();combats.clear();render();return E.shockReinforcementOptions(c,t).length;}
};
'''
def build(page,owned):
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(shell,wait_until='load')
 if owned:page.add_script_tag(content='window.B4M_SHARED_SESSION_OWNERSHIP_PILOT=true;')
 for rel in scripts:
  content=(ROOT/'legacy'/rel).resolve().read_text()
  if rel=='ui.js':
   assert content.rstrip().endswith('})();')
   content=content.rstrip()[:-5]+BRIDGE+'})();\n'
  page.add_script_tag(content=content)
 page.select_option('#mode','hotseat')
 return errors
def hit(page,p):
 page.evaluate('''p=>{const e=document.getElementById('board'),r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+p.x*r.width/e.width,clientY:r.top+p.y*r.height/e.height}));}''',p)
def main():
 with sync_playwright() as p:
  exe=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else p.chromium.executable_path)
  browser=p.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
  a,b=[browser.new_page(viewport={'width':1600,'height':1100}) for _ in range(2)]
  ea,eb=build(a,False),build(b,True)
  checks=0
  def parity(label):
   nonlocal checks
   x,y=[page.evaluate('window.__srParity.state()') for page in (a,b)]
   assert x==y,f'{label}: game state differs';checks+=1;return x
  rows=[page.evaluate('window.__srParity.setup()') for page in (a,b)]
  assert rows[0]==rows[1];parity('setup-initial')
  for i,(unit,start) in enumerate(zip(rows[0]['ids'],rows[0]['starts'])):
   for page in (a,b):
    page.locator('#options button').filter(has_text=re.compile(r'^'+re.escape(unit)+r' ·')).first.click()
    hit(page,start['p'])
   parity('setup-unit-'+str(i))
  for page in (a,b):page.locator('#phase').click()
  assert parity('setup-complete')['phase']=='combat'
  for page in (a,b):page.locator('#undo').click()
  assert parity('undo-setup-complete')['phase']=='setup'
  for page in (a,b):page.locator('#undo').click()
  parity('undo-setup-place')
  ids=[page.evaluate('window.__srParity.replacement()') for page in (a,b)]
  assert ids[0]==ids[1];parity('replacement-initial')
  for page in (a,b):
   button=page.locator('#options button').filter(has_text='Restore '+ids[0]);assert button.count(), 'restore action missing'
   button.first.click()
  assert parity('replacement-restore')['replacementUsed']==1
  for page in (a,b):page.locator('#undo').click()
  assert parity('replacement-undo').get('replacementUsed',0)==0
  counts=[page.evaluate('window.__srParity.shock()') for page in (a,b)]
  assert counts[0]==counts[1] and counts[0]>0
  parity('shock-initial')
  for page in (a,b):
   page.locator('#options button').filter(has_text='Place 1st Shock').first.click()
  assert parity('shock-place')['phase']=='reinforcement'
  for page in (a,b):page.locator('#undo').click()
  parity('shock-undo')
  assert not ea and not eb,(ea,eb)
  browser.close()
 print(f'PASS shared browser setup/replacement/reinforcement local parity: {checks} checkpoints')
if __name__=='__main__':main()
