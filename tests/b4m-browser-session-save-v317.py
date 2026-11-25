#!/usr/bin/env python3
"""Real-browser save/export/import and Undo continuity, opt-in shared session."""
import json, os, pathlib, re
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
html=(ROOT/'legacy/index.html').read_text()
scripts=re.findall(r'<script src="([^"]+)"[^>]*></script>',html)
shell=re.sub(r'<script src="[^"]+"[^>]*></script>','',html)
BRIDGE='''window.__saveTest={
 fixture(){s=E.makeState(c,919,'automated');s.turn=2;s.side='german';s.phase='movement';
   selection=null;history=[];ownedSession=null;used.clear();combats.clear();render();
   for(const u of s.units.filter(u=>u.army==='german'&&u.position)){
    const m=E.legalMoves(c,s,u,'normal');if(m.length){
     return {id:u.id,from:point(u.position.x,u.position.y),to:point(m[0].x,m[0].y)};
    }
   }throw Error('Missing legal move');
 },
 state:()=>JSON.parse(JSON.stringify(s)),
 meta:()=>({history:ownedSession?.history.length||0,used:[...used].sort()})
};'''
def build(page,pilot):
 page.set_content(shell,wait_until='load')
 if pilot:page.add_script_tag(content='window.B4M_SHARED_SESSION_OWNERSHIP_PILOT=true;')
 for rel in scripts:
  content=(ROOT/'legacy'/rel).resolve().read_text()
  if rel=='ui.js':
   assert content.rstrip().endswith('})();')
   content=content.rstrip()[:-5]+BRIDGE+'})();\n'
  page.add_script_tag(content=content)
 page.select_option('#mode','hotseat')
def click(page,p):
 page.evaluate('''p=>{const e=document.getElementById('board'),r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.left+p.x*r.width/e.width,clientY:r.top+p.y*r.height/e.height}));}''',p)
def main():
 with sync_playwright() as pw:
  exe=os.getenv('B4M_CHROMIUM') or ('/usr/bin/chromium' if pathlib.Path('/usr/bin/chromium').exists() else pw.chromium.executable_path)
  browser=pw.chromium.launch(headless=True,executable_path=exe,args=['--no-sandbox'])
  src,dst=[browser.new_page(viewport={'width':1600,'height':1200}) for _ in range(2)]
  build(src,True);build(dst,True);f=src.evaluate('window.__saveTest.fixture()');dst.evaluate('window.__saveTest.fixture()')
  click(src,f['from']);click(src,f['to'])
  before=src.evaluate('window.__saveTest.state()');meta=src.evaluate('window.__saveTest.meta()')
  assert meta['history']==1 and f['id'] in meta['used']
  with src.expect_download() as pending:src.locator('#export').click()
  path=pending.value.path();data=json.loads(pathlib.Path(path).read_text())
  assert data['format']=='wargame-session' and data['version']==2 and len(data['history'])==1
  dst.locator('#file').set_input_files({'name':'moscow-session-v2.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
  assert dst.evaluate('window.__saveTest.state()')==before
  assert dst.evaluate('window.__saveTest.meta()')==meta
  dst.locator('#undo').click();assert dst.evaluate('window.__saveTest.meta()')['history']==0
  click(dst,f['from']);click(dst,f['to'])
  assert dst.evaluate('window.__saveTest.state()')==before
  # Invalid import must not mutate the active game, including session Undo.
  invalid=dict(data);invalid['scenarioId']='objective-kiev'
  dst.on('dialog',lambda dialog:dialog.dismiss())
  dst.locator('#file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
  assert dst.evaluate('window.__saveTest.state()')==before
  assert dst.evaluate('window.__saveTest.meta()')==meta
  # Legacy save enters the pilot with a new empty history, not fictional Undo.
  legacy={'version':1,'state':before}
  dst.locator('#file').set_input_files({'name':'old.json','mimeType':'application/json','buffer':json.dumps(legacy).encode()})
  assert dst.evaluate('window.__saveTest.state()')==before
  assert dst.evaluate('window.__saveTest.meta()')['history']==0
  browser.close()
 print('PASS browser v2 save/import, Undo/replay, corrupt rejection, legacy-v1 migration')
if __name__=='__main__':main()
