#!/usr/bin/env python3
"""Actual shipped native page, with source-file transport fixture only."""
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
 page.set_content(html,wait_until='domcontentloaded');install_fetch(page,files,ROOT)
 for p in paths:page.add_script_tag(content=(folder/p).read_text())
 page.evaluate('window.__nativePreviewReady');page.wait_for_function('!!__nativePreview.getSession()')
 raw=lambda:page.evaluate('WargameSession.serialize(__nativePreview.getSession())')
 def select(id,value):page.evaluate('([id,value])=>{const e=document.getElementById(id);e.value=value;e.dispatchEvent(new Event("change"));}',[id,value])
 def export():
  with page.expect_download() as d:page.locator('#save-game').click()
  return json.loads(Path(d.value.path()).read_text())
 def load(payload):
  page.locator('#load-game').set_input_files({'name':'test.json','mimeType':'application/json','buffer':json.dumps(payload).encode()})
  page.wait_for_function('document.getElementById("load-game").value===""')
 before=raw();ok(before['state']['side']=='german','initial faction')
 select('native-ai-assignment','german');select('ai-strategy','objective')
 expected=page.evaluate("profile=>WargameSession.serialize(WargameNativeSessionAI.playSide(__nativePreview.getSession(), profile).session)",files["ai-config-objective.json"])
 # Schedule a real control click once the first transaction becomes visible to JS.
 page.evaluate("()=>{const initial=__nativePreview.getSession().history.length;const t=setInterval(()=>{if(__nativePreview.getSession().history.length>initial&&document.getElementById('native-ai-resume').textContent==='Stop AI'){clearInterval(t);document.getElementById('native-ai-resume').click();}},0);}")
 page.locator('#native-ai-resume').click();page.wait_for_function('document.getElementById("message").textContent.includes("AI paused at a legal action boundary")',timeout=30000)
 paused=raw();ok(paused!=before,'at least one action committed');ok(paused['state']['side']=='german','stopped before side boundary');ok(paused['state']['pendingRoll'] is None,'no committed die abandoned');page.wait_for_timeout(150);ok(raw()==paused,'no background actions');ok(page.locator('#native-ai-resume').inner_text()=='Resume automatic play','resume control available')
 page.locator('#native-ai-resume').click();page.wait_for_function('__nativePreview.getSession().state.side==="soviet"',timeout=30000);ok(raw()==expected,'resume exact uninterrupted journal');ok('Objective-guard AI german' in page.locator('#message').inner_text(),'completed report');ok(not errors,str(errors));browser.close()
print(json.dumps({'checks':checks,'scenario':'battle-for-moscow','test':'interrupt-resume'}))
