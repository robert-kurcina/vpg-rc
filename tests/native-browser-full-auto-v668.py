#!/usr/bin/env python3
"""Full automatic native browser campaign using the shipped engine and controls."""
import json, re, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]; sys.path.insert(0,str(ROOT/'scripts'))
from native_browser_asset_fixture import install_fetch
folder=ROOT/'games/battle-for-moscow/native-preview'; html=(folder/'index.html').read_text()
paths=re.findall(r'<script src="([^"]+)"></script>',html);html=re.sub(r'<script src="[^"]+"></script>','',html)
files={p:json.loads((folder/p).read_text()) for p in ['../game.json','../map.json','../units.json','../deployments.json','../rules.json','../objectives.json','config.json','ui-config.json','ai-config.json','ai-config-objective.json','ai-config-capture.json','../../../maps/battle-for-moscow.json','../../../maps/registry.json']}
checks=0
def ok(test,label):
 global checks
 assert test,label
 checks+=1
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage']);page=browser.new_page(viewport={'width':1440,'height':950},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 print("browser launched",flush=True);page.set_content(html,wait_until='domcontentloaded');install_fetch(page,files,ROOT)
 for p in paths:page.add_script_tag(content=(folder/p).read_text())
 print("scripts loaded",flush=True);page.evaluate('window.__nativePreviewReady');page.wait_for_function('!!__nativePreview.getSession()')
 raw=lambda:page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 def select(id,value):page.evaluate('([id,value])=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event("change"));}',[id,value])
 def export():
  with page.expect_download() as d:page.locator('#save-game').click()
  return json.loads(Path(d.value.path()).read_text())
 def load(payload):
  page.locator('#load-game').set_input_files({'name':'test.json','mimeType':'application/json','buffer':json.dumps(payload).encode()})
  page.wait_for_function('document.getElementById("load-game").value===""')
 page.locator("[data-game-tab=settings]").click();page.locator("#seed").fill("7");page.locator("[data-game-tab=play]").click();page.locator("#new-game").click();print("fixed seed initialized",flush=True)
 before=raw();ok(before['state']['side']=='german','initial faction')
 select('native-ai-assignment','both');select('ai-strategy','objective');select('ai-strategy-soviet','objective')
 page.locator('#native-ai-resume').click()
 for i in range(60):
  progress=page.evaluate('()=>({turn:__nativePreview.getSession().state.turn,side:__nativePreview.getSession().state.side,over:__nativePreview.getSession().state.over,status:document.getElementById("native-ai-status").textContent,message:document.getElementById("message").textContent,button:document.getElementById("native-ai-resume").textContent})')
  print(json.dumps(progress),flush=True)
  if progress["over"] and progress["button"]!="Stop AI":break
  if progress["status"]=="Automatic play paused":raise AssertionError(progress)
  page.wait_for_timeout(1000)
 terminal=raw();ok(terminal['state']['over'],'terminal');ok(terminal['state']['turn']>=7,'full campaign');ok(terminal['state']['pendingRoll'] is None,'no pending die');ok(not errors,str(errors))
 portable=export();load(portable);ok(raw()==terminal,'exact terminal save/restore');ok(page.locator('#native-ai-assignment').input_value()=='both','ownership restored');ok(page.locator('#native-ai-resume').inner_text()=='Resume automatic play','load paused');print(json.dumps({'checks':checks,'turn':terminal['state']['turn'],'history':len(__import__('builtins').list(terminal.get('history',[]))),'over':terminal['state']['over'],'winner':terminal['state'].get('winner')}),flush=True);browser.close()
